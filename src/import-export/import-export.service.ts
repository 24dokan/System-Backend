import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { AuthUser } from '../common/current-user.decorator';
import { OptionsService } from '../options/options.service';
import { LimitsService } from '../packages/limits.service';
import { PrismaService } from '../prisma/prisma.service';
import { missingFields } from '../sellers/profile.rules';
import { toCsv } from './csv.util';
import {
  COLUMNS, MAX_ROWS, OPTION_SLOTS, ParsedProduct, REQUIRED_COLUMNS, RejectedGroup, buildProducts, makeCategoryResolver, suggestCode,
} from './import.parser';

@Injectable()
export class ImportExportService {
  private log = new Logger(ImportExportService.name);
  constructor(private prisma: PrismaService, private limits: LimitsService, private optionLibrary: OptionsService) {}

  template() {
    // Build each row by column name so the cells always line up with the header.
    const line = (v: Record<string, string>) => COLUMNS.map((c) => v[c] ?? '');
    return toCsv(COLUMNS, [
      line({
        product_key: 'TSHIRT-1', name: 'Basic T-Shirt', description: 'Soft cotton tee', category: 'Men Fashion > Men Clothing',
        option1_name: 'Size', option1_value: 'S', option2_name: 'Colour', option2_value: 'Black', sku_code: 'TSHIRT-S-BLK', price: '29.90',
      }),
      line({ product_key: 'TSHIRT-1', option1_value: 'M', option2_value: 'Black', price: '29.90' }),
      line({ product_key: 'MUG-1', name: 'Ceramic Mug', category: 'Home & Living > Kitchen & Dining', price: '15.00' }),
    ]);
  }

  // ---------- import ----------

  async importProducts(user: AuthUser, file: Buffer) {
    const sellerId = user.sellerId!;
    const seller = await this.prisma.seller.findUnique({ where: { id: sellerId } });
    if (seller?.status !== 'APPROVED') throw new ForbiddenException('Your seller account must be approved first');
    const profile = await this.prisma.sellerProfile.findUnique({ where: { sellerId } });
    if (missingFields(profile).length) throw new ForbiddenException('Complete your store profile before importing products');
    // Fail fast when there is no active subscription, instead of rejecting every product one by one.
    await this.limits.assertCanAdd(sellerId, 0, 0);

    let rows: Record<string, string>[];
    try {
      rows = parse(file, {
        columns: (h: string[]) => h.map((x) => x.trim().toLowerCase()),
        skip_empty_lines: true, trim: true, bom: true,
      });
    } catch (e) {
      throw new BadRequestException(`Could not read the CSV file: ${(e as Error).message}`);
    }
    if (!rows.length) throw new BadRequestException('The file has no data rows');
    if (rows.length > MAX_ROWS) throw new BadRequestException(`Too many rows (${rows.length}). Split the file into batches of at most ${MAX_ROWS}.`);
    const missing = REQUIRED_COLUMNS.filter((c) => !(c in rows[0]));
    if (missing.length) throw new BadRequestException(`Missing column(s): ${missing.join(', ')}. Download the template for the correct format.`);

    const categories = await this.prisma.category.findMany({ where: { isActive: true } });
    const { valid, rejected } = buildProducts(rows, makeCategoryResolver(categories));

    const created: { key: string; productId: string; skuCount: number; draft: boolean }[] = [];
    for (const p of valid) {
      try {
        const reason = await this.createPending(sellerId, user.id, p);
        if (typeof reason === 'string') rejected.push({ key: p.key, rows: p.rows, errors: [reason] });
        else created.push({ key: p.key, productId: reason.id, skuCount: p.skus.length, draft: reason.draft });
      } catch (e) {
        if (e instanceof ForbiddenException) rejected.push({ key: p.key, rows: p.rows, errors: [e.message] });
        else {
          this.log.error(`Import failed for product ${p.key}`, (e as Error).stack);
          rejected.push({ key: p.key, rows: p.rows, errors: ['Unexpected error while saving this product'] });
        }
      }
    }
    return {
      rows: rows.length,
      createdCount: created.length,
      // Products that use options still waiting for approval are saved as drafts instead of being sent for review.
      draftCount: created.filter((c) => c.draft).length,
      rejectedCount: rejected.length,
      created,
      rejected: rejected as RejectedGroup[],
    };
  }

  /** Creates one imported product as PENDING. Returns the product, or a string explaining why it was refused. */
  private async createPending(sellerId: string, actorId: string, p: ParsedProduct): Promise<{ id: string; draft: boolean } | string> {
    // Explicit codes must be free. Missing ones are generated and made unique.
    const explicit = p.skus.map((s) => s.code).filter((c): c is string => !!c);
    const taken = new Set((await this.prisma.sku.findMany({ where: { code: { in: explicit } }, select: { code: true } })).map((s) => s.code));
    if (taken.size) return `sku_code already in use: ${[...taken].join(', ')}`;

    const used = new Set(explicit);
    const wanted = p.skus.map((s) => s.code ?? suggestCode(p.key, s.values));
    const clash = new Set(
      (await this.prisma.sku.findMany({ where: { code: { in: wanted } }, select: { code: true } })).map((s) => s.code),
    );
    const codes = p.skus.map((s, i) => {
      if (s.code) return s.code;
      let code = wanted[i];
      for (let n = 2; clash.has(code) || used.has(code); n++) code = `${wanted[i]}-${n}`;
      used.add(code);
      return code;
    });

    await this.limits.assertCanAdd(sellerId, 1, p.skus.length); // throws ForbiddenException when over the limit

    // Options must come from the library. New ones become requests, and the product waits as a draft.
    let options: { name: string; values: string[] }[];
    try {
      options = await this.optionLibrary.resolve(sellerId, p.options);
    } catch (e) {
      if (e instanceof BadRequestException) return e.message;
      throw e;
    }
    const draft = (await this.optionLibrary.unapproved(sellerId, options)).length > 0;

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          sellerId, categoryId: p.categoryId, name: p.name, description: p.description, status: draft ? 'DRAFT' : 'PENDING',
          options: {
            create: options.map((o, position) => ({
              name: o.name, position, values: { create: o.values.map((value, vp) => ({ value, position: vp })) },
            })),
          },
        },
        include: { options: { include: { values: true } } },
      });
      const valueId = (optionIdx: number, value: string) =>
        product.options.find((o) => o.position === optionIdx)!.values.find((v) => v.value.toLowerCase() === value.toLowerCase())!.id;
      for (const [i, s] of p.skus.entries()) {
        await tx.sku.create({
          data: {
            productId: product.id, code: codes[i], priceMinor: s.priceMinor,
            values: { create: s.values.map((v, idx) => ({ optionValueId: valueId(idx, v) })) },
          },
        });
      }
      if (!draft) await tx.approvalEvent.create({ data: { productId: product.id, action: 'SUBMIT', actorId, reason: 'CSV import' } });
      return { id: product.id, draft };
    });
  }

  // ---------- export ----------

  /** One row per SKU, in the same format the importer reads. */
  async exportProducts(user: AuthUser, sellerId?: string) {
    const products = await this.prisma.product.findMany({
      where: { sellerId: user.role === 'ADMIN' ? sellerId : user.sellerId! },
      orderBy: { createdAt: 'asc' },
      include: {
        category: true,
        options: { orderBy: { position: 'asc' }, include: { values: true } },
        skus: { orderBy: { code: 'asc' }, include: { values: true } },
      },
    });
    const cats = await this.prisma.category.findMany();
    const byId = new Map(cats.map((c) => [c.id, c]));
    const path = (id: string): string => {
      const c = byId.get(id)!;
      return c.parentId && byId.has(c.parentId) ? `${path(c.parentId)} > ${c.name}` : c.name;
    };

    const rows: unknown[][] = [];
    for (const p of products) {
      const valueOf = new Map(p.options.flatMap((o) => o.values.map((v) => [v.id, v.value] as const)));
      p.skus.forEach((s, i) => {
        const optionCells = Array.from({ length: OPTION_SLOTS }, (_, slot) => {
          const opt = p.options[slot];
          if (!opt) return ['', ''];
          const own = s.values.map((v) => v.optionValueId).find((id) => opt.values.some((x) => x.id === id));
          return [i === 0 ? opt.name : '', own ? valueOf.get(own) : ''];
        }).flat();
        rows.push([
          p.id, i === 0 ? p.name : '', i === 0 ? p.description ?? '' : '', i === 0 ? path(p.categoryId) : '',
          ...optionCells, s.code, (s.priceMinor / 100).toFixed(2),
        ]);
      });
    }
    return toCsv(COLUMNS, rows);
  }
}

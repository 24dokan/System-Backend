import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../common/current-user.decorator';
import { slugify } from '../common/slugify';
import { OptionsService } from '../options/options.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateProductDto, GenerateSkusDto, ListProductsQuery, SetOptionsDto, SetProductFeaturesDto, SetProductMediaDto, UpdateProductDto, UpdateSkuDto,
} from './dto/products.dto';
import { MAX_COMBINATIONS, cartesian, comboKey } from './sku-combinations';

const FULL = {
  category: true,
  options: { include: { values: { orderBy: { position: 'asc' as const } } }, orderBy: { position: 'asc' as const } },
  skus: { include: { values: true }, orderBy: { code: 'asc' as const } },
  features: { include: { feature: true } },
  media: { include: { media: true }, orderBy: { position: 'asc' as const } },
} satisfies Prisma.ProductInclude;

/** Statuses in which the seller may edit the product directly. */
const DIRECTLY_EDITABLE = ['DRAFT', 'REJECTED'];

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService, private optionLibrary: OptionsService) {}

  // ---------- access ----------

  /** Loads a product the user may see: Admin sees all, a seller only its own. Others get 404. */
  async getVisible(user: AuthUser, id: string) {
    const p = await this.prisma.product.findUnique({ where: { id }, include: FULL });
    if (!p || (user.role !== 'ADMIN' && p.sellerId !== user.sellerId)) throw new NotFoundException('Product not found');
    return p;
  }

  /** Seller-only: must be the owner and the product must be editable in place. */
  private async getEditable(user: AuthUser, id: string) {
    if (user.role !== 'SELLER') throw new ForbiddenException('Only the owning seller can edit a product');
    const p = await this.getVisible(user, id);
    if (!DIRECTLY_EDITABLE.includes(p.status)) {
      throw new ConflictException(
        p.status === 'PENDING'
          ? 'Product is awaiting review and cannot be edited'
          : 'Approved products are changed through a revision, not edited in place',
      );
    }
    return p;
  }

  private async assertSellerApproved(sellerId: string) {
    const s = await this.prisma.seller.findUnique({ where: { id: sellerId } });
    if (!s || s.status !== 'APPROVED') throw new ForbiddenException('Your seller account must be approved first');
  }

  private async assertCategory(categoryId: string) {
    const c = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!c || !c.isActive) throw new BadRequestException('Category not found or inactive');
  }

  // ---------- products ----------

  async create(user: AuthUser, dto: CreateProductDto) {
    await this.assertSellerApproved(user.sellerId!);
    await this.assertCategory(dto.categoryId);
    return this.prisma.product.create({
      data: { ...dto, sellerId: user.sellerId! },
      include: FULL,
    });
  }

  async list(user: AuthUser, q: ListProductsQuery) {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;
    const where: Prisma.ProductWhereInput = {
      status: q.status,
      sellerId: user.role === 'ADMIN' ? q.sellerId : user.sellerId!,
    };
    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
        include: { category: true, _count: { select: { skus: true } } },
      }),
      this.prisma.product.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async update(user: AuthUser, id: string, dto: UpdateProductDto) {
    await this.getEditable(user, id);
    if (dto.categoryId) await this.assertCategory(dto.categoryId);
    return this.prisma.product.update({ where: { id }, data: dto, include: FULL });
  }

  async setFeatures(user: AuthUser, id: string, dto: SetProductFeaturesDto) {
    await this.getEditable(user, id);
    const ids = [...new Set(dto.features.map((f) => f.featureId))];
    if ((await this.prisma.feature.count({ where: { id: { in: ids } } })) !== ids.length) {
      throw new BadRequestException('Unknown feature in list');
    }
    await this.prisma.$transaction([
      this.prisma.productFeature.deleteMany({ where: { productId: id } }),
      this.prisma.productFeature.createMany({
        data: dto.features.map((f) => ({ productId: id, featureId: f.featureId, value: f.value })),
        skipDuplicates: true,
      }),
    ]);
    return this.getVisible(user, id);
  }

  async setMedia(user: AuthUser, id: string, dto: SetProductMediaDto) {
    await this.getEditable(user, id);
    const ids = [...new Set(dto.mediaIds)];
    const found = await this.prisma.media.count({ where: { id: { in: ids }, sellerId: user.sellerId!, uploaded: true } });
    if (found !== ids.length) throw new BadRequestException('Unknown or unconfirmed media in list');
    await this.prisma.$transaction([
      this.prisma.productMedia.deleteMany({ where: { productId: id } }),
      this.prisma.productMedia.createMany({ data: ids.map((mediaId, position) => ({ productId: id, mediaId, position })) }),
    ]);
    return this.getVisible(user, id);
  }

  // ---------- options ----------

  /**
   * Replaces the option set. Options and values that keep their name keep their ids.
   * SKUs that used a removed value, or no longer match the option count, are deleted.
   * Safe because only draft/rejected products are editable and stock exists only after approval.
   */
  async setOptions(user: AuthUser, id: string, dto: SetOptionsDto) {
    const product = await this.getEditable(user, id);
    const names = dto.options.map((o) => o.name.trim().toLowerCase());
    if (new Set(names).size !== names.length) throw new BadRequestException('Option names must be unique');
    for (const o of dto.options) {
      const vals = o.values.map((v) => v.trim().toLowerCase());
      if (vals.some((v) => !v) || new Set(vals).size !== vals.length) {
        throw new BadRequestException(`Option "${o.name}" has empty or duplicate values`);
      }
    }

    // Use the library's spelling. Anything new becomes a request for the team to approve.
    const resolved = await this.optionLibrary.resolve(user.sellerId!, dto.options.map((o) => ({ name: o.name.trim(), values: o.values.map((v) => v.trim()) })));
    dto = { options: resolved } as SetOptionsDto;

    await this.prisma.$transaction(async (tx) => {
      const keepOptionIds = new Set<string>();
      const keepValueIds = new Set<string>();
      const plan: { name: string; position: number; values: string[]; existingId?: string }[] = dto.options.map((o, position) => ({
        name: o.name.trim(),
        position,
        values: o.values.map((v) => v.trim()),
        existingId: product.options.find((e) => e.name.toLowerCase() === o.name.trim().toLowerCase())?.id,
      }));
      plan.forEach((p) => p.existingId && keepOptionIds.add(p.existingId));
      for (const p of plan) {
        const existing = product.options.find((e) => e.id === p.existingId);
        existing?.values.forEach((v) => p.values.some((x) => x.toLowerCase() === v.value.toLowerCase()) && keepValueIds.add(v.id));
      }

      // 1. Remove SKUs built on values that are going away, then the values and options themselves.
      const removedValueIds = product.options.flatMap((o) => o.values).filter((v) => !keepValueIds.has(v.id)).map((v) => v.id);
      if (removedValueIds.length) {
        await tx.sku.deleteMany({ where: { productId: id, values: { some: { optionValueId: { in: removedValueIds } } } } });
        await tx.productOptionValue.deleteMany({ where: { id: { in: removedValueIds } } });
      }
      await tx.productOption.deleteMany({ where: { productId: id, id: { notIn: [...keepOptionIds] } } });

      // 2. Create or update what remains.
      for (const p of plan) {
        const optionId = p.existingId
          ? (await tx.productOption.update({ where: { id: p.existingId }, data: { name: p.name, position: p.position } })).id
          : (await tx.productOption.create({ data: { productId: id, name: p.name, position: p.position } })).id;
        const existingVals = product.options.find((e) => e.id === p.existingId)?.values ?? [];
        for (const [position, value] of p.values.entries()) {
          const ev = existingVals.find((v) => v.value.toLowerCase() === value.toLowerCase());
          if (ev) await tx.productOptionValue.update({ where: { id: ev.id }, data: { value, position } });
          else await tx.productOptionValue.create({ data: { optionId, value, position } });
        }
      }

      // 3. Any SKU that no longer has exactly one value per option is stale.
      const skus = await tx.sku.findMany({ where: { productId: id }, include: { _count: { select: { values: true } } } });
      const stale = skus.filter((s) => s._count.values !== plan.length).map((s) => s.id);
      if (stale.length) await tx.sku.deleteMany({ where: { id: { in: stale } } });
    });
    return this.getVisible(user, id);
  }

  // ---------- SKUs ----------

  /** Creates the missing SKUs for every option combination. Existing SKUs are never touched. */
  async generateSkus(user: AuthUser, id: string, dto: GenerateSkusDto) {
    const product = await this.getEditable(user, id);
    const combos = cartesian(product.options.map((o) => o.values.map((v) => v.id)));
    if (combos.length > MAX_COMBINATIONS) {
      throw new BadRequestException(`That would create ${combos.length} variations. The maximum per product is ${MAX_COMBINATIONS}.`);
    }
    const have = new Set(product.skus.map((s) => comboKey(s.values.map((v) => v.optionValueId))));
    const missing = combos.filter((c) => !have.has(comboKey(c)));
    if (!missing.length) return this.getVisible(user, id);

    const valueLabel = new Map(product.options.flatMap((o) => o.values).map((v) => [v.id, slugify(v.value)]));
    const prefix = slugify(dto.codePrefix ?? product.name).slice(0, 30);
    const wanted = missing.map((c) => [prefix, ...c.map((vid) => valueLabel.get(vid))].join('-').toUpperCase());
    const taken = new Set(
      (await this.prisma.sku.findMany({ where: { code: { in: wanted.flatMap((w) => [w]) } }, select: { code: true } })).map((s) => s.code),
    );

    const used = new Set<string>();
    const codes = wanted.map((base) => {
      let code = base;
      for (let i = 2; taken.has(code) || used.has(code); i++) code = `${base}-${i}`;
      used.add(code);
      return code;
    });
    // A suffixed code could still collide with an unseen row; re-check and let the DB constraint be the last guard.
    const clash = await this.prisma.sku.findMany({ where: { code: { in: codes } }, select: { code: true } });
    if (clash.length) throw new ConflictException('SKU code clash, try a different code prefix');

    await this.prisma.$transaction(
      missing.map((combo, i) =>
        this.prisma.sku.create({
          data: {
            productId: id,
            code: codes[i],
            priceMinor: dto.priceMinor,
            values: { create: combo.map((optionValueId) => ({ optionValueId })) },
          },
        }),
      ),
    );
    return this.getVisible(user, id);
  }

  async updateSku(user: AuthUser, id: string, skuId: string, dto: UpdateSkuDto) {
    await this.getEditable(user, id);
    const sku = await this.prisma.sku.findFirst({ where: { id: skuId, productId: id } });
    if (!sku) throw new NotFoundException('SKU not found');
    if (dto.code && dto.code !== sku.code && (await this.prisma.sku.findUnique({ where: { code: dto.code } }))) {
      throw new ConflictException('SKU code already in use');
    }
    return this.prisma.sku.update({ where: { id: skuId }, data: dto });
  }

  async deleteProduct(user: AuthUser, id: string) {
    await this.getEditable(user, id);
    await this.prisma.product.delete({ where: { id } });
  }
}

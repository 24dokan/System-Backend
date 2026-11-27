import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../common/current-user.decorator';
import { nextNumber } from '../common/counter.util';
import { paging } from '../common/paging';
import { toCsv } from '../import-export/csv.util';
import { StockService } from '../inventory/stock.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto, OrderQuery } from './dto/orders.dto';
import { MAX_ORDER_ROWS, ORDER_COLUMNS, ORDER_REQUIRED, ParsedOrder, buildOrders } from './order.import';

const variationOf = (values: { optionValue: { value: string; option: { position: number } } }[]) =>
  [...values].sort((a, b) => a.optionValue.option.position - b.optionValue.option.position).map((v) => v.optionValue.value).join(' / ');

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService, private stock: StockService) {}

  // ---------- create ----------

  /** Creates one order and sets its stock aside, all in one transaction. */
  async create(user: AuthUser, dto: CreateOrderDto) {
    const id = await this.prisma.$transaction((tx) => this.createIn(tx, user, dto));
    return this.get(user, id);
  }

  private async createIn(tx: Prisma.TransactionClient, user: AuthUser, dto: CreateOrderDto): Promise<string> {
    const [seller, warehouse] = await Promise.all([tx.seller.findUnique({ where: { id: dto.sellerId } }), tx.warehouse.findUnique({ where: { id: dto.warehouseId } })]);
    if (!seller || seller.status !== 'APPROVED') throw new BadRequestException('Choose an approved seller');
    if (!warehouse?.isActive) throw new BadRequestException('Warehouse not found or switched off');
    const ref = dto.externalRef?.trim() || null;
    if (ref && (await tx.order.findFirst({ where: { source: dto.source, externalRef: ref }, select: { number: true } }))) {
      throw new ConflictException(`An order with reference ${ref} from ${dto.source} already exists`);
    }
    const ids = dto.items.map((i) => i.skuId);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('Each variation can appear only once. Raise the quantity instead.');
    const skus = await tx.sku.findMany({
      where: { id: { in: ids } },
      include: { product: { select: { name: true, sellerId: true, status: true } }, values: { include: { optionValue: { include: { option: true } } } } },
    });
    if (skus.length !== ids.length) throw new BadRequestException('A variation in this order no longer exists');
    for (const s of skus) {
      if (s.product.sellerId !== dto.sellerId) throw new BadRequestException(`${s.code} does not belong to this seller`);
      if (!s.isActive || !['APPROVED', 'PENDING_REVISION'].includes(s.product.status)) throw new BadRequestException(`${s.code} cannot be ordered right now`);
    }
    const lines = dto.items.map((i) => {
      const s = skus.find((x) => x.id === i.skuId)!;
      return { sku: s, qty: i.qty, unitPriceMinor: i.unitPriceMinor ?? s.priceMinor };
    });
    const itemsMinor = lines.reduce((n, l) => n + l.qty * l.unitPriceMinor, 0);
    const shippingMinor = dto.shippingMinor ?? 0;
    const discountMinor = dto.discountMinor ?? 0;
    if (discountMinor > itemsMinor + shippingMinor) throw new BadRequestException('The discount is larger than the order total');
    const number = await nextNumber(tx, 'order', 10000);
    const order = await tx.order.create({
      data: {
        number, source: dto.source, externalRef: ref, sellerId: dto.sellerId, warehouseId: dto.warehouseId,
        customerName: dto.customerName.trim(), customerPhone: dto.customerPhone?.trim() || null, address: dto.address.trim(),
        itemsMinor, shippingMinor, discountMinor, totalMinor: itemsMinor + shippingMinor - discountMinor, note: dto.note, createdById: user.id,
        events: { create: { action: 'CREATED', userId: user.id } },
      },
    });
    for (const l of lines) {
      const item = await tx.orderItem.create({
        data: { orderId: order.id, skuId: l.sku.id, productName: l.sku.product.name, variationLabel: variationOf(l.sku.values), skuCode: l.sku.code, qty: l.qty, unitPriceMinor: l.unitPriceMinor },
      });
      await this.stock.reserve(tx, { orderItemId: item.id, skuId: l.sku.id, warehouseId: dto.warehouseId, qty: l.qty, label: l.sku.code }, { userId: user.id, refLabel: `#${number}` });
    }
    return order.id;
  }

  // ---------- bulk import ----------

  template() {
    return toCsv(ORDER_COLUMNS, [
      ['SHOPEE', 'SP-1001', 'Aina Rahman', '0123456789', '12 Jalan Bunga, 50000 Kuala Lumpur', 'NB-HFC-50', '1', '', '5.00', '', ''],
      ['SHOPEE', 'SP-1001', '', '', '', 'NB-DSS-50', '2', '39.90', '', '', ''],
      ['LAZADA', 'LZ-2002', 'Tan Wei', '', '8 Lorong Cempaka, 10450 Penang', 'NB-MLC-RR', '3', '', '', '', 'Gift wrap'],
    ]);
  }

  /** mode "check" only reports problems. mode "create" creates every valid order and lists the rest. */
  async importOrders(user: AuthUser, file: Buffer, sellerId: string, warehouseId: string, create: boolean) {
    let rows: Record<string, string>[];
    try {
      rows = parse(file, { columns: (h: string[]) => h.map((x) => x.trim().toLowerCase()), skip_empty_lines: true, trim: true, bom: true });
    } catch (e) { throw new BadRequestException(`Could not read the CSV file: ${(e as Error).message}`); }
    if (!rows.length) throw new BadRequestException('The file has no data rows');
    if (rows.length > MAX_ORDER_ROWS) throw new BadRequestException(`Too many rows (${rows.length}). Split the file into batches of at most ${MAX_ORDER_ROWS}.`);
    const missing = ORDER_REQUIRED.filter((c) => !(c in rows[0]));
    if (missing.length) throw new BadRequestException(`Missing column(s): ${missing.join(', ')}. Download the template for the correct format.`);

    const { valid, rejected } = buildOrders(rows);
    const codes = [...new Set(valid.flatMap((o) => o.lines.map((l) => l.skuCode)))];
    const skus = await this.prisma.sku.findMany({ where: { code: { in: codes }, product: { sellerId } }, select: { id: true, code: true } });
    const byCode = new Map(skus.map((s) => [s.code.toLowerCase(), s.id]));
    const existing = await this.prisma.order.findMany({
      where: { OR: valid.map((o) => ({ source: o.source as never, externalRef: o.externalRef })) }, select: { source: true, externalRef: true },
    });
    const taken = new Set(existing.map((e) => `${e.source}|${e.externalRef}`));

    const ok: ParsedOrder[] = [];
    for (const o of valid) {
      const errors: string[] = [];
      if (taken.has(`${o.source}|${o.externalRef}`)) errors.push('An order with this reference already exists');
      for (const l of o.lines) if (!byCode.has(l.skuCode.toLowerCase())) errors.push(`${l.skuCode} was not found for this seller`);
      if (errors.length) rejected.push({ ref: o.externalRef, rows: o.rows, errors }); else ok.push(o);
    }

    const created: { number: number; ref: string }[] = [];
    if (create) {
      for (const o of ok) {
        try {
          const dto: CreateOrderDto = {
            source: o.source as never, externalRef: o.externalRef, sellerId, warehouseId, customerName: o.customerName, customerPhone: o.customerPhone, address: o.address,
            shippingMinor: o.shippingMinor, discountMinor: o.discountMinor, note: o.note,
            items: o.lines.map((l) => ({ skuId: byCode.get(l.skuCode.toLowerCase())!, qty: l.qty, unitPriceMinor: l.unitPriceMinor })),
          };
          // One transaction per order, so a shortage on one order does not stop the others.
          const id = await this.prisma.$transaction((tx) => this.createIn(tx, user, dto));
          const n = await this.prisma.order.findUniqueOrThrow({ where: { id }, select: { number: true } });
          created.push({ number: n.number, ref: o.externalRef });
        } catch (e) {
          rejected.push({ ref: o.externalRef, rows: o.rows, errors: [(e as Error).message] });
        }
      }
    }
    return { mode: create ? 'create' : 'check', readyCount: ok.length, created, createdCount: created.length, rejectedCount: rejected.length, rejected };
  }

  // ---------- read ----------

  private scope(user: AuthUser): Prisma.OrderWhereInput {
    return user.role === 'SELLER' ? { sellerId: user.sellerId ?? '__none__' } : {};
  }

  async list(user: AuthUser, q: OrderQuery) {
    const { page, pageSize, limit, offset } = paging(q);
    const s = q.search?.trim();
    const num = s && /^#?\d+$/.test(s) ? Number(s.replace('#', '')) : null;
    const where: Prisma.OrderWhereInput = {
      ...this.scope(user),
      ...(q.status ? { status: q.status as never } : {}), ...(q.source ? { source: q.source as never } : {}),
      ...(q.sellerId && user.role !== 'SELLER' ? { sellerId: q.sellerId } : {}),
      ...(q.from || q.to ? { placedAt: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) } } : {}),
      ...(s ? { OR: [
        ...(num !== null ? [{ number: num }] : []),
        { customerName: { contains: s, mode: 'insensitive' as const } }, { externalRef: { contains: s, mode: 'insensitive' as const } },
        { items: { some: { skuCode: { contains: s, mode: 'insensitive' as const } } } },
      ] } : {}),
    };
    const [rows, total, counts] = await Promise.all([
      this.prisma.order.findMany({
        where, orderBy: { createdAt: 'desc' }, take: limit, skip: offset,
        include: { seller: { select: { name: true } }, warehouse: { select: { name: true } }, items: { select: { qty: true } } },
      }),
      this.prisma.order.count({ where }),
      this.prisma.order.groupBy({ by: ['status'], where: this.scope(user), _count: { _all: true } }),
    ]);
    return {
      total, page, pageSize,
      counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
      rows: rows.map(({ items, seller, warehouse, ...o }) => ({ ...o, seller: seller.name, warehouse: warehouse.name, itemCount: items.reduce((n, i) => n + i.qty, 0) })),
    };
  }

  async get(user: AuthUser, id: string) {
    const o = await this.prisma.order.findFirst({
      where: { id, ...this.scope(user) },
      include: {
        seller: { select: { id: true, name: true } }, warehouse: { select: { id: true, name: true } },
        items: { include: { allocations: { include: { stockLevel: { select: { location: true } } } } }, orderBy: { skuCode: 'asc' } },
        events: { orderBy: { createdAt: 'asc' } }, returns: true,
      },
    });
    if (!o) throw new NotFoundException('Order not found');
    const userIds = [...new Set(o.events.map((e) => e.userId).filter((x): x is string => !!x))];
    const users = await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } });
    return {
      ...o,
      items: o.items.map(({ allocations, ...i }) => ({ ...i, picks: allocations.map((a) => ({ location: a.stockLevel.location, qty: a.qty })) })),
      events: o.events.map((e) => ({ ...e, by: users.find((u) => u.id === e.userId)?.name ?? users.find((u) => u.id === e.userId)?.email ?? 'System' })),
    };
  }

  forbidSeller(user: AuthUser) {
    if (user.role === 'SELLER') throw new ForbiddenException('Only our warehouse team can change orders');
  }
}

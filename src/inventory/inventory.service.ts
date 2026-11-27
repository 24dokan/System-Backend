import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../common/current-user.decorator';
import { paging } from '../common/paging';
import { PrismaService } from '../prisma/prisma.service';
import { AdjustDto, AlertLevelDto, MovementQuery, SkuSearchQuery, StockQuery, UpdateWarehouseDto, WarehouseDto } from './dto/inventory.dto';
import * as queries from './stock.queries';
import { planAdjustment } from './stock.rules';
import { StockService } from './stock.service';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService, private stock: StockService) {}

  private run<T>(q: queries.Query) {
    return this.prisma.$queryRawUnsafe<T[]>(q.text, ...q.params);
  }

  private async paged<T>(qs: { rows: queries.Query; count: queries.Query }, page: number, pageSize: number) {
    const [rows, total] = await Promise.all([this.run<T>(qs.rows), this.run<{ total: number }>(qs.count)]);
    return { rows, total: total[0]?.total ?? 0, page, pageSize };
  }

  // ---------- warehouses ----------

  listWarehouses() {
    return this.prisma.warehouse.findMany({ orderBy: { name: 'asc' } });
  }

  async warehousesWithTotals() {
    const [warehouses, totals] = await Promise.all([
      this.listWarehouses(),
      this.prisma.stockLevel.groupBy({ by: ['warehouseId'], _sum: { onHand: true }, _count: { skuId: true } }),
    ]);
    return warehouses.map((w) => {
      const t = totals.find((x) => x.warehouseId === w.id);
      return { ...w, onHand: t?._sum.onHand ?? 0, variations: t?._count.skuId ?? 0 };
    });
  }

  async createWarehouse(dto: WarehouseDto) {
    const code = dto.code.toUpperCase();
    if (await this.prisma.warehouse.findUnique({ where: { code } })) throw new ConflictException('A warehouse with this code already exists');
    return this.prisma.warehouse.create({ data: { ...dto, code } });
  }

  async updateWarehouse(id: string, dto: UpdateWarehouseDto) {
    if (!(await this.prisma.warehouse.findUnique({ where: { id } }))) throw new NotFoundException('Warehouse not found');
    if (dto.isActive === false) {
      const open = await this.prisma.order.count({ where: { warehouseId: id, status: { in: ['TO_PACK', 'PACKED', 'WAITING_PICKUP'] } } });
      if (open) throw new BadRequestException(`${open} open order(s) use this warehouse. Finish or cancel them first.`);
    }
    return this.prisma.warehouse.update({ where: { id }, data: dto });
  }

  // ---------- stock views ----------

  overview(q: StockQuery) {
    const { page, pageSize, limit, offset } = paging(q);
    return this.paged(queries.overview({ ...q, lowOnly: q.low, limit, offset }), page, pageSize);
  }

  async mine(sellerId: string, q: StockQuery) {
    const { page, pageSize, limit, offset } = paging(q);
    const qs = queries.sellerStock({ search: q.search, warehouseId: q.warehouseId, sellerId, lowOnly: q.low, limit, offset });
    const [result, totals] = await Promise.all([this.paged(qs, page, pageSize), this.run<any>(qs.totals)]);
    const t = totals[0] ?? { onHand: 0, reserved: 0, quarantine: 0, inspection: 0 };
    return { ...result, totals: { ...t, available: t.onHand - t.reserved } };
  }

  lowStock(q: StockQuery) {
    const { page, pageSize, limit, offset } = paging(q);
    return this.paged(queries.lowStock({ ...q, limit, offset }), page, pageSize);
  }

  /** The shelf rows for one variation (used by the adjustment form). */
  levels(skuId: string) {
    return this.prisma.stockLevel.findMany({ where: { skuId }, include: { warehouse: { select: { id: true, name: true } } }, orderBy: [{ warehouseId: 'asc' }, { location: 'asc' }] });
  }

  /** Finds orderable variations for forms: only approved products, only active variations. */
  async searchSkus(q: SkuSearchQuery) {
    const skus = await this.prisma.sku.findMany({
      where: {
        isActive: true, product: { status: { in: ['APPROVED', 'PENDING_REVISION'] }, ...(q.sellerId ? { sellerId: q.sellerId } : {}) },
        ...(q.q ? { OR: [{ code: { contains: q.q, mode: 'insensitive' } }, { product: { name: { contains: q.q, mode: 'insensitive' } } }] } : {}),
      },
      take: 20, orderBy: { code: 'asc' },
      include: { product: { select: { name: true, sellerId: true } }, values: { include: { optionValue: { include: { option: true } } } }, stockLevels: q.warehouseId ? { where: { warehouseId: q.warehouseId } } : true },
    });
    return skus.map((s) => ({
      id: s.id, code: s.code, product: s.product.name, sellerId: s.product.sellerId, priceMinor: s.priceMinor,
      variation: s.values.sort((a, b) => a.optionValue.option.position - b.optionValue.option.position).map((v) => v.optionValue.value).join(' / '),
      available: s.stockLevels.reduce((n, l) => n + l.onHand - l.reserved, 0),
    }));
  }

  async movements(q: MovementQuery) {
    const { page, pageSize, limit, offset } = paging(q);
    const where: Prisma.StockMovementWhereInput = {
      ...(q.type ? { type: q.type as never } : {}),
      ...(q.sellerId ? { sku: { product: { sellerId: q.sellerId } } } : {}),
      ...(q.search ? { OR: [{ sku: { code: { contains: q.search, mode: 'insensitive' } } }, { refLabel: { contains: q.search, mode: 'insensitive' } }] } : {}),
      ...(q.from || q.to ? { createdAt: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) } } : {}),
    };
    const [rows, total, warehouses] = await Promise.all([
      this.prisma.stockMovement.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit, skip: offset, include: { sku: { select: { code: true } } } }),
      this.prisma.stockMovement.count({ where }),
      this.prisma.warehouse.findMany({ select: { id: true, name: true } }),
    ]);
    const names = new Map(warehouses.map((w) => [w.id, w.name]));
    const userIds = [...new Set(rows.map((r) => r.userId).filter((x): x is string => !!x))];
    const users = await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } });
    return {
      total, page, pageSize,
      rows: rows.map((r) => ({
        id: r.id, createdAt: r.createdAt, type: r.type, sku: r.sku.code, warehouse: names.get(r.warehouseId) ?? '', location: r.location,
        change: r.onHandDelta || r.reservedDelta * -1 || r.quarantineDelta || r.inspectionDelta, onHandDelta: r.onHandDelta, reservedDelta: r.reservedDelta,
        quarantineDelta: r.quarantineDelta, inspectionDelta: r.inspectionDelta, onHandAfter: r.onHandAfter, ref: r.refLabel, note: r.note,
        by: users.find((u) => u.id === r.userId)?.name ?? users.find((u) => u.id === r.userId)?.email ?? 'System',
      })),
    };
  }

  // ---------- changes ----------

  async adjust(user: AuthUser, dto: AdjustDto) {
    const [sku, warehouse] = await Promise.all([
      this.prisma.sku.findUnique({ where: { id: dto.skuId } }),
      this.prisma.warehouse.findUnique({ where: { id: dto.warehouseId } }),
    ]);
    if (!sku) throw new NotFoundException('Variation not found');
    if (!warehouse) throw new NotFoundException('Warehouse not found');
    const location = (dto.location ?? '').trim();
    return this.prisma.$transaction(async (tx) => {
      const row = await this.stock.row(tx, dto.skuId, dto.warehouseId, location);
      const current = await tx.stockLevel.findUniqueOrThrow({ where: { id: row.id } });
      const plan = planAdjustment(dto.reason, current, { countedQty: dto.countedQty, quantity: dto.quantity, change: dto.change });
      if (typeof plan === 'string') throw new BadRequestException(plan);
      const label = { COUNT: 'Stock count', LOST: 'Lost', DAMAGED: 'Damaged', EXPIRED: 'Expired', OTHER: 'Other' }[dto.reason];
      await this.stock.adjust(tx, { skuId: dto.skuId, warehouseId: dto.warehouseId, location, ...plan }, { userId: user.id, refLabel: label, note: dto.note });
      return tx.stockLevel.findUniqueOrThrow({ where: { id: row.id } });
    });
  }

  async setAlertLevel(skuId: string, dto: AlertLevelDto) {
    if (!(await this.prisma.sku.findUnique({ where: { id: skuId } }))) throw new NotFoundException('Variation not found');
    return this.prisma.sku.update({ where: { id: skuId }, data: { lowStockLevel: dto.lowStockLevel }, select: { id: true, lowStockLevel: true } });
  }

  // ---------- marketplace updates ----------

  pending(q: StockQuery) {
    const { page, pageSize, limit, offset } = paging(q);
    return this.paged(queries.marketplacePending({ ...q, limit, offset }), page, pageSize);
  }

  /** Records that the marketplaces were told the current numbers. */
  async markSent(skuIds?: string[]) {
    const rows = await this.run<{ skuId: string; available: number }>(queries.marketplacePending({ limit: 100000, offset: 0 }).rows);
    const chosen = skuIds ? rows.filter((r) => skuIds.includes(r.skuId)) : rows;
    await this.prisma.$transaction(chosen.map((r) => this.prisma.marketplaceSync.upsert({
      where: { skuId: r.skuId }, update: { syncedQty: Math.max(0, r.available), syncedAt: new Date() }, create: { skuId: r.skuId, syncedQty: Math.max(0, r.available) },
    })));
    return { marked: chosen.length };
  }

  async pendingFile() {
    const rows = await this.run<{ code: string; product: string; variation: string | null; available: number }>(queries.marketplacePending({ limit: 100000, offset: 0 }).rows);
    return rows;
  }
}

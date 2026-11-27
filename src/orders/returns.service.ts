import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/current-user.decorator';
import { nextNumber, padCode } from '../common/counter.util';
import { paging } from '../common/paging';
import { StockService } from '../inventory/stock.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReturnDto, InspectDto, ReturnQuery } from './dto/orders.dto';

@Injectable()
export class ReturnsService {
  constructor(private prisma: PrismaService, private stock: StockService) {}

  async list(user: AuthUser, q: ReturnQuery) {
    const { page, pageSize, limit, offset } = paging(q);
    const where = {
      ...(q.status ? { status: q.status as never } : {}),
      ...(user.role === 'SELLER' ? { sku: { product: { sellerId: user.sellerId ?? '__none__' } } } : {}),
      ...(q.search ? { OR: [{ code: { contains: q.search, mode: 'insensitive' as const } }, { sku: { code: { contains: q.search, mode: 'insensitive' as const } } }] } : {}),
    };
    const [rows, total, counts] = await Promise.all([
      this.prisma.returnRecord.findMany({
        where, orderBy: { receivedAt: 'desc' }, take: limit, skip: offset,
        include: { sku: { select: { code: true, product: { select: { name: true } } } }, order: { select: { number: true } }, orderItem: { select: { variationLabel: true } } },
      }),
      this.prisma.returnRecord.count({ where }),
      this.prisma.returnRecord.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    return {
      total, page, pageSize, counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
      rows: rows.map((r) => ({
        id: r.id, code: r.code, orderNumber: r.order?.number ?? null, sku: r.sku.code, product: r.sku.product.name, variation: r.orderItem?.variationLabel ?? '',
        qty: r.qty, reason: r.reason, status: r.status, inspectionNote: r.inspectionNote, receivedAt: r.receivedAt, location: r.location,
      })),
    };
  }

  /** A shipped parcel came back. The units wait for inspection before anything is sellable again. */
  async create(user: AuthUser, dto: CreateReturnDto) {
    const item = await this.prisma.orderItem.findUnique({ where: { id: dto.orderItemId }, include: { order: true } });
    if (!item) throw new NotFoundException('Order line not found');
    if (item.order.status !== 'SHIPPED') throw new BadRequestException('Only shipped orders can have returns');
    const already = await this.prisma.returnRecord.aggregate({ where: { orderItemId: item.id }, _sum: { qty: true } });
    const left = item.qty - (already._sum.qty ?? 0);
    if (dto.qty > left) throw new BadRequestException(`Only ${left} unit(s) of ${item.skuCode} can still be returned`);
    const id = await this.prisma.$transaction(async (tx) => {
      const code = padCode('R', await nextNumber(tx, 'return', 2000));
      const rec = await tx.returnRecord.create({
        data: { code, orderId: item.orderId, orderItemId: item.id, skuId: item.skuId, warehouseId: item.order.warehouseId, qty: dto.qty, reason: dto.reason, createdById: user.id },
      });
      await this.stock.returnIn(tx, { skuId: item.skuId, warehouseId: item.order.warehouseId, qty: dto.qty }, { userId: user.id, refLabel: code, note: dto.reason });
      await tx.orderEvent.create({ data: { orderId: item.orderId, action: 'RETURN_RECEIVED', note: `${code}: ${dto.qty} x ${item.skuCode}`, userId: user.id } });
      return rec.id;
    });
    return this.prisma.returnRecord.findUniqueOrThrow({ where: { id } });
  }

  /** Good: back on the shelf. Damaged: quarantine. Seller check: stays set aside until someone decides. */
  async inspect(user: AuthUser, id: string, dto: InspectDto) {
    const rec = await this.prisma.returnRecord.findUnique({ where: { id } });
    if (!rec) throw new NotFoundException('Return not found');
    if (!['TO_INSPECT', 'SELLER_CHECK'].includes(rec.status)) throw new BadRequestException('This return has already been inspected');
    const status = dto.outcome === 'RESTOCK' ? 'RESTOCKED' : dto.outcome === 'DAMAGED' ? 'DAMAGED' : 'SELLER_CHECK';
    if (status === rec.status) throw new BadRequestException('Nothing changed');
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.returnRecord.updateMany({
        where: { id, status: rec.status },
        data: { status, inspectionNote: dto.note, ...(status !== 'SELLER_CHECK' ? { inspectedAt: new Date(), inspectedById: user.id } : {}) },
      });
      if (!claimed.count) throw new BadRequestException('This return was changed by someone else. Reload and try again.');
      if (status !== 'SELLER_CHECK') {
        await this.stock.inspect(tx, { skuId: rec.skuId, warehouseId: rec.warehouseId, qty: rec.qty, good: status === 'RESTOCKED', location: rec.location }, { userId: user.id, refLabel: rec.code, note: dto.note });
      }
    });
    return this.prisma.returnRecord.findUniqueOrThrow({ where: { id } });
  }
}

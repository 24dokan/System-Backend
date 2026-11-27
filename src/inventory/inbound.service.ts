import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/current-user.decorator';
import { nextNumber, padCode } from '../common/counter.util';
import { paging } from '../common/paging';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInboundDto, InboundQuery, ReceiveDto } from './dto/inventory.dto';
import { StockService } from './stock.service';

@Injectable()
export class InboundService {
  constructor(private prisma: PrismaService, private stock: StockService) {}

  private include = {
    seller: { select: { id: true, name: true } }, warehouse: { select: { id: true, name: true } },
    lines: { include: { sku: { include: { product: { select: { name: true } }, values: { include: { optionValue: { include: { option: true } } } } } } } },
  } as const;

  private shape(s: any) {
    return {
      ...s,
      itemCount: s.lines.reduce((n: number, l: any) => n + l.expectedQty, 0),
      lines: s.lines.map((l: any) => ({
        id: l.id, skuId: l.skuId, code: l.sku.code, product: l.sku.product.name,
        variation: [...l.sku.values].sort((a: any, b: any) => a.optionValue.option.position - b.optionValue.option.position).map((v: any) => v.optionValue.value).join(' / '),
        expectedQty: l.expectedQty, receivedQty: l.receivedQty, damagedQty: l.damagedQty, location: l.location,
      })),
    };
  }

  async list(q: InboundQuery) {
    const { page, pageSize, limit, offset } = paging(q);
    const where = q.status ? { status: q.status as never } : {};
    const [rows, total] = await Promise.all([
      this.prisma.inboundShipment.findMany({ where, include: this.include, orderBy: [{ expectedDate: 'asc' }, { createdAt: 'desc' }], take: limit, skip: offset }),
      this.prisma.inboundShipment.count({ where }),
    ]);
    return { rows: rows.map((r) => this.shape(r)), total, page, pageSize };
  }

  async get(id: string) {
    const s = await this.prisma.inboundShipment.findUnique({ where: { id }, include: this.include });
    if (!s) throw new NotFoundException('Shipment not found');
    return this.shape(s);
  }

  async create(user: AuthUser, dto: CreateInboundDto) {
    const ids = dto.lines.map((l) => l.skuId);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('Each variation can appear only once in a shipment');
    const [seller, warehouse, skus] = await Promise.all([
      this.prisma.seller.findUnique({ where: { id: dto.sellerId } }),
      this.prisma.warehouse.findUnique({ where: { id: dto.warehouseId } }),
      this.prisma.sku.findMany({ where: { id: { in: ids } }, include: { product: { select: { sellerId: true } } } }),
    ]);
    if (!seller) throw new NotFoundException('Seller not found');
    if (!warehouse?.isActive) throw new BadRequestException('Warehouse not found or switched off');
    if (skus.length !== ids.length || skus.some((s) => s.product.sellerId !== dto.sellerId)) {
      throw new BadRequestException('Every variation must belong to the chosen seller');
    }
    const id = await this.prisma.$transaction(async (tx) => {
      const code = padCode('IN', await nextNumber(tx, 'inbound'));
      const s = await tx.inboundShipment.create({
        data: {
          code, sellerId: dto.sellerId, warehouseId: dto.warehouseId, expectedDate: new Date(dto.expectedDate), note: dto.note, createdById: user.id,
          lines: { create: dto.lines.map((l) => ({ skuId: l.skuId, expectedQty: l.expectedQty })) },
        },
      });
      return s.id;
    });
    return this.get(id);
  }

  /** Counts what arrived. Good units become sellable at the shelf given, damaged ones go to quarantine. */
  async receive(user: AuthUser, id: string, dto: ReceiveDto) {
    const shipment = await this.prisma.inboundShipment.findUnique({ where: { id }, include: { lines: true } });
    if (!shipment) throw new NotFoundException('Shipment not found');
    if (shipment.status !== 'EXPECTED') throw new BadRequestException(`This shipment is already ${shipment.status.toLowerCase()}`);
    const byId = new Map(shipment.lines.map((l) => [l.id, l]));
    for (const l of dto.lines) if (!byId.has(l.lineId)) throw new BadRequestException('A line does not belong to this shipment');
    await this.prisma.$transaction(async (tx) => {
      // Re-check inside the transaction so the same shipment cannot be received twice at once.
      const claimed = await tx.inboundShipment.updateMany({ where: { id, status: 'EXPECTED' }, data: { status: 'RECEIVED', receivedAt: new Date() } });
      if (claimed.count === 0) throw new BadRequestException('This shipment was already received');
      for (const l of dto.lines) {
        const line = byId.get(l.lineId)!;
        const location = (l.location ?? '').trim();
        await tx.inboundLine.update({ where: { id: line.id }, data: { receivedQty: l.receivedQty, damagedQty: l.damagedQty, location } });
        await this.stock.receive(tx, { skuId: line.skuId, warehouseId: shipment.warehouseId, location, good: l.receivedQty, damaged: l.damagedQty }, { userId: user.id, refLabel: shipment.code });
      }
    });
    return this.get(id);
  }

  async cancel(id: string) {
    const res = await this.prisma.inboundShipment.updateMany({ where: { id, status: 'EXPECTED' }, data: { status: 'CANCELLED' } });
    if (res.count === 0) throw new BadRequestException('Only an expected shipment can be cancelled');
    return this.get(id);
  }
}

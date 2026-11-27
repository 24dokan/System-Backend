import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { AuthUser } from '../common/current-user.decorator';
import { nextNumber, padCode } from '../common/counter.util';
import { StockService } from '../inventory/stock.service';
import { PrismaService } from '../prisma/prisma.service';

const NEXT: Record<string, { from: OrderStatus[]; to: OrderStatus; action: string; at?: 'packedAt' | 'shippedAt' }> = {
  pack: { from: ['TO_PACK'], to: 'PACKED', action: 'PACKED', at: 'packedAt' },
  ready: { from: ['PACKED'], to: 'WAITING_PICKUP', action: 'READY_FOR_PICKUP' },
};

@Injectable()
export class FulfilmentService {
  constructor(private prisma: PrismaService, private stock: StockService) {}

  /** Moves orders one step along: pack, then ready for pickup. Orders that cannot move are reported, not failed. */
  async advance(user: AuthUser, step: 'pack' | 'ready', ids: string[]) {
    const s = NEXT[step];
    const done: string[] = [];
    const skipped: { id: string; reason: string }[] = [];
    for (const id of ids) {
      const res = await this.prisma.$transaction(async (tx) => {
        const r = await tx.order.updateMany({ where: { id, status: { in: s.from } }, data: { status: s.to, ...(s.at ? { [s.at]: new Date() } : {}) } });
        if (r.count) await tx.orderEvent.create({ data: { orderId: id, action: s.action, userId: user.id } });
        return r.count;
      });
      if (res) done.push(id); else skipped.push({ id, reason: `Not in the right state for "${step}"` });
    }
    return { done: done.length, skipped };
  }

  /** Hands the parcel to the courier. The reserved units leave the shelf for good. */
  async ship(user: AuthUser, ids: string[]) {
    const done: string[] = [];
    const skipped: { id: string; reason: string }[] = [];
    for (const id of ids) {
      try {
        await this.prisma.$transaction(async (tx) => {
          const claimed = await tx.order.updateMany({ where: { id, status: { in: ['PACKED', 'WAITING_PICKUP'] } }, data: { status: 'SHIPPED', shippedAt: new Date() } });
          if (!claimed.count) throw new BadRequestException('Pack the order first');
          const o = await tx.order.findUniqueOrThrow({ where: { id }, include: { items: { select: { id: true } } } });
          await this.stock.ship(tx, o.items.map((i) => i.id), { userId: user.id, refLabel: `#${o.number}` });
          await tx.orderEvent.create({ data: { orderId: id, action: 'SHIPPED', userId: user.id } });
        });
        done.push(id);
      } catch (e) { skipped.push({ id, reason: (e as Error).message }); }
    }
    return { done: done.length, skipped };
  }

  /**
   * Cancels an order. Before packing the reserved stock simply becomes sellable again.
   * After packing the units are put aside for inspection (a return record is opened for each shelf).
   */
  async cancel(user: AuthUser, id: string, reason: string) {
    await this.prisma.$transaction(async (tx) => {
      const before = await tx.order.findUnique({ where: { id }, include: { items: { include: { allocations: { include: { stockLevel: true } } } } } });
      if (!before) throw new NotFoundException('Order not found');
      if (before.status === 'SHIPPED') throw new BadRequestException('This order has already shipped. Record a return instead.');
      if (before.status === 'CANCELLED') throw new BadRequestException('This order is already cancelled');
      const claimed = await tx.order.updateMany({ where: { id, status: { in: ['TO_PACK', 'PACKED', 'WAITING_PICKUP'] } }, data: { status: 'CANCELLED', cancelReason: reason, cancelledAt: new Date() } });
      if (!claimed.count) throw new BadRequestException('The order changed while you were cancelling it. Reload and try again.');
      const itemIds = before.items.map((i) => i.id);
      const ctx = { userId: user.id, refLabel: `#${before.number}`, note: reason };
      if (before.status === 'TO_PACK') {
        await this.stock.release(tx, itemIds, ctx);
      } else {
        for (const item of before.items) {
          for (const a of item.allocations) {
            const code = padCode('R', await nextNumber(tx, 'return', 2000));
            await tx.returnRecord.create({
              data: { code, orderId: id, orderItemId: item.id, skuId: item.skuId, warehouseId: before.warehouseId, qty: a.qty, location: a.stockLevel.location, reason: `Order cancelled after packing: ${reason}`, createdById: user.id },
            });
          }
        }
        await this.stock.toInspection(tx, itemIds, ctx);
      }
      await tx.orderEvent.create({ data: { orderId: id, action: 'CANCELLED', note: reason, userId: user.id } });
    });
    return { ok: true };
  }

  /** What to pick, grouped by shelf, for orders waiting to be packed. */
  async pickList(ids?: string[]) {
    const orders = await this.prisma.order.findMany({
      where: { status: 'TO_PACK', ...(ids?.length ? { id: { in: ids } } : {}) },
      orderBy: { number: 'asc' },
      include: { items: { include: { allocations: { include: { stockLevel: { select: { location: true } } } } } }, warehouse: { select: { name: true } } },
      take: 500,
    });
    const lines = new Map<string, { location: string; warehouse: string; skuCode: string; product: string; variation: string; qty: number; orders: number[] }>();
    for (const o of orders) {
      for (const i of o.items) {
        for (const a of i.allocations) {
          const key = `${o.warehouseId}|${a.stockLevel.location}|${i.skuCode}`;
          const l = lines.get(key) ?? { location: a.stockLevel.location, warehouse: o.warehouse.name, skuCode: i.skuCode, product: i.productName, variation: i.variationLabel, qty: 0, orders: [] };
          l.qty += a.qty;
          if (!l.orders.includes(o.number)) l.orders.push(o.number);
          lines.set(key, l);
        }
      }
    }
    const rows = [...lines.values()].sort((a, b) => a.warehouse.localeCompare(b.warehouse) || (a.location || '~').localeCompare(b.location || '~', undefined, { numeric: true }) || a.skuCode.localeCompare(b.skuCode));
    return { orderCount: orders.length, units: rows.reduce((n, r) => n + r.qty, 0), rows, orders: orders.map((o) => ({ id: o.id, number: o.number, customerName: o.customerName })) };
  }
}

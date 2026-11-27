import { ConflictException, Injectable } from '@nestjs/common';
import { MovementType, Prisma } from '@prisma/client';
import { planAllocation } from './stock.rules';

export type Tx = Prisma.TransactionClient;
export interface MoveContext { userId?: string; refLabel?: string; note?: string }
interface Deltas { onHand?: number; reserved?: number; quarantine?: number; inspection?: number }
interface Row { id: string; skuId: string; warehouseId: string; location: string }

/**
 * The only place that changes stock numbers. Every change happens inside the caller's transaction,
 * is checked afterwards (nothing negative, reserved never above on-hand), and writes one history row.
 * Two orders racing for the last unit cannot both succeed: the second one fails the check and rolls back.
 */
@Injectable()
export class StockService {
  /** Finds or creates the shelf row for a variation. */
  row(tx: Tx, skuId: string, warehouseId: string, location = ''): Promise<Row> {
    return tx.stockLevel.upsert({
      where: { skuId_warehouseId_location: { skuId, warehouseId, location } },
      update: {},
      create: { skuId, warehouseId, location },
      select: { id: true, skuId: true, warehouseId: true, location: true },
    });
  }

  private async apply(tx: Tx, row: Row, d: Deltas, type: MovementType, ctx: MoveContext) {
    const u = await tx.stockLevel.update({
      where: { id: row.id },
      data: {
        onHand: { increment: d.onHand ?? 0 }, reserved: { increment: d.reserved ?? 0 },
        quarantine: { increment: d.quarantine ?? 0 }, inspection: { increment: d.inspection ?? 0 },
      },
    });
    if (u.onHand < 0 || u.reserved < 0 || u.quarantine < 0 || u.inspection < 0 || u.reserved > u.onHand) {
      throw new ConflictException('Stock changed while saving, or there is not enough stock. Reload and try again.');
    }
    await tx.stockMovement.create({
      data: {
        skuId: row.skuId, warehouseId: row.warehouseId, location: row.location, type,
        onHandDelta: d.onHand ?? 0, reservedDelta: d.reserved ?? 0, quarantineDelta: d.quarantine ?? 0, inspectionDelta: d.inspection ?? 0,
        onHandAfter: u.onHand, refLabel: ctx.refLabel, note: ctx.note, userId: ctx.userId,
      },
    });
    return u;
  }

  /** A shipment arrived: good units become sellable, damaged ones go to quarantine. */
  async receive(tx: Tx, p: { skuId: string; warehouseId: string; location: string; good: number; damaged: number }, ctx: MoveContext) {
    const row = await this.row(tx, p.skuId, p.warehouseId, p.location);
    if (p.good > 0) await this.apply(tx, row, { onHand: p.good }, 'RECEIVED', ctx);
    if (p.damaged > 0) await this.apply(tx, row, { quarantine: p.damaged }, 'DAMAGED', { ...ctx, note: ctx.note ?? 'Damaged on arrival' });
  }

  /** Changes on-hand (and optionally quarantine) for a count correction, loss, damage or expiry. */
  async adjust(tx: Tx, p: { skuId: string; warehouseId: string; location: string; onHand: number; quarantine: number }, ctx: MoveContext) {
    const row = await this.row(tx, p.skuId, p.warehouseId, p.location);
    await this.apply(tx, row, { onHand: p.onHand, quarantine: p.quarantine }, p.quarantine ? 'DAMAGED' : 'ADJUSTED', ctx);
  }

  /** Sets stock aside for an order line. Returns where it will be picked from. Throws if there is not enough. */
  async reserve(tx: Tx, p: { orderItemId: string; skuId: string; warehouseId: string; qty: number; label: string }, ctx: MoveContext) {
    const rows = await tx.stockLevel.findMany({ where: { skuId: p.skuId, warehouseId: p.warehouseId }, select: { id: true, location: true, onHand: true, reserved: true } });
    const plan = planAllocation(rows, p.qty);
    if (plan.short > 0) {
      throw new ConflictException(`Not enough stock for ${p.label}: ${p.qty - plan.short} available, ${p.qty} needed`);
    }
    for (const a of plan.allocations) {
      const r = rows.find((x) => x.id === a.stockLevelId)!;
      await this.apply(tx, { id: r.id, skuId: p.skuId, warehouseId: p.warehouseId, location: r.location }, { reserved: a.qty }, 'RESERVED', ctx);
      await tx.stockAllocation.create({ data: { orderItemId: p.orderItemId, stockLevelId: r.id, qty: a.qty } });
    }
  }

  private allocations(tx: Tx, orderItemIds: string[]) {
    return tx.stockAllocation.findMany({ where: { orderItemId: { in: orderItemIds } }, include: { stockLevel: true } });
  }

  /** Order cancelled before packing: the reserved units become sellable again. */
  async release(tx: Tx, orderItemIds: string[], ctx: MoveContext) {
    for (const a of await this.allocations(tx, orderItemIds)) {
      await this.apply(tx, a.stockLevel, { reserved: -a.qty }, 'RELEASED', ctx);
    }
    await tx.stockAllocation.deleteMany({ where: { orderItemId: { in: orderItemIds } } });
  }

  /** Order shipped: the reserved units physically leave. */
  async ship(tx: Tx, orderItemIds: string[], ctx: MoveContext) {
    for (const a of await this.allocations(tx, orderItemIds)) {
      await this.apply(tx, a.stockLevel, { onHand: -a.qty, reserved: -a.qty }, 'SHIPPED', ctx);
    }
    await tx.stockAllocation.deleteMany({ where: { orderItemId: { in: orderItemIds } } });
  }

  /** Order cancelled after packing: units go back on the shelf but must be checked before they can be sold again. */
  async toInspection(tx: Tx, orderItemIds: string[], ctx: MoveContext) {
    for (const a of await this.allocations(tx, orderItemIds)) {
      await this.apply(tx, a.stockLevel, { onHand: -a.qty, reserved: -a.qty, inspection: a.qty }, 'RETURNED', ctx);
    }
    await tx.stockAllocation.deleteMany({ where: { orderItemId: { in: orderItemIds } } });
  }

  /** A customer return arrives and waits for inspection. */
  async returnIn(tx: Tx, p: { skuId: string; warehouseId: string; qty: number; location?: string }, ctx: MoveContext) {
    const row = await this.row(tx, p.skuId, p.warehouseId, p.location ?? '');
    await this.apply(tx, row, { inspection: p.qty }, 'RETURNED', ctx);
  }

  /** Inspection result: good units are sellable again, damaged ones go to quarantine. */
  async inspect(tx: Tx, p: { skuId: string; warehouseId: string; qty: number; good: boolean; location: string }, ctx: MoveContext) {
    const row = await this.row(tx, p.skuId, p.warehouseId, p.location);
    if (p.good) await this.apply(tx, row, { inspection: -p.qty, onHand: p.qty }, 'RESTOCKED', ctx);
    else await this.apply(tx, row, { inspection: -p.qty, quarantine: p.qty }, 'DAMAGED', ctx);
  }
}

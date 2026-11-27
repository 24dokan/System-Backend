export interface ShelfRow { id: string; location: string; onHand: number; reserved: number }

/** Sellable units on a shelf row. */
export const availableOf = (r: { onHand: number; reserved: number }) => r.onHand - r.reserved;

/**
 * Decides which shelf rows to take stock from for an order line.
 * Fills from the rows with the most sellable stock first, so one order line is picked from as few places as possible.
 * `short` is how many units could not be covered.
 */
export function planAllocation(rows: ShelfRow[], qty: number): { allocations: { stockLevelId: string; qty: number }[]; short: number } {
  const sorted = [...rows].filter((r) => availableOf(r) > 0).sort((a, b) => availableOf(b) - availableOf(a) || a.location.localeCompare(b.location));
  const allocations: { stockLevelId: string; qty: number }[] = [];
  let need = qty;
  for (const r of sorted) {
    if (need <= 0) break;
    const take = Math.min(need, availableOf(r));
    allocations.push({ stockLevelId: r.id, qty: take });
    need -= take;
  }
  return { allocations, short: Math.max(0, need) };
}

export type AdjustReason = 'COUNT' | 'LOST' | 'DAMAGED' | 'EXPIRED' | 'OTHER';

/**
 * Turns an adjustment request into changes on a shelf row.
 * COUNT sets on-hand to the counted number. LOST and EXPIRED remove units. DAMAGED moves units to quarantine.
 * OTHER applies a signed change. Returns an error message instead when the input does not fit the reason.
 */
export function planAdjustment(
  reason: AdjustReason, current: { onHand: number; reserved: number },
  input: { countedQty?: number; quantity?: number; change?: number },
): { onHand: number; quarantine: number } | string {
  let onHand = 0;
  let quarantine = 0;
  switch (reason) {
    case 'COUNT':
      if (input.countedQty === undefined || input.countedQty < 0) return 'Enter the counted quantity';
      onHand = input.countedQty - current.onHand;
      break;
    case 'LOST':
    case 'EXPIRED':
    case 'DAMAGED':
      if (!input.quantity || input.quantity <= 0) return 'Enter how many units';
      onHand = -input.quantity;
      if (reason === 'DAMAGED') quarantine = input.quantity;
      break;
    case 'OTHER':
      if (!input.change) return 'Enter the change (use a minus sign to remove stock)';
      onHand = input.change;
      break;
  }
  if (current.onHand + onHand < current.reserved) {
    return `${current.reserved} unit(s) are reserved for open orders, so on hand cannot go below that`;
  }
  if (current.onHand + onHand < 0) return 'On hand cannot go below zero';
  return { onHand, quarantine };
}

/** Variations that should appear in "low stock": sellable stock is at or below the alert level. */
export const isLowStock = (available: number, alertLevel: number) => available <= alertLevel;

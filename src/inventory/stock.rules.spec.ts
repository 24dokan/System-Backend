import { isLowStock, planAdjustment, planAllocation } from './stock.rules';

describe('planAllocation', () => {
  const rows = [
    { id: 'a', location: 'A-1', onHand: 5, reserved: 4 },
    { id: 'b', location: 'B-1', onHand: 10, reserved: 0 },
    { id: 'c', location: 'C-1', onHand: 3, reserved: 3 },
  ];
  it('takes from the row with the most sellable stock first', () =>
    expect(planAllocation(rows, 4)).toEqual({ allocations: [{ stockLevelId: 'b', qty: 4 }], short: 0 }));
  it('spreads across rows when one is not enough', () =>
    expect(planAllocation(rows, 11)).toEqual({ allocations: [{ stockLevelId: 'b', qty: 10 }, { stockLevelId: 'a', qty: 1 }], short: 0 }));
  it('reports how many units are missing', () => expect(planAllocation(rows, 12).short).toBe(1));
  it('ignores reserved and empty rows', () => expect(planAllocation([rows[2]], 1)).toEqual({ allocations: [], short: 1 }));
});

describe('planAdjustment', () => {
  const cur = { onHand: 8, reserved: 5 };
  it('sets stock to a counted number', () => expect(planAdjustment('COUNT', cur, { countedQty: 7 })).toEqual({ onHand: -1, quarantine: 0 }));
  it('moves damaged units to quarantine', () => expect(planAdjustment('DAMAGED', cur, { quantity: 2 })).toEqual({ onHand: -2, quarantine: 2 }));
  it('removes lost units without quarantine', () => expect(planAdjustment('LOST', cur, { quantity: 1 })).toEqual({ onHand: -1, quarantine: 0 }));
  it('refuses to go below the reserved quantity', () => expect(planAdjustment('COUNT', cur, { countedQty: 4 })).toMatch(/reserved/));
  it('refuses missing input', () => {
    expect(planAdjustment('COUNT', cur, {})).toMatch(/counted/);
    expect(planAdjustment('LOST', cur, {})).toMatch(/how many/);
    expect(planAdjustment('OTHER', cur, { change: 0 })).toMatch(/change/);
  });
  it('allows adding stock with OTHER', () => expect(planAdjustment('OTHER', cur, { change: 3 })).toEqual({ onHand: 3, quarantine: 0 }));
});

describe('isLowStock', () => {
  it('is true at or below the alert level', () => {
    expect(isLowStock(10, 10)).toBe(true);
    expect(isLowStock(11, 10)).toBe(false);
  });
});

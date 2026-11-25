import { defaultMaxSkus, withinLimit } from './limits.util';

describe('limits', () => {
  it('SKU cap defaults to 10x products', () => {
    expect(defaultMaxSkus(100)).toBe(1000);
    expect(defaultMaxSkus(null)).toBeNull();
    expect(defaultMaxSkus(undefined)).toBeNull();
  });
  it('allows up to and including the limit', () => {
    expect(withinLimit(100, 99, 1)).toBe(true);
    expect(withinLimit(100, 100, 1)).toBe(false);
    expect(withinLimit(100, 90, 11)).toBe(false);
  });
  it('null means unlimited', () => expect(withinLimit(null, 1_000_000, 5)).toBe(true));
});

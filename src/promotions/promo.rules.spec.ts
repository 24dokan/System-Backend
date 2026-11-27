import { checkPromotion, isLive, overlaps, salePrice } from './promo.rules';

const d = (s: string) => new Date(s);
describe('promotion rules', () => {
  it('prices', () => {
    expect(salePrice(10000, { type: 'PERCENT', value: 15 })).toBe(8500);
    expect(salePrice(990, { type: 'PERCENT', value: 10 })).toBe(891);
    expect(salePrice(1000, { type: 'FIXED', value: 300 })).toBe(700);
    expect(salePrice(100, { type: 'FIXED', value: 500 })).toBe(0);
  });
  it('is live only when approved and inside the dates', () => {
    const p = { type: 'PERCENT' as const, value: 10, startsAt: d('2026-12-01'), endsAt: d('2026-12-10'), status: 'APPROVED' };
    expect(isLive(p, d('2026-12-05'))).toBe(true);
    expect(isLive(p, d('2026-12-10'))).toBe(false);
    expect(isLive({ ...p, status: 'PENDING' }, d('2026-12-05'))).toBe(false);
  });
  it('validates', () => {
    const now = d('2026-11-27');
    const ok = { type: 'PERCENT', value: 20, startsAt: d('2026-12-01'), endsAt: d('2026-12-05') };
    expect(checkPromotion(ok, 1000, now)).toBeNull();
    expect(checkPromotion({ ...ok, value: 95 }, 1000, now)).toMatch(/1 to 90/);
    expect(checkPromotion({ ...ok, type: 'FIXED', value: 1000 }, 1000, now)).toMatch(/less than/);
    expect(checkPromotion({ ...ok, endsAt: d('2026-11-30'), startsAt: d('2026-12-01') }, 1000, now)).toMatch(/after the start/);
    expect(checkPromotion({ ...ok, startsAt: d('2026-11-01'), endsAt: d('2026-11-20') }, 1000, now)).toMatch(/past/);
  });
  it('detects overlap', () => {
    expect(overlaps({ startsAt: d('2026-12-01'), endsAt: d('2026-12-05') }, { startsAt: d('2026-12-05'), endsAt: d('2026-12-07') })).toBe(false);
    expect(overlaps({ startsAt: d('2026-12-01'), endsAt: d('2026-12-05') }, { startsAt: d('2026-12-04'), endsAt: d('2026-12-07') })).toBe(true);
  });
});

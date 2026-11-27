export interface PromoLike { type: 'PERCENT' | 'FIXED'; value: number; startsAt: Date; endsAt: Date; status: string }

/** Price after the discount, in sen. Never below zero, and the discount never changes the original price. */
export function salePrice(priceMinor: number, p: Pick<PromoLike, 'type' | 'value'>): number {
  const off = p.type === 'PERCENT' ? Math.round((priceMinor * p.value) / 100) : p.value;
  return Math.max(0, priceMinor - off);
}

export const isLive = (p: PromoLike, now = new Date()) => p.status === 'APPROVED' && p.startsAt <= now && now < p.endsAt;

/** Returns an error message, or null when the promotion can be saved. `lowestPriceMinor` is the cheapest variation it covers. */
export function checkPromotion(p: { type: string; value: number; startsAt: Date; endsAt: Date }, lowestPriceMinor: number, now = new Date()): string | null {
  if (!(p.startsAt < p.endsAt)) return 'The end date must be after the start date';
  if (p.endsAt <= now) return 'The end date is in the past';
  if ((p.endsAt.getTime() - p.startsAt.getTime()) / 86400_000 > 366) return 'A promotion can run for at most one year';
  if (p.type === 'PERCENT') return Number.isInteger(p.value) && p.value >= 1 && p.value <= 90 ? null : 'Percent off must be a whole number from 1 to 90';
  if (p.type === 'FIXED') return Number.isInteger(p.value) && p.value >= 1 && p.value < lowestPriceMinor ? null : 'The amount off must be more than zero and less than the lowest price';
  return 'Unknown discount type';
}

export const overlaps = (a: { startsAt: Date; endsAt: Date }, b: { startsAt: Date; endsAt: Date }) => a.startsAt < b.endsAt && b.startsAt < a.endsAt;

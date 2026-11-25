/** Statuses that count against a seller's package limits. Drafts and rejected products do not. */
export const COUNTED_PRODUCT_STATUSES = ['PENDING', 'APPROVED', 'PENDING_REVISION'] as const;

/** Default SKU cap: 10 x the product cap. null stays unlimited. */
export function defaultMaxSkus(maxProducts: number | null | undefined): number | null {
  return maxProducts == null ? null : maxProducts * 10;
}

/** limit null = unlimited. Returns true when current + adding stays within the limit. */
export function withinLimit(limit: number | null, current: number, adding: number): boolean {
  return limit === null || current + adding <= limit;
}

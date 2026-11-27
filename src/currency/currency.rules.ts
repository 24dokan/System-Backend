export const BASE_CURRENCY = 'MYR';
/** Currencies the system knows about. Only MYR is used for now. */
export const CURRENCIES = [
  { code: 'MYR', name: 'Malaysian ringgit', symbol: 'RM', decimals: 2 },
  { code: 'SGD', name: 'Singapore dollar', symbol: 'S$', decimals: 2 },
  { code: 'USD', name: 'US dollar', symbol: '$', decimals: 2 },
  { code: 'IDR', name: 'Indonesian rupiah', symbol: 'Rp', decimals: 0 },
  { code: 'THB', name: 'Thai baht', symbol: '฿', decimals: 2 },
  { code: 'CNY', name: 'Chinese yuan', symbol: '¥', decimals: 2 },
] as const;

export const isKnownCurrency = (c: string) => CURRENCIES.some((x) => x.code === c);

/** Converts an amount in sen of `from` into the base currency, using the rate of 1 unit of `from` in base. Rounds to the nearest sen. */
export function toBase(amountMinor: number, rateToBase: number): number {
  return Math.round(amountMinor * rateToBase);
}
export function fromBase(amountMinor: number, rateToBase: number): number {
  if (!(rateToBase > 0)) throw new Error('Exchange rate must be above zero');
  return Math.round(amountMinor / rateToBase);
}

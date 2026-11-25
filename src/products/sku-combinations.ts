/** Cartesian product of option-value id lists. No options gives one empty combination (the default SKU). */
export function cartesian(lists: string[][]): string[][] {
  return lists.reduce<string[][]>((acc, list) => acc.flatMap((combo) => list.map((v) => [...combo, v])), [[]]);
}

/** Order-independent key for a combination of option-value ids. */
export function comboKey(ids: string[]): string {
  return [...ids].sort().join('|');
}

export const MAX_COMBINATIONS = 500;

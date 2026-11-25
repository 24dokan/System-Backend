export function money(minor: number | null | undefined, currency = 'MYR') {
  if (minor === null || minor === undefined) return '-';
  return new Intl.NumberFormat('en-MY', { style: 'currency', currency }).format(minor / 100);
}
/** "59.90" -> 5990. Returns null when not a valid amount. */
export function toMinor(input: string): number | null {
  const n = Number(input.trim());
  return input.trim() !== '' && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}
export const fromMinor = (m: number) => (m / 100).toFixed(2);
export const date = (s?: string | null) => (s ? new Date(s).toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' }) : '-');

/** Flattens the category tree into "Parent > Child" options. */
export function flattenCategories(tree: any[], prefix = ''): { id: string; label: string; depth: number; node: any }[] {
  return tree.flatMap((c) => {
    const label = prefix ? `${prefix} > ${c.name}` : c.name;
    return [{ id: c.id, label, depth: prefix ? prefix.split(' > ').length : 0, node: c }, ...flattenCategories(c.children ?? [], label)];
  });
}

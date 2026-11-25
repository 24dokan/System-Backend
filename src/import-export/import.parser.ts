import { slugify } from '../common/slugify';

export const OPTION_SLOTS = 5;
export const MAX_ROWS = 2000;
export const MAX_SKUS_PER_PRODUCT = 500;

export const COLUMNS = [
  'product_key', 'name', 'description', 'category',
  ...Array.from({ length: OPTION_SLOTS }, (_, i) => [`option${i + 1}_name`, `option${i + 1}_value`]).flat(),
  'sku_code', 'price',
];
export const REQUIRED_COLUMNS = ['product_key', 'name', 'category', 'price'];

export interface ParsedProduct {
  key: string;
  name: string;
  description?: string;
  categoryId: string;
  options: { name: string; values: string[] }[];
  skus: { code?: string; priceMinor: number; values: string[] }[];
  rows: number[];
}
export interface RejectedGroup { key: string | null; rows: number[]; errors: string[] }

/** "59.90" -> 5990. Returns null for anything that is not a plain non-negative amount with at most 2 decimals. */
export function parsePrice(raw: string): number | null {
  const m = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(raw.trim());
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0') || 0);
}

export type CategoryResolver = (input: string) => { id: string } | { error: string };

/** Matches "Parent > Child" paths, a unique leaf name, or an id. Case-insensitive. */
export function makeCategoryResolver(cats: { id: string; name: string; parentId: string | null }[]): CategoryResolver {
  const byId = new Map(cats.map((c) => [c.id, c]));
  const pathOf = (id: string): string => {
    const c = byId.get(id)!;
    return c.parentId && byId.has(c.parentId) ? `${pathOf(c.parentId)} > ${c.name}` : c.name;
  };
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s*>\s*/g, ' > ');
  const paths = new Map<string, string>();
  const leaves = new Map<string, string[]>();
  for (const c of cats) {
    paths.set(norm(pathOf(c.id)), c.id);
    const k = norm(c.name);
    leaves.set(k, [...(leaves.get(k) ?? []), c.id]);
  }
  return (input) => {
    const k = norm(input);
    if (byId.has(input.trim())) return { id: input.trim() };
    const p = paths.get(k);
    if (p) return { id: p };
    const l = leaves.get(k);
    if (l?.length === 1) return { id: l[0] };
    if (l && l.length > 1) return { error: `Category "${input}" is ambiguous. Use the full path, e.g. "Parent > Child"` };
    return { error: `Category "${input}" not found` };
  };
}

const CODE_RE = /^[A-Za-z0-9._-]{2,80}$/;

/** Groups rows (one per SKU) by product_key and validates each group. Row numbers are CSV line numbers (header = 1). */
export function buildProducts(rows: Record<string, string>[], resolve: CategoryResolver) {
  const valid: ParsedProduct[] = [];
  const rejected: RejectedGroup[] = [];
  const groups = new Map<string, { row: number; r: Record<string, string> }[]>();

  rows.forEach((raw, i) => {
    const r = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, (v ?? '').trim()]));
    const row = i + 2;
    if (!r.product_key) {
      rejected.push({ key: null, rows: [row], errors: ['product_key is empty'] });
      return;
    }
    groups.set(r.product_key, [...(groups.get(r.product_key) ?? []), { row, r }]);
  });

  for (const [key, items] of groups) {
    const errors: string[] = [];
    const err = (row: number, msg: string) => errors.push(`Row ${row}: ${msg}`);
    const first = items[0];
    const lineNos = items.map((x) => x.row);

    const name = first.r.name;
    if (name.length < 2 || name.length > 200) err(first.row, 'name must be 2 to 200 characters');
    const cat = first.r.category ? resolve(first.r.category) : { error: 'category is empty' };
    if ('error' in cat) err(first.row, cat.error);
    if (items.length > MAX_SKUS_PER_PRODUCT) errors.push(`More than ${MAX_SKUS_PER_PRODUCT} variations for one product`);

    // Option names come from the first row. Every row must give a value for each of them.
    const optionNames: { slot: number; name: string }[] = [];
    for (let s = 1; s <= OPTION_SLOTS; s++) {
      const n = first.r[`option${s}_name`];
      if (n) optionNames.push({ slot: s, name: n });
    }
    if (new Set(optionNames.map((o) => o.name.toLowerCase())).size !== optionNames.length) {
      err(first.row, 'option names must be unique');
    }

    const seenCombos = new Set<string>();
    const skus: ParsedProduct['skus'] = [];
    for (const { row, r } of items) {
      if (row !== first.row) {
        if (r.name && r.name !== name) err(row, 'name differs from the first row of this product');
        if (r.category && r.category !== first.r.category) err(row, 'category differs from the first row of this product');
      }
      for (let s = 1; s <= OPTION_SLOTS; s++) {
        const declared = optionNames.find((o) => o.slot === s);
        if (!declared && (r[`option${s}_value`] || (row !== first.row && r[`option${s}_name`]))) {
          err(row, `option${s} is not declared on the first row of this product`);
        }
        if (declared && r[`option${s}_name`] && r[`option${s}_name`].toLowerCase() !== declared.name.toLowerCase()) {
          err(row, `option${s}_name differs from the first row`);
        }
      }
      const values = optionNames.map((o) => r[`option${o.slot}_value`]);
      if (values.some((v) => !v)) err(row, 'every option needs a value');
      const ck = values.map((v) => v.toLowerCase()).join('|');
      if (seenCombos.has(ck)) err(row, 'duplicate variation (same option values)');
      seenCombos.add(ck);

      const priceMinor = parsePrice(r.price);
      if (priceMinor === null || priceMinor <= 0) err(row, 'price must be a positive amount with at most 2 decimals, e.g. 59.90');
      if (r.sku_code && !CODE_RE.test(r.sku_code)) err(row, 'sku_code may only use letters, digits, dot, dash, underscore (2 to 80 characters)');
      skus.push({ code: r.sku_code ? r.sku_code.toUpperCase() : undefined, priceMinor: priceMinor ?? 0, values });
    }
    // Without options there can only be one variation.
    if (!optionNames.length && items.length > 1) errors.push('A product without options can only have one row');

    if (errors.length || 'error' in cat) {
      rejected.push({ key, rows: lineNos, errors });
      continue;
    }
    valid.push({
      key, name, description: first.r.description || undefined, categoryId: cat.id,
      options: optionNames.map((o, idx) => ({
        name: o.name,
        values: [...new Map(skus.map((s) => [s.values[idx].toLowerCase(), s.values[idx]])).values()],
      })),
      skus, rows: lineNos,
    });
  }

  // The same explicit sku_code in two products: reject the later product.
  const owner = new Map<string, string>();
  const finalValid: ParsedProduct[] = [];
  for (const p of valid) {
    const dup = p.skus.find((s) => s.code && owner.has(s.code) && owner.get(s.code) !== p.key);
    if (dup) {
      rejected.push({ key: p.key, rows: p.rows, errors: [`sku_code ${dup.code} is already used by product "${owner.get(dup.code!)}" in this file`] });
      continue;
    }
    p.skus.forEach((s) => s.code && owner.set(s.code, p.key));
    finalValid.push(p);
  }
  return { valid: finalValid, rejected };
}

/** Suggested code for a SKU that has none. */
export function suggestCode(product: string, values: string[]): string {
  return [slugify(product).slice(0, 30), ...values.map((v) => slugify(v))].join('-').toUpperCase();
}

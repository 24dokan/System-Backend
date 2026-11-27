/**
 * Reads the bulk order CSV. One row per order line. Rows with the same source and order_ref form one order.
 * Pure logic: SKU codes are looked up later by the service.
 */
import { parsePrice } from '../import-export/import.parser';

export const ORDER_COLUMNS = ['source', 'order_ref', 'customer_name', 'phone', 'address', 'sku_code', 'qty', 'unit_price', 'shipping', 'discount', 'note'];
export const ORDER_REQUIRED = ['source', 'order_ref', 'customer_name', 'address', 'sku_code', 'qty'];
export const MAX_ORDER_ROWS = 2000;
const SOURCES = ['SHOPEE', 'LAZADA', 'TIKTOK', 'STOREFRONT', 'OTHER'];

export interface ParsedOrder {
  source: string; externalRef: string; customerName: string; customerPhone?: string; address: string;
  shippingMinor: number; discountMinor: number; note?: string;
  lines: { skuCode: string; qty: number; unitPriceMinor?: number }[]; rows: number[];
}
export interface RejectedOrder { ref: string | null; rows: number[]; errors: string[] }

export function buildOrders(rows: Record<string, string>[]) {
  const groups = new Map<string, { row: number; r: Record<string, string> }[]>();
  const rejected: RejectedOrder[] = [];
  rows.forEach((r, i) => {
    const row = i + 2; // row 1 is the header
    const source = (r.source ?? '').trim().toUpperCase();
    const ref = (r.order_ref ?? '').trim();
    if (!ref || !SOURCES.includes(source)) {
      rejected.push({ ref: ref || null, rows: [row], errors: [!ref ? 'order_ref is empty' : `source must be one of ${SOURCES.join(', ')}`] });
      return;
    }
    const key = `${source}|${ref}`;
    groups.set(key, [...(groups.get(key) ?? []), { row, r }]);
  });

  const valid: ParsedOrder[] = [];
  for (const [key, list] of groups) {
    const [source, ref] = key.split('|');
    const errors: string[] = [];
    const first = list[0].r;
    const text = (k: string) => (first[k] ?? '').trim();
    if (!text('customer_name')) errors.push('customer_name is empty');
    if (text('address').length < 5) errors.push('address is empty or too short');
    const money = (k: string): number => {
      const raw = text(k);
      if (!raw) return 0;
      const v = parsePrice(raw);
      if (v === null) { errors.push(`${k} "${raw}" is not an amount like 12.50`); return 0; }
      return v;
    };
    const shippingMinor = money('shipping');
    const discountMinor = money('discount');
    const lines: ParsedOrder['lines'] = [];
    const seen = new Set<string>();
    for (const { row, r } of list) {
      const code = (r.sku_code ?? '').trim();
      const qty = Number((r.qty ?? '').trim());
      if (!code) { errors.push(`Row ${row}: sku_code is empty`); continue; }
      if (!Number.isInteger(qty) || qty < 1 || qty > 10000) { errors.push(`Row ${row}: qty must be a whole number from 1 to 10000`); continue; }
      if (seen.has(code.toLowerCase())) { errors.push(`Row ${row}: ${code} appears twice in this order. Combine them into one row.`); continue; }
      seen.add(code.toLowerCase());
      let unitPriceMinor: number | undefined;
      const rawPrice = (r.unit_price ?? '').trim();
      if (rawPrice) {
        const p = parsePrice(rawPrice);
        if (p === null) { errors.push(`Row ${row}: unit_price "${rawPrice}" is not an amount like 12.50`); continue; }
        unitPriceMinor = p;
      }
      lines.push({ skuCode: code, qty, unitPriceMinor });
    }
    const rowNumbers = list.map((x) => x.row);
    if (errors.length) { rejected.push({ ref, rows: rowNumbers, errors }); continue; }
    valid.push({
      source, externalRef: ref, customerName: text('customer_name'), customerPhone: text('phone') || undefined, address: text('address'),
      shippingMinor, discountMinor, note: text('note') || undefined, lines, rows: rowNumbers,
    });
  }
  return { valid, rejected };
}

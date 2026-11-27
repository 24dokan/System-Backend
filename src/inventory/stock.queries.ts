/**
 * Stock reports are summed across shelves in SQL. Values always go in as numbered parameters ($1, $2 ...),
 * never into the text, so nothing a user types can change the query.
 */
export interface Query { text: string; params: unknown[] }

const VARIATION = `(SELECT string_agg(v."value", ' / ' ORDER BY o."position")
  FROM "SkuOptionValue" sv JOIN "ProductOptionValue" v ON v."id" = sv."optionValueId" JOIN "ProductOption" o ON o."id" = v."optionId"
  WHERE sv."skuId" = s."id")`;

const SELLABLE = `('APPROVED', 'PENDING_REVISION')`; // product statuses that can have stock

class Params {
  list: unknown[] = [];
  add(v: unknown) { this.list.push(v); return `$${this.list.length}`; }
}

export interface StockFilter { search?: string; sellerId?: string; warehouseId?: string }
const like = (s: string) => `%${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

function conditions(f: StockFilter, p: Params, opts: { shelfJoinCondition?: boolean } = {}) {
  const where: string[] = [];
  if (f.search?.trim()) { const x = p.add(like(f.search.trim())); where.push(`(s."code" ILIKE ${x} OR p."name" ILIKE ${x})`); }
  if (f.sellerId) where.push(`p."sellerId" = ${p.add(f.sellerId)}`);
  if (f.warehouseId && !opts.shelfJoinCondition) where.push(`l."warehouseId" = ${p.add(f.warehouseId)}`);
  return where;
}

const page = (p: Params, limit: number, offset: number) => `LIMIT ${p.add(limit)} OFFSET ${p.add(offset)}`;

/** One row per variation and warehouse that holds stock (admin stock overview). */
export function overview(f: StockFilter & { lowOnly?: boolean; limit: number; offset: number }): { rows: Query; count: Query } {
  const p = new Params();
  const where = conditions(f, p);
  const base = `FROM "StockLevel" l
    JOIN "Sku" s ON s."id" = l."skuId" JOIN "Product" p ON p."id" = s."productId" JOIN "Seller" se ON se."id" = p."sellerId"
    JOIN "Warehouse" w ON w."id" = l."warehouseId"
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    GROUP BY s."id", p."id", se."id", w."id"
    ${f.lowOnly ? `HAVING SUM(l."onHand") - SUM(l."reserved") <= s."lowStockLevel"` : ''}`;
  const select = `SELECT s."id" AS "skuId", s."code", p."id" AS "productId", p."name" AS "product", ${VARIATION} AS "variation",
      se."name" AS "seller", w."id" AS "warehouseId", w."name" AS "warehouse", s."lowStockLevel",
      SUM(l."onHand")::int AS "onHand", SUM(l."reserved")::int AS "reserved", SUM(l."quarantine")::int AS "quarantine",
      SUM(l."inspection")::int AS "inspection", (SUM(l."onHand") - SUM(l."reserved"))::int AS "available"`;
  const countParams = [...p.list];
  const rows = { text: `${select} ${base} ORDER BY p."name", s."code", w."name" ${page(p, f.limit, f.offset)}`, params: p.list };
  return { rows, count: { text: `SELECT COUNT(*)::int AS "total" FROM (SELECT s."id" ${base}) t`, params: countParams } };
}

/** One row per variation, summed over warehouses. Includes variations with no stock yet. */
function perSku(f: StockFilter, extra: { sellerOnly?: boolean }) {
  const p = new Params();
  const join = f.warehouseId ? `AND l."warehouseId" = ${p.add(f.warehouseId)}` : '';
  const where = [`p."status"::text IN ${SELLABLE}`, `s."isActive" = true`, ...conditions(f, p, { shelfJoinCondition: true })];
  const base = `FROM "Sku" s JOIN "Product" p ON p."id" = s."productId" JOIN "Seller" se ON se."id" = p."sellerId"
    LEFT JOIN "StockLevel" l ON l."skuId" = s."id" ${join}
    LEFT JOIN "MarketplaceSync" m ON m."skuId" = s."id"
    WHERE ${where.join(' AND ')}
    GROUP BY s."id", p."id", se."id", m."skuId"`;
  const select = `SELECT s."id" AS "skuId", s."code", p."id" AS "productId", p."name" AS "product", ${VARIATION} AS "variation",
      se."name" AS "seller", s."lowStockLevel",
      COALESCE(SUM(l."onHand"), 0)::int AS "onHand", COALESCE(SUM(l."reserved"), 0)::int AS "reserved",
      COALESCE(SUM(l."quarantine"), 0)::int AS "quarantine", COALESCE(SUM(l."inspection"), 0)::int AS "inspection",
      (COALESCE(SUM(l."onHand"), 0) - COALESCE(SUM(l."reserved"), 0))::int AS "available",
      MAX(m."syncedQty")::int AS "syncedQty"`;
  return { p, base, select };
}

const SELLABLE_SUM = `COALESCE(SUM(l."onHand"), 0) - COALESCE(SUM(l."reserved"), 0)`;

/** A seller's own stock (view only), with totals for the tiles. */
export function sellerStock(f: StockFilter & { lowOnly?: boolean; limit: number; offset: number }): { rows: Query; count: Query; totals: Query } {
  const { p, base, select } = perSku(f, {});
  const having = f.lowOnly ? `HAVING ${SELLABLE_SUM} <= s."lowStockLevel"` : '';
  const countParams = [...p.list];
  return {
    rows: { text: `${select} ${base} ${having} ORDER BY p."name", s."code" ${page(p, f.limit, f.offset)}`, params: p.list },
    count: { text: `SELECT COUNT(*)::int AS "total" FROM (SELECT s."id" ${base} ${having}) t`, params: countParams },
    totals: {
      text: `SELECT COALESCE(SUM("onHand"),0)::int AS "onHand", COALESCE(SUM("reserved"),0)::int AS "reserved",
        COALESCE(SUM("quarantine"),0)::int AS "quarantine", COALESCE(SUM("inspection"),0)::int AS "inspection"
        FROM (SELECT ${`COALESCE(SUM(l."onHand"),0) AS "onHand", COALESCE(SUM(l."reserved"),0) AS "reserved", COALESCE(SUM(l."quarantine"),0) AS "quarantine", COALESCE(SUM(l."inspection"),0) AS "inspection"`} ${base}) t`,
      params: countParams,
    },
  };
}

/** Variations at or below their alert level, summed over warehouses. */
export function lowStock(f: StockFilter & { limit: number; offset: number }): { rows: Query; count: Query } {
  const { p, base, select } = perSku(f, {});
  const having = `HAVING ${SELLABLE_SUM} <= s."lowStockLevel"`;
  const countParams = [...p.list];
  return {
    rows: { text: `${select} ${base} ${having} ORDER BY (${SELLABLE_SUM}), p."name", s."code" ${page(p, f.limit, f.offset)}`, params: p.list },
    count: { text: `SELECT COUNT(*)::int AS "total" FROM (SELECT s."id" ${base} ${having}) t`, params: countParams },
  };
}

/** Variations whose sellable stock differs from what the marketplaces were last told. */
export function marketplacePending(f: StockFilter & { limit: number; offset: number }): { rows: Query; count: Query } {
  const { p, base, select } = perSku(f, {});
  const having = `HAVING ${SELLABLE_SUM} <> COALESCE(MAX(m."syncedQty"), 0)`;
  const countParams = [...p.list];
  return {
    rows: { text: `${select} ${base} ${having} ORDER BY p."name", s."code" ${page(p, f.limit, f.offset)}`, params: p.list },
    count: { text: `SELECT COUNT(*)::int AS "total" FROM (SELECT s."id" ${base} ${having}) t`, params: countParams },
  };
}

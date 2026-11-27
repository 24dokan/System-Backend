/**
 * Sales report SQL. Days are Malaysian days (UTC+8). Cancelled orders are left out.
 * Values go in as numbered parameters.
 */
export interface Query { text: string; params: unknown[] }
export interface ReportFilter { from: string; to: string; sellerId?: string; source?: string }

const LOCAL_DAY = `(o."placedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kuala_Lumpur')::date`;

function base(f: ReportFilter) {
  const params: unknown[] = [f.from, f.to];
  const where = [`o."status" <> 'CANCELLED'`, `${LOCAL_DAY} BETWEEN $1::date AND $2::date`];
  if (f.sellerId) { params.push(f.sellerId); where.push(`o."sellerId" = $${params.length}`); }
  if (f.source) { params.push(f.source); where.push(`o."source" = $${params.length}::"OrderSource"`); }
  return { params, where: where.join(' AND ') };
}

export function totals(f: ReportFilter): Query {
  const { params, where } = base(f);
  return {
    params,
    text: `SELECT (SELECT COUNT(*) FROM "Order" o WHERE ${where})::int AS "orders",
      (SELECT COALESCE(SUM(o."totalMinor"),0) FROM "Order" o WHERE ${where})::int AS "revenueMinor",
      (SELECT COALESCE(SUM(i."qty"),0) FROM "OrderItem" i JOIN "Order" o ON o."id" = i."orderId" WHERE ${where})::int AS "units"`,
  };
}

export function perDay(f: ReportFilter): Query {
  const { params, where } = base(f);
  return { params, text: `SELECT to_char(${LOCAL_DAY}, 'YYYY-MM-DD') AS "day", COUNT(*)::int AS "orders", COALESCE(SUM(o."totalMinor"),0)::int AS "revenueMinor" FROM "Order" o WHERE ${where} GROUP BY 1 ORDER BY 1` };
}

export function bySource(f: ReportFilter): Query {
  const { params, where } = base(f);
  return { params, text: `SELECT o."source"::text AS "source", COUNT(*)::int AS "orders", COALESCE(SUM(o."totalMinor"),0)::int AS "revenueMinor" FROM "Order" o WHERE ${where} GROUP BY 1 ORDER BY 3 DESC` };
}

export function topProducts(f: ReportFilter, limit = 10): Query {
  const { params, where } = base(f);
  params.push(limit);
  return {
    params,
    text: `SELECT i."skuCode" AS "code", MAX(i."productName") AS "product", MAX(i."variationLabel") AS "variation",
      SUM(i."qty")::int AS "units", SUM(i."qty" * i."unitPriceMinor")::int AS "revenueMinor"
      FROM "OrderItem" i JOIN "Order" o ON o."id" = i."orderId" WHERE ${where} GROUP BY i."skuCode" ORDER BY 4 DESC, 1 LIMIT $${params.length}`,
  };
}

export function orderRows(f: ReportFilter): Query {
  const { params, where } = base(f);
  return {
    params,
    text: `SELECT o."number", to_char(${LOCAL_DAY}, 'YYYY-MM-DD') AS "day", o."source"::text AS "source", COALESCE(o."externalRef",'') AS "ref", s."name" AS "seller",
      o."customerName", o."status"::text AS "status", o."totalMinor"::int AS "totalMinor"
      FROM "Order" o JOIN "Seller" s ON s."id" = o."sellerId" WHERE ${where} ORDER BY o."number" LIMIT 50000`,
  };
}

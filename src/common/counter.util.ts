import { Prisma } from '@prisma/client';

/** Next number in a named sequence (orders, shipments, returns). Safe when several requests run at once. */
export async function nextNumber(tx: Prisma.TransactionClient, name: string, start = 0): Promise<number> {
  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO "Counter" ("name", "value") VALUES (${name}, ${start + 1})
    ON CONFLICT ("name") DO UPDATE SET "value" = "Counter"."value" + 1
    RETURNING "value"`;
  return Number(rows[0].value);
}

export const padCode = (prefix: string, n: number) => `${prefix}-${String(n).padStart(4, '0')}`;

'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Badge, Card, PageHeader, useAction, useLoad } from '@/components/ui';
import { Pager, Paged, Table, qs, stockLabel, stockTone } from '@/components/inventory';
import { useAuth } from '@/lib/auth';

export default function LowStock() {
  const { can } = useAuth();
  const [page, setPage] = useState(1);
  const list = useLoad<Paged<any>>(() => api(`/api/stock/low${qs({ page, pageSize: 25 })}`), [page]);
  const { busy, run } = useAction();
  const [levels, setLevels] = useState<Record<string, string>>({});
  const save = async (skuId: string) => {
    const n = Number(levels[skuId]);
    if (!Number.isInteger(n) || n < 0) return;
    if (await run(() => api(`/api/stock/sku/${skuId}/alert-level`, { method: 'PATCH', body: { lowStockLevel: n } }), 'Alert level saved')) list.reload();
  };
  return (
    <>
      <PageHeader title="Low stock" subtitle="Variations at or below their alert level. The default level is 10 units. You can set a different level for each variation." />
      <Card>
        <Table head={['Product / variation', 'Seller', 'SKU', 'Available', 'Alert level', 'Status']} empty={list.data && !list.data.rows.length ? 'Nothing is running low.' : undefined}>
          {list.data?.rows.map((r) => (
            <tr key={r.skuId}>
              <td className="px-4 py-3"><div className="font-medium">{r.product}</div><div className="text-xs text-slate-500">{r.variation}</div></td>
              <td className="px-4 py-3">{r.seller}</td><td className="px-4 py-3 font-mono">{r.code}</td><td className="px-4 py-3 font-semibold">{r.available}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <input className="input w-20" aria-label="Alert level" disabled={!can('inventory.manage')} value={levels[r.skuId] ?? String(r.lowStockLevel)} onChange={(e) => setLevels((p) => ({ ...p, [r.skuId]: e.target.value }))} />
                  {levels[r.skuId] !== undefined && levels[r.skuId] !== String(r.lowStockLevel) && <button className="btn-secondary btn-sm" disabled={busy} onClick={() => save(r.skuId)}>Save</button>}
                </div>
              </td>
              <td className="px-4 py-3"><Badge tone={stockTone(r.available, r.lowStockLevel)}>{stockLabel(r.available, r.lowStockLevel)}</Badge></td>
            </tr>
          ))}
        </Table>
        {list.data && <Pager page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} />}
      </Card>
    </>
  );
}

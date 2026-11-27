'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Badge, Card, PageHeader, useLoad } from '@/components/ui';
import { Pager, Paged, Table, qs, stockLabel, stockTone, useDebounced } from '@/components/inventory';

export default function MyStock() {
  const [search, setSearch] = useState('');
  const [low, setLow] = useState(false);
  const [page, setPage] = useState(1);
  const ds = useDebounced(search);
  const list = useLoad<Paged<any> & { totals: any }>(() => api(`/api/stock/mine${qs({ search: ds, low, page, pageSize: 25 })}`), [ds, low, page]);
  const t = list.data?.totals;
  return (
    <>
      <PageHeader title="My stock" subtitle="Your stock at our warehouse. This page is view only. Our warehouse team updates the numbers." />
      {t && (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[['On hand', t.onHand], ['Reserved for orders', t.reserved], ['Available to sell', t.available], ['Held for checking', t.quarantine + t.inspection]].map(([l, v]) => (
            <div key={l as string} className="rounded-lg border border-slate-200 bg-white p-4"><div className="text-2xl font-semibold">{(v as number).toLocaleString()}</div><div className="text-sm text-slate-500">{l}</div></div>
          ))}
        </div>
      )}
      <div className="mb-4 flex flex-wrap gap-3">
        <input className="input max-w-xs" placeholder="Search SKU or product" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={low} onChange={(e) => { setLow(e.target.checked); setPage(1); }} /> Low stock only</label>
      </div>
      <Card>
        <Table head={['Product / variation', 'SKU', 'On hand', 'Reserved', 'Available', 'Held', 'Status']} empty={list.data && !list.data.rows.length ? 'No stock yet. Send stock to our warehouse and it will show here.' : undefined}>
          {list.data?.rows.map((r) => (
            <tr key={r.skuId}>
              <td className="px-4 py-3"><div className="font-medium">{r.product}</div><div className="text-xs text-slate-500">{r.variation}</div></td>
              <td className="px-4 py-3 font-mono">{r.code}</td><td className="px-4 py-3">{r.onHand}</td><td className="px-4 py-3">{r.reserved}</td>
              <td className="px-4 py-3 font-semibold">{r.available}</td><td className="px-4 py-3">{r.quarantine + r.inspection}</td>
              <td className="px-4 py-3"><Badge tone={stockTone(r.available, r.lowStockLevel)}>{stockLabel(r.available, r.lowStockLevel)}</Badge></td>
            </tr>
          ))}
        </Table>
        {list.data && <Pager page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} />}
      </Card>
    </>
  );
}

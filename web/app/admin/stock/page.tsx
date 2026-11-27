'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Badge, Card, PageHeader, useLoad } from '@/components/ui';
import { Pager, Paged, Table, qs, stockLabel, stockTone, useDebounced } from '@/components/inventory';

export default function StockOverview() {
  const [search, setSearch] = useState('');
  const [warehouseId, setWarehouse] = useState('');
  const [low, setLow] = useState(false);
  const [page, setPage] = useState(1);
  const ds = useDebounced(search);
  const warehouses = useLoad<any[]>(() => api('/api/warehouses'));
  const list = useLoad<Paged<any>>(() => api(`/api/stock${qs({ search: ds, warehouseId, low, page, pageSize: 25 })}`), [ds, warehouseId, low, page]);
  return (
    <>
      <PageHeader title="Stock overview" subtitle="What is on the shelves, what is promised to orders, and what can still be sold." />
      <div className="mb-4 flex flex-wrap gap-3">
        <input className="input max-w-xs" placeholder="Search SKU or product" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select className="input max-w-[200px]" value={warehouseId} onChange={(e) => { setWarehouse(e.target.value); setPage(1); }}>
          <option value="">All warehouses</option>{warehouses.data?.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={low} onChange={(e) => { setLow(e.target.checked); setPage(1); }} /> Low stock only</label>
      </div>
      <Card>
        <Table head={['Product / variation', 'Seller', 'SKU', 'Warehouse', 'On hand', 'Reserved', 'Available', 'Quarantine', 'Inspection', 'Status']}
          empty={list.data && !list.data.rows.length ? 'No stock found.' : undefined}>
          {list.data?.rows.map((r) => (
            <tr key={`${r.skuId}-${r.warehouseId}`}>
              <td className="px-4 py-3"><div className="font-medium">{r.product}</div><div className="text-xs text-slate-500">{r.variation}</div></td>
              <td className="px-4 py-3">{r.seller}</td><td className="px-4 py-3 font-mono">{r.code}</td><td className="px-4 py-3">{r.warehouse}</td>
              <td className="px-4 py-3">{r.onHand}</td><td className="px-4 py-3">{r.reserved}</td><td className="px-4 py-3 font-semibold">{r.available}</td>
              <td className="px-4 py-3">{r.quarantine}</td><td className="px-4 py-3">{r.inspection}</td>
              <td className="px-4 py-3"><Badge tone={stockTone(r.available, r.lowStockLevel)}>{stockLabel(r.available, r.lowStockLevel)}</Badge></td>
            </tr>
          ))}
        </Table>
        {list.data && <Pager page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} />}
      </Card>
    </>
  );
}

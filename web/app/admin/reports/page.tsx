'use client';
import { useState } from 'react';
import { api, download } from '@/lib/api';
import { Card, PageHeader, Spinner, useLoad } from '@/components/ui';
import { Table, qs } from '@/components/inventory';
import { SOURCE_LABEL } from '@/components/orders';
import { money } from '@/lib/format';

const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => iso(new Date(Date.now() + 8 * 3600_000 - n * 86400_000));

export default function Reports() {
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(daysAgo(0));
  const [sellerId, setSeller] = useState('');
  const [source, setSource] = useState('');
  const sellers = useLoad<any[]>(() => api('/api/sellers/options'));
  const r = useLoad<any>(() => api(`/api/reports/sales${qs({ from, to, sellerId, source })}`), [from, to, sellerId, source]);
  const d = r.data;
  const max = Math.max(1, ...(d?.perDay.map((x: any) => x.revenueMinor) ?? [0]));
  return (
    <>
      <PageHeader title="Sales reports" subtitle="Orders that were not cancelled, by Malaysian calendar day."
        actions={<button className="btn-secondary" onClick={() => download(`/api/reports/sales.csv${qs({ from, to, sellerId, source })}`, 'sales-report.csv')}>Export CSV</button>} />
      <div className="mb-4 flex flex-wrap gap-3">
        <input type="date" className="input max-w-[170px]" aria-label="From" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" className="input max-w-[170px]" aria-label="To" value={to} onChange={(e) => setTo(e.target.value)} />
        <select className="input max-w-[200px]" value={sellerId} onChange={(e) => setSeller(e.target.value)}><option value="">All sellers</option>{sellers.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <select className="input max-w-[180px]" value={source} onChange={(e) => setSource(e.target.value)}><option value="">All sources</option>{Object.entries(SOURCE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      </div>
      {r.error && <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{r.error}</div>}
      {!d ? <Spinner /> : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[['Orders', d.totals.orders.toLocaleString()], ['Units sold', d.totals.units.toLocaleString()], ['Sales', money(d.totals.revenueMinor)], ['Average order', money(d.totals.averageMinor)]].map(([l, v]) => (
              <div key={l} className="rounded-lg border border-slate-200 bg-white p-4"><div className="text-2xl font-semibold">{v}</div><div className="text-sm text-slate-500">{l}</div></div>
            ))}
          </div>
          <Card title="Sales per day">
            <div className="flex h-40 items-end gap-0.5" role="img" aria-label="Sales per day">
              {d.perDay.map((x: any) => <div key={x.day} title={`${x.day}: ${money(x.revenueMinor)}, ${x.orders} order(s)`} className="flex-1 rounded-t bg-brand" style={{ height: `${Math.max(2, (x.revenueMinor / max) * 100)}%` }} />)}
            </div>
            <div className="mt-1 flex justify-between text-xs text-slate-400"><span>{d.from}</span><span>{d.to}</span></div>
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="By source"><Table head={['Source', 'Orders', 'Sales']} empty={!d.bySource.length ? 'No sales in this range.' : undefined}>
              {d.bySource.map((s: any) => <tr key={s.source}><td className="px-4 py-3">{SOURCE_LABEL[s.source]}</td><td className="px-4 py-3">{s.orders}</td><td className="px-4 py-3">{money(s.revenueMinor)}</td></tr>)}</Table></Card>
            <Card title="Top sellers (products)"><Table head={['SKU', 'Product', 'Units', 'Sales']} empty={!d.topProducts.length ? 'No sales in this range.' : undefined}>
              {d.topProducts.map((p: any) => <tr key={p.code}><td className="px-4 py-3 font-mono">{p.code}</td><td className="px-4 py-3">{p.product}<div className="text-xs text-slate-500">{p.variation}</div></td><td className="px-4 py-3">{p.units}</td><td className="px-4 py-3">{money(p.revenueMinor)}</td></tr>)}</Table></Card>
          </div>
        </div>
      )}
    </>
  );
}

'use client';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Card, PageHeader, useAction, useLoad } from '@/components/ui';
import { Pager, Paged, Table, qs, useDebounced } from '@/components/inventory';
import { OrderBadge, SOURCES, SOURCE_LABEL, STATUS_LABEL, orderNo } from '@/components/orders';
import { date, money } from '@/lib/format';
import { useAuth } from '@/lib/auth';

export default function Orders() {
  const { can } = useAuth();
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [picked, setPicked] = useState<string[]>([]);
  const ds = useDebounced(search);
  const list = useLoad<Paged<any> & { counts: Record<string, number> }>(() => api(`/api/orders${qs({ status, source, search: ds, page, pageSize: 25 })}`), [status, source, ds, page]);
  const { busy, run } = useAction();
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const act = async (step: 'pack' | 'ready' | 'ship') => {
    const r = await run(() => api<any>(`/api/orders/${step}`, { method: 'POST', body: { ids: picked } }));
    if (r) { alert(`${r.done} order(s) updated${r.skipped.length ? `. ${r.skipped.length} skipped: ${r.skipped[0].reason}` : ''}`); setPicked([]); list.reload(); }
  };
  const counts = list.data?.counts ?? {};
  return (
    <>
      <PageHeader title="Orders" subtitle="All orders from every marketplace, packed from our warehouse."
        actions={can('orders.manage') && <div className="flex gap-2">
          <Link className="btn-secondary" href="/admin/orders/pick-list">Pick list</Link>
          <Link className="btn-secondary" href="/admin/orders/import">Bulk import</Link>
          <Link className="btn-primary" href="/admin/orders/new">Create order</Link></div>} />
      <div className="mb-4 flex flex-wrap gap-2">
        {[['', 'All'], ...Object.entries(STATUS_LABEL)].map(([k, l]) => (
          <button key={k} className={status === k ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'} onClick={() => { setStatus(k); setPage(1); setPicked([]); }}>
            {l}{k && counts[k] ? ` (${counts[k]})` : ''}
          </button>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-3">
        <input className="input max-w-xs" placeholder="Search order no., customer, SKU" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select className="input max-w-[180px]" value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }}>
          <option value="">All sources</option>{SOURCES.map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
        </select>
        {picked.length > 0 && can('orders.manage') && <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">{picked.length} selected</span>
          <button className="btn-secondary btn-sm" disabled={busy} onClick={() => act('pack')}>Mark packed</button>
          <button className="btn-secondary btn-sm" disabled={busy} onClick={() => act('ready')}>Ready for pickup</button>
          <button className="btn-primary btn-sm" disabled={busy} onClick={() => act('ship')}>Mark shipped</button></div>}
      </div>
      <Card>
        <Table head={['', 'Order', 'Placed', 'Source', 'Seller', 'Customer', 'Items', 'Total', 'Status']} empty={list.data && !list.data.rows.length ? 'No orders found.' : undefined}>
          {list.data?.rows.map((o) => (
            <tr key={o.id}>
              <td className="px-4 py-3"><input type="checkbox" aria-label="Select" checked={picked.includes(o.id)} onChange={() => toggle(o.id)} /></td>
              <td className="px-4 py-3"><Link className="font-mono text-brand hover:underline" href={`/admin/orders/${o.id}`}>{orderNo(o.number)}</Link>{o.externalRef && <div className="text-xs text-slate-400">{o.externalRef}</div>}</td>
              <td className="px-4 py-3 text-slate-500">{date(o.placedAt)}</td><td className="px-4 py-3">{SOURCE_LABEL[o.source]}</td><td className="px-4 py-3">{o.seller}</td>
              <td className="px-4 py-3">{o.customerName}</td><td className="px-4 py-3">{o.itemCount}</td><td className="px-4 py-3">{money(o.totalMinor)}</td>
              <td className="px-4 py-3"><OrderBadge status={o.status} /></td>
            </tr>
          ))}
        </Table>
        {list.data && <Pager page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} />}
      </Card>
    </>
  );
}

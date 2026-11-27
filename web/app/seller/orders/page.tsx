'use client';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Card, PageHeader, useLoad } from '@/components/ui';
import { Pager, Paged, Table, qs, useDebounced } from '@/components/inventory';
import { OrderBadge, SOURCE_LABEL, STATUS_LABEL, orderNo } from '@/components/orders';
import { date, money } from '@/lib/format';

export default function MyOrders() {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const ds = useDebounced(search);
  const list = useLoad<Paged<any>>(() => api(`/api/orders${qs({ status, search: ds, page, pageSize: 25 })}`), [status, ds, page]);
  return (
    <>
      <PageHeader title="My orders" subtitle="Orders for your products. Our warehouse team packs and ships them." />
      <div className="mb-4 flex flex-wrap gap-2">
        {[['', 'All'], ...Object.entries(STATUS_LABEL)].map(([k, l]) => <button key={k} className={status === k ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'} onClick={() => { setStatus(k); setPage(1); }}>{l}</button>)}
        <input className="input ml-auto max-w-xs" placeholder="Search order no. or customer" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>
      <Card>
        <Table head={['Order', 'Placed', 'Source', 'Customer', 'Items', 'Total', 'Status']} empty={list.data && !list.data.rows.length ? 'No orders yet.' : undefined}>
          {list.data?.rows.map((o) => (
            <tr key={o.id}>
              <td className="px-4 py-3"><Link className="font-mono text-brand hover:underline" href={`/seller/orders/${o.id}`}>{orderNo(o.number)}</Link></td>
              <td className="px-4 py-3 text-slate-500">{date(o.placedAt)}</td><td className="px-4 py-3">{SOURCE_LABEL[o.source]}</td><td className="px-4 py-3">{o.customerName}</td>
              <td className="px-4 py-3">{o.itemCount}</td><td className="px-4 py-3">{money(o.totalMinor)}</td><td className="px-4 py-3"><OrderBadge status={o.status} /></td>
            </tr>
          ))}
        </Table>
        {list.data && <Pager page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} />}
      </Card>
    </>
  );
}

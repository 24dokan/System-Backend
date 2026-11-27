'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Badge, Card, PageHeader, useLoad } from '@/components/ui';
import { Pager, Paged, Table, qs, useDebounced } from '@/components/inventory';
import { date } from '@/lib/format';

const TYPES = ['RECEIVED', 'RESERVED', 'RELEASED', 'SHIPPED', 'RETURNED', 'RESTOCKED', 'DAMAGED', 'ADJUSTED'];
const tone: Record<string, string> = { RECEIVED: 'green', RETURNED: 'green', RESTOCKED: 'green', RESERVED: 'blue', RELEASED: 'gray', SHIPPED: 'purple', DAMAGED: 'red', ADJUSTED: 'red' };
const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

export default function Movements() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const ds = useDebounced(search);
  const list = useLoad<Paged<any>>(() => api(`/api/stock/movements${qs({ search: ds, type, from, to: to ? `${to}T23:59:59` : '', page, pageSize: 30 })}`), [ds, type, from, to, page]);
  return (
    <>
      <PageHeader title="Stock movements" subtitle="A full history of every change to stock. Entries cannot be edited." />
      <div className="mb-4 flex flex-wrap gap-3">
        <input className="input max-w-xs" placeholder="Search SKU or order no." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select className="input max-w-[180px]" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
          <option value="">All types</option>{TYPES.map((t) => <option key={t} value={t}>{t[0] + t.slice(1).toLowerCase()}</option>)}
        </select>
        <input type="date" className="input max-w-[170px]" aria-label="From" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        <input type="date" className="input max-w-[170px]" aria-label="To" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
      </div>
      <Card>
        <Table head={['When', 'Type', 'SKU', 'Warehouse', 'Shelf', 'On hand', 'Reserved', 'On hand after', 'Reference', 'By']} empty={list.data && !list.data.rows.length ? 'No movements found.' : undefined}>
          {list.data?.rows.map((r) => (
            <tr key={r.id}>
              <td className="px-4 py-3 text-slate-500">{date(r.createdAt)}</td>
              <td className="px-4 py-3"><Badge tone={tone[r.type] ?? 'gray'}>{r.type[0] + r.type.slice(1).toLowerCase()}</Badge></td>
              <td className="px-4 py-3 font-mono">{r.sku}</td><td className="px-4 py-3">{r.warehouse}</td><td className="px-4 py-3">{r.location || '-'}</td>
              <td className="px-4 py-3">{r.onHandDelta ? signed(r.onHandDelta) : '-'}</td><td className="px-4 py-3">{r.reservedDelta ? signed(r.reservedDelta) : '-'}</td>
              <td className="px-4 py-3">{r.onHandAfter}</td><td className="px-4 py-3 font-mono">{r.ref ?? ''}{r.note ? <span className="ml-2 font-sans text-xs text-slate-400">{r.note}</span> : null}</td>
              <td className="px-4 py-3">{r.by}</td>
            </tr>
          ))}
        </Table>
        {list.data && <Pager page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} />}
      </Card>
    </>
  );
}

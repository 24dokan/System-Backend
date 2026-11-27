'use client';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card, PageHeader, Spinner, useAction, useLoad } from '@/components/ui';
import { Table } from '@/components/inventory';
import { useAuth } from '@/lib/auth';

export default function PickList() {
  const { can } = useAuth();
  const list = useLoad<any>(() => api('/api/orders/pick-list'));
  const { busy, run } = useAction();
  if (!list.data) return <Spinner />;
  const d = list.data;
  const packAll = async () => {
    if (!confirm(`Mark all ${d.orderCount} orders as packed?`)) return;
    if (await run(() => api('/api/orders/pack', { method: 'POST', body: { ids: d.orders.slice(0, 200).map((o: any) => o.id) } }), 'Marked as packed')) list.reload();
  };
  return (
    <>
      <PageHeader title="Pick list" subtitle="Everything to pick for orders waiting to be packed, grouped by shelf so the walk is short."
        actions={<div className="flex gap-2 print:hidden"><button className="btn-secondary" onClick={() => window.print()}>Print</button>
          {can('orders.manage') && <button className="btn-primary" disabled={busy || !d.orderCount} onClick={packAll}>Mark all packed</button>}</div>} />
      <p className="mb-3 text-sm text-slate-500">{d.orderCount} order(s), {d.units} unit(s). <Link className="text-brand hover:underline print:hidden" href="/admin/orders">View orders</Link></p>
      <Card>
        <Table head={['Shelf', 'SKU', 'Product', 'Qty', 'Orders']} empty={!d.rows.length ? 'Nothing to pick.' : undefined}>
          {d.rows.map((r: any, i: number) => (
            <tr key={i}>
              <td className="px-4 py-3 font-mono font-semibold">{r.location || 'No shelf set'}<div className="font-sans text-xs font-normal text-slate-400">{r.warehouse}</div></td>
              <td className="px-4 py-3 font-mono">{r.skuCode}</td><td className="px-4 py-3">{r.product}<div className="text-xs text-slate-500">{r.variation}</div></td>
              <td className="px-4 py-3 text-lg font-semibold">{r.qty}</td><td className="px-4 py-3 text-slate-500">{r.orders.map((n: number) => `#${n}`).join(', ')}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}

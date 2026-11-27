'use client';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Card, PageHeader, Spinner, useLoad } from '@/components/ui';
import { Table } from '@/components/inventory';
import { OrderBadge, SOURCE_LABEL, orderNo } from '@/components/orders';
import { date, money } from '@/lib/format';

export default function MyOrder() {
  const { id } = useParams<{ id: string }>();
  const o = useLoad<any>(() => api(`/api/orders/${id}`), [id]);
  if (!o.data) return <Spinner />;
  const d = o.data;
  return (
    <>
      <PageHeader title={`Order ${orderNo(d.number)}`} subtitle={`${SOURCE_LABEL[d.source]}${d.externalRef ? ` · ${d.externalRef}` : ''}`} actions={<OrderBadge status={d.status} />} />
      {d.status === 'CANCELLED' && <div className="mb-4 rounded-md bg-slate-100 p-3 text-sm">Cancelled: {d.cancelReason}</div>}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2"><Card title="Items">
          <Table head={['SKU', 'Product', 'Qty', 'Price']}>
            {d.items.map((i: any) => <tr key={i.id}><td className="px-4 py-3 font-mono">{i.skuCode}</td><td className="px-4 py-3">{i.productName}<div className="text-xs text-slate-500">{i.variationLabel}</div></td><td className="px-4 py-3">{i.qty}</td><td className="px-4 py-3">{money(i.unitPriceMinor)}</td></tr>)}
          </Table>
          <div className="border-t border-slate-200 p-4 text-right text-base font-semibold">Total {money(d.totalMinor)}</div>
        </Card></div>
        <div className="space-y-4">
          <Card title="Customer"><div className="text-sm"><div className="font-medium">{d.customerName}</div><div className="mt-2 whitespace-pre-line text-slate-600">{d.address}</div></div></Card>
          <Card title="History"><ol className="space-y-3 text-sm">{d.events.map((e: any) => <li key={e.id}><div className="font-medium">{e.action.replace(/_/g, ' ').toLowerCase()}</div><div className="text-xs text-slate-500">{date(e.createdAt)}</div></li>)}</ol></Card>
        </div>
      </div>
    </>
  );
}

'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Card, Field, Modal, PageHeader, Spinner, useAction, useLoad } from '@/components/ui';
import { Table } from '@/components/inventory';
import { OrderBadge, SOURCE_LABEL, orderNo } from '@/components/orders';
import { date, money } from '@/lib/format';
import { useAuth } from '@/lib/auth';

const EVENT: Record<string, string> = { CREATED: 'Order created', PACKED: 'Packed', READY_FOR_PICKUP: 'Ready for pickup', SHIPPED: 'Shipped', CANCELLED: 'Cancelled', RETURN_RECEIVED: 'Return received' };

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const o = useLoad<any>(() => api(`/api/orders/${id}`), [id]);
  const { busy, run } = useAction();
  const [cancelling, setCancelling] = useState(false);
  const [returning, setReturning] = useState<any | null>(null);
  if (!o.data) return <Spinner />;
  const d = o.data;
  const step = async (name: 'pack' | 'ready' | 'ship') => {
    const r = await run(() => api<any>(`/api/orders/${name}`, { method: 'POST', body: { ids: [id] } }));
    if (r?.skipped?.length) alert(r.skipped[0].reason);
    o.reload();
  };
  const manage = can('orders.manage');
  return (
    <>
      <PageHeader title={`Order ${orderNo(d.number)}`} subtitle={`${SOURCE_LABEL[d.source]}${d.externalRef ? ` · ${d.externalRef}` : ''} · ${d.seller.name} · ${d.warehouse.name}`}
        actions={<div className="flex items-center gap-2"><OrderBadge status={d.status} />
          {manage && d.status === 'TO_PACK' && <button className="btn-primary" disabled={busy} onClick={() => step('pack')}>Mark packed</button>}
          {manage && d.status === 'PACKED' && <button className="btn-primary" disabled={busy} onClick={() => step('ready')}>Ready for pickup</button>}
          {manage && ['PACKED', 'WAITING_PICKUP'].includes(d.status) && <button className="btn-primary" disabled={busy} onClick={() => step('ship')}>Mark shipped</button>}
          {can('orders.cancel') && ['TO_PACK', 'PACKED', 'WAITING_PICKUP'].includes(d.status) && <button className="btn-secondary" onClick={() => setCancelling(true)}>Cancel order</button>}
        </div>} />
      {d.status === 'CANCELLED' && <div className="mb-4 rounded-md bg-slate-100 p-3 text-sm">Cancelled: {d.cancelReason}</div>}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Items">
            <Table head={['SKU', 'Product', 'Qty', 'Price', 'Pick from', '']}>
              {d.items.map((i: any) => (
                <tr key={i.id}>
                  <td className="px-4 py-3 font-mono">{i.skuCode}</td><td className="px-4 py-3">{i.productName}<div className="text-xs text-slate-500">{i.variationLabel}</div></td>
                  <td className="px-4 py-3">{i.qty}</td><td className="px-4 py-3">{money(i.unitPriceMinor)}</td>
                  <td className="px-4 py-3 text-slate-500">{i.picks.length ? i.picks.map((p: any) => `${p.location || 'Unassigned'} x${p.qty}`).join(', ') : '-'}</td>
                  <td className="px-4 py-3 text-right">{d.status === 'SHIPPED' && can('returns.manage') && <button className="btn-secondary btn-sm" onClick={() => setReturning(i)}>Record return</button>}</td>
                </tr>
              ))}
            </Table>
            <div className="space-y-1 border-t border-slate-200 p-4 text-right text-sm">
              <div>Items {money(d.itemsMinor)}</div><div>Shipping {money(d.shippingMinor)}</div>{d.discountMinor > 0 && <div>Discount -{money(d.discountMinor)}</div>}
              <div className="text-base font-semibold">Total {money(d.totalMinor)}</div>
            </div>
          </Card>
          {d.returns.length > 0 && <Card title="Returns"><ul className="space-y-1 text-sm">{d.returns.map((r: any) => <li key={r.id}><span className="font-mono">{r.code}</span>, {r.qty} unit(s), {r.status.toLowerCase().replace('_', ' ')}</li>)}</ul><Link className="mt-3 inline-block text-sm text-brand hover:underline" href="/admin/returns">Open returns</Link></Card>}
        </div>
        <div className="space-y-4">
          <Card title="Customer"><div className="text-sm"><div className="font-medium">{d.customerName}</div><div>{d.customerPhone}</div><div className="mt-2 whitespace-pre-line text-slate-600">{d.address}</div>{d.note && <div className="mt-2 text-slate-500">Note: {d.note}</div>}</div></Card>
          <Card title="History"><ol className="space-y-3 text-sm">{d.events.map((e: any) => <li key={e.id}><div className="font-medium">{EVENT[e.action] ?? e.action}</div><div className="text-xs text-slate-500">{date(e.createdAt)} by {e.by}{e.note ? `: ${e.note}` : ''}</div></li>)}</ol></Card>
        </div>
      </div>
      {cancelling && <Cancel order={d} onClose={() => setCancelling(false)} onDone={() => { setCancelling(false); o.reload(); }} />}
      {returning && <ReturnForm item={returning} onClose={() => setReturning(null)} onDone={() => { setReturning(null); o.reload(); }} />}
    </>
  );
}

function Cancel({ order, onClose, onDone }: { order: any; onClose: () => void; onDone: () => void }) {
  const { busy, run } = useAction();
  const [reason, setReason] = useState('');
  const packed = order.status !== 'TO_PACK';
  return (
    <Modal title={`Cancel order ${orderNo(order.number)}`} onClose={onClose}>
      <div className="space-y-4">
        <div className={`rounded-md p-3 text-sm ${packed ? 'bg-amber-50 text-amber-800' : 'bg-slate-50 text-slate-700'}`}>
          {packed ? 'This order is already packed. The units go back to the warehouse for inspection and cannot be sold until checked. A return is opened for each shelf.' : 'The stock set aside for this order becomes available to sell again straight away.'}
        </div>
        <Field label="Reason"><textarea className="input" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus /></Field>
        <div className="flex gap-2">
          <button className="btn-danger" disabled={busy || reason.trim().length < 3} onClick={async () => { if (await run(() => api(`/api/orders/${order.id}/cancel`, { method: 'POST', body: { reason } }), 'Order cancelled')) onDone(); }}>Cancel order</button>
          <button className="btn-secondary" onClick={onClose}>Keep order</button>
        </div>
      </div>
    </Modal>
  );
}

function ReturnForm({ item, onClose, onDone }: { item: any; onClose: () => void; onDone: () => void }) {
  const { busy, run } = useAction();
  const [qty, setQty] = useState('1');
  const [reason, setReason] = useState('');
  return (
    <Modal title={`Record return: ${item.skuCode}`} onClose={onClose}>
      <div className="space-y-4">
        <Field label={`Quantity (ordered ${item.qty})`}><input className="input" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
        <Field label="Reason"><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <p className="text-sm text-slate-500">The units wait for inspection. They cannot be sold until you inspect them.</p>
        <div className="flex gap-2">
          <button className="btn-primary" disabled={busy || !(Number(qty) >= 1)} onClick={async () => { if (await run(() => api('/api/returns', { method: 'POST', body: { orderItemId: item.id, qty: Number(qty), reason: reason || undefined } }), 'Return recorded')) onDone(); }}>Save return</button>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
}

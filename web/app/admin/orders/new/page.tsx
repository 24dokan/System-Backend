'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Card, Field, PageHeader, useAction, useLoad } from '@/components/ui';
import { SkuPicker } from '@/components/inventory';
import { SOURCES, SOURCE_LABEL } from '@/components/orders';
import { fromMinor, money, toMinor } from '@/lib/format';

type Line = { sku: any | null; qty: string; price: string };

export default function CreateOrder() {
  const router = useRouter();
  const { busy, run } = useAction();
  const sellers = useLoad<any>(() => api('/api/sellers/options'));
  const warehouses = useLoad<any[]>(() => api('/api/warehouses'));
  const [f, setF] = useState({ source: 'SHOPEE', externalRef: '', sellerId: '', warehouseId: '', customerName: '', customerPhone: '', address: '', shipping: '', discount: '', note: '' });
  const [lines, setLines] = useState<Line[]>([{ sku: null, qty: '1', price: '' }]);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const setLine = (i: number, p: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));
  const sellerList: any[] = Array.isArray(sellers.data) ? sellers.data : sellers.data?.rows ?? [];

  const priceOf = (l: Line) => (l.price !== '' ? toMinor(l.price) ?? 0 : l.sku?.priceMinor ?? 0);
  const itemsMinor = lines.reduce((n, l) => n + (Number(l.qty) || 0) * priceOf(l), 0);
  const total = itemsMinor + (toMinor(f.shipping || '0') ?? 0) - (toMinor(f.discount || '0') ?? 0);
  const ok = f.sellerId && f.warehouseId && f.customerName && f.address.length >= 5 && lines.every((l) => l.sku && Number(l.qty) >= 1 && Number.isInteger(Number(l.qty)));

  const save = async () => {
    const body = {
      source: f.source, externalRef: f.externalRef || undefined, sellerId: f.sellerId, warehouseId: f.warehouseId, customerName: f.customerName,
      customerPhone: f.customerPhone || undefined, address: f.address, shippingMinor: toMinor(f.shipping || '0') ?? 0, discountMinor: toMinor(f.discount || '0') ?? 0, note: f.note || undefined,
      items: lines.map((l) => ({ skuId: l.sku.id, qty: Number(l.qty), unitPriceMinor: l.price !== '' ? toMinor(l.price) ?? undefined : undefined })),
    };
    const o = await run(() => api<any>('/api/orders', { method: 'POST', body }), 'Order created and stock set aside');
    if (o) router.push(`/admin/orders/${o.id}`);
  };

  return (
    <>
      <PageHeader title="Create order" subtitle="Enter an order by hand. Stock is set aside as soon as you save." />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Order">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Source"><select className="input" value={f.source} onChange={(e) => set('source', e.target.value)}>{SOURCES.map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}</select></Field>
              <Field label="Marketplace order number" hint="Used to stop the same order being entered twice."><input className="input" value={f.externalRef} onChange={(e) => set('externalRef', e.target.value)} /></Field>
              <Field label="Seller"><select className="input" value={f.sellerId} onChange={(e) => { set('sellerId', e.target.value); setLines([{ sku: null, qty: '1', price: '' }]); }}><option value="">Choose</option>{sellerList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
              <Field label="Pack from warehouse"><select className="input" value={f.warehouseId} onChange={(e) => set('warehouseId', e.target.value)}><option value="">Choose</option>{warehouses.data?.filter((w) => w.isActive).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></Field>
            </div>
          </Card>
          <Card title="Items">
            {!f.sellerId ? <p className="text-sm text-slate-400">Choose a seller first.</p> : (
              <div className="space-y-3">
                {lines.map((l, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="flex-1"><SkuPicker sellerId={f.sellerId} warehouseId={f.warehouseId || undefined} value={l.sku} onPick={(s) => setLine(i, { sku: s })} /></div>
                    <input className="input w-20" aria-label="Quantity" inputMode="numeric" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} />
                    <input className="input w-28" aria-label="Unit price" placeholder={l.sku ? fromMinor(l.sku.priceMinor) : 'Price'} value={l.price} onChange={(e) => setLine(i, { price: e.target.value })} />
                    {lines.length > 1 && <button className="btn-secondary btn-sm mt-1.5" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>Remove</button>}
                  </div>
                ))}
                <button className="btn-secondary btn-sm" onClick={() => setLines((ls) => [...ls, { sku: null, qty: '1', price: '' }])}>Add item</button>
              </div>
            )}
          </Card>
          <Card title="Customer">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Name"><input className="input" value={f.customerName} onChange={(e) => set('customerName', e.target.value)} /></Field>
              <Field label="Phone"><input className="input" value={f.customerPhone} onChange={(e) => set('customerPhone', e.target.value)} /></Field>
              <div className="md:col-span-2"><Field label="Delivery address"><textarea className="input" value={f.address} onChange={(e) => set('address', e.target.value)} /></Field></div>
              <div className="md:col-span-2"><Field label="Note"><input className="input" value={f.note} onChange={(e) => set('note', e.target.value)} /></Field></div>
            </div>
          </Card>
        </div>
        <Card title="Summary">
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span>Items</span><span>{money(itemsMinor)}</span></div>
            <Field label="Shipping (RM)"><input className="input" value={f.shipping} onChange={(e) => set('shipping', e.target.value)} /></Field>
            <Field label="Discount (RM)"><input className="input" value={f.discount} onChange={(e) => set('discount', e.target.value)} /></Field>
            <div className="flex justify-between border-t pt-3 text-base font-semibold"><span>Total</span><span>{money(total)}</span></div>
            <button className="btn-primary w-full" disabled={busy || !ok} onClick={save}>Create order</button>
          </div>
        </Card>
      </div>
    </>
  );
}

'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Badge, Card, Field, Modal, PageHeader, useAction, useLoad } from '@/components/ui';
import { Pager, Paged, Table, qs } from '@/components/inventory';
import { date, money, toMinor } from '@/lib/format';
import { PROMO_LABEL, PROMO_TONE, off } from '@/components/promotions';

export default function MyPromotions() {
  const [page, setPage] = useState(1);
  const list = useLoad<Paged<any>>(() => api(`/api/promotions${qs({ page, pageSize: 20 })}`), [page]);
  const [creating, setCreating] = useState(false);
  const { busy, run } = useAction();
  const cancel = async (id: string) => { if (confirm('Stop this promotion?') && await run(() => api(`/api/promotions/${id}/cancel`, { method: 'POST', body: {} }), 'Promotion stopped')) list.reload(); };
  return (
    <>
      <PageHeader title="Promotions" subtitle="Discounts on your approved products. Our team approves each promotion before it starts. Your original price is never changed."
        actions={<button className="btn-primary" onClick={() => setCreating(true)}>New promotion</button>} />
      <Card>
        <Table head={['Promotion', 'Product', 'Discount', 'Runs', 'Status', '']} empty={list.data && !list.data.rows.length ? 'No promotions yet.' : undefined}>
          {list.data?.rows.map((p) => (
            <tr key={p.id}>
              <td className="px-4 py-3 font-medium">{p.name}</td>
              <td className="px-4 py-3">{p.product}{p.skuCode && <div className="font-mono text-xs text-slate-500">{p.skuCode}</div>}</td>
              <td className="px-4 py-3">{off(p)}{p.lowestPriceMinor !== null && <div className="text-xs text-slate-500">{money(p.lowestPriceMinor)} to {money(p.lowestSalePriceMinor)}</div>}</td>
              <td className="px-4 py-3 text-slate-500">{date(p.startsAt)}<br />to {date(p.endsAt)}</td>
              <td className="px-4 py-3"><Badge tone={PROMO_TONE[p.status]}>{p.live ? 'Live now' : PROMO_LABEL[p.status]}</Badge>{p.rejectReason && <div className="mt-1 text-xs text-red-700">{p.rejectReason}</div>}</td>
              <td className="px-4 py-3 text-right">{['PENDING', 'APPROVED'].includes(p.status) && <button className="btn-secondary btn-sm" disabled={busy} onClick={() => cancel(p.id)}>Stop</button>}</td>
            </tr>
          ))}
        </Table>
        {list.data && <Pager page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} />}
      </Card>
      {creating && <Create onClose={() => setCreating(false)} onDone={() => { setCreating(false); list.reload(); }} />}
    </>
  );
}

function Create({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { busy, run } = useAction();
  const products = useLoad<any>(() => api('/api/products?status=APPROVED&pageSize=100'));
  const [productId, setProductId] = useState('');
  const detail = useLoad<any>(() => (productId ? api(`/api/products/${productId}`) : Promise.resolve(null)), [productId]);
  const [f, setF] = useState({ name: '', skuId: '', type: 'PERCENT', value: '', startsAt: '', endsAt: '' });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const list: any[] = Array.isArray(products.data) ? products.data : products.data?.rows ?? products.data?.items ?? [];
  const value = f.type === 'PERCENT' ? Number(f.value) : toMinor(f.value) ?? 0;
  const ok = productId && f.name.length >= 2 && value > 0 && f.startsAt && f.endsAt;
  const save = async () => {
    const body = { productId, skuId: f.skuId || undefined, name: f.name, type: f.type, value, startsAt: new Date(f.startsAt).toISOString(), endsAt: new Date(f.endsAt).toISOString() };
    if (await run(() => api('/api/promotions', { method: 'POST', body }), 'Sent for approval')) onDone();
  };
  return (
    <Modal title="New promotion" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Product"><select className="input" value={productId} onChange={(e) => { setProductId(e.target.value); set('skuId', ''); }}><option value="">Choose an approved product</option>{list.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
        {detail.data && detail.data.skus?.length > 1 && <Field label="Applies to"><select className="input" value={f.skuId} onChange={(e) => set('skuId', e.target.value)}><option value="">All variations</option>{detail.data.skus.map((s: any) => <option key={s.id} value={s.id}>{s.code}</option>)}</select></Field>}
        <Field label="Name"><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="11.11 sale" /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Discount type"><select className="input" value={f.type} onChange={(e) => { set('type', e.target.value); set('value', ''); }}><option value="PERCENT">Percent off</option><option value="FIXED">Amount off (RM)</option></select></Field>
          <Field label={f.type === 'PERCENT' ? 'Percent (1 to 90)' : 'Amount (RM)'}><input className="input" value={f.value} onChange={(e) => set('value', e.target.value)} /></Field>
          <Field label="Starts"><input type="datetime-local" className="input" value={f.startsAt} onChange={(e) => set('startsAt', e.target.value)} /></Field>
          <Field label="Ends"><input type="datetime-local" className="input" value={f.endsAt} onChange={(e) => set('endsAt', e.target.value)} /></Field>
        </div>
        <div className="flex gap-2"><button className="btn-primary" disabled={busy || !ok} onClick={save}>Send for approval</button><button className="btn-secondary" onClick={onClose}>Cancel</button></div>
      </div>
    </Modal>
  );
}

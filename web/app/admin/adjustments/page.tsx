'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, Field, PageHeader, useAction, useLoad } from '@/components/ui';
import { SkuPicker, qs } from '@/components/inventory';
import { date } from '@/lib/format';

const REASONS = [['COUNT', 'Stock count correction'], ['LOST', 'Lost'], ['DAMAGED', 'Damaged'], ['EXPIRED', 'Expired'], ['OTHER', 'Other']] as const;

export default function Adjustments() {
  const warehouses = useLoad<any[]>(() => api('/api/warehouses'));
  const recent = useLoad<{ rows: any[] }>(() => api(`/api/stock/movements${qs({ type: 'ADJUSTED', pageSize: 8 })}`));
  const { busy, run } = useAction();
  const [sku, setSku] = useState<any | null>(null);
  const [warehouseId, setWarehouseId] = useState('');
  const [location, setLocation] = useState('');
  const [reason, setReason] = useState<string>('COUNT');
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [levels, setLevels] = useState<any[]>([]);

  useEffect(() => { if (!warehouseId && warehouses.data?.length) setWarehouseId(warehouses.data.find((w) => w.isActive)?.id ?? ''); }, [warehouses.data, warehouseId]);
  useEffect(() => {
    if (!sku) { setLevels([]); return; }
    api(`/api/stock/levels${qs({ skuId: sku.id })}`).then(setLevels).catch(() => setLevels([]));
  }, [sku, recent.data]);

  const shelf = levels.find((l) => l.warehouseId === warehouseId && l.location === location.trim());
  const current = shelf?.onHand ?? 0;
  const n = Number(qty);
  const valid = sku && warehouseId && qty !== '' && Number.isInteger(n) && (reason === 'OTHER' ? n !== 0 : reason === 'COUNT' ? n >= 0 : n >= 1);
  const delta = reason === 'COUNT' ? n - current : reason === 'OTHER' ? n : -n;

  const save = async () => {
    const body: any = { skuId: sku.id, warehouseId, location: location.trim(), reason, note: note || undefined };
    if (reason === 'COUNT') body.countedQty = n; else if (reason === 'OTHER') body.change = n; else body.quantity = n;
    if (await run(() => api('/api/stock/adjust', { method: 'POST', body }), 'Adjustment saved')) { setQty(''); setNote(''); recent.reload(); }
  };

  return (
    <>
      <PageHeader title="Stock adjustments" subtitle="Correct stock after a count, or record loss and damage. Every change needs a reason." />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2"><Card title="New adjustment">
          <div className="space-y-4">
            <Field label="Variation"><SkuPicker value={sku} onPick={setSku} /></Field>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Warehouse"><select className="input" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>{warehouses.data?.filter((w) => w.isActive).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></Field>
              <Field label="Shelf location" hint="Leave empty if not used."><input className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="A-03-2" /></Field>
              <Field label="Currently on hand"><input className="input" value={sku ? current : ''} disabled /></Field>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Reason"><select className="input" value={reason} onChange={(e) => { setReason(e.target.value); setQty(''); }}>{REASONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
              <Field label={reason === 'COUNT' ? 'Counted quantity' : reason === 'OTHER' ? 'Change (use a minus to remove)' : 'How many units'}><input className="input" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
            </div>
            <Field label="Note"><textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
            {valid && <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
              {delta === 0 ? 'No change to stock.' : `This ${delta < 0 ? 'lowers' : 'raises'} on hand by ${Math.abs(delta)} (${current} to ${current + delta}).`}
              {['LOST', 'DAMAGED', 'EXPIRED'].includes(reason) ? '' : ''} The change is recorded with your name and cannot be edited later.</div>}
            <div className="flex gap-2"><button className="btn-primary" disabled={busy || !valid} onClick={save}>Save adjustment</button></div>
          </div>
        </Card></div>
        <Card title="Recent adjustments">
          <div className="space-y-3">
            {recent.data?.rows.map((r) => (
              <div key={r.id}><div className="font-medium">{r.sku}: {r.onHandDelta > 0 ? '+' : ''}{r.onHandDelta || r.quarantineDelta}</div><div className="text-xs text-slate-500">{r.ref}, {date(r.createdAt)}, by {r.by}</div></div>
            ))}
            {recent.data && !recent.data.rows.length && <div className="text-sm text-slate-400">None yet.</div>}
          </div>
        </Card>
      </div>
    </>
  );
}

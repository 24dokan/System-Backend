'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Badge, Card, Field, Modal, PageHeader, useAction, useLoad } from '@/components/ui';
import { Pager, Paged, SkuPicker, Table, qs } from '@/components/inventory';
import { useAuth } from '@/lib/auth';

const tone: Record<string, string> = { EXPECTED: 'amber', RECEIVED: 'green', CANCELLED: 'gray' };
const day = (s: string) => new Date(s).toLocaleDateString('en-MY', { dateStyle: 'medium' });

export default function Inbound() {
  const { can } = useAuth();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const list = useLoad<Paged<any>>(() => api(`/api/inbound${qs({ status, page, pageSize: 20 })}`), [status, page]);
  const [creating, setCreating] = useState(false);
  const [receiving, setReceiving] = useState<any | null>(null);
  const { busy, run } = useAction();
  const cancel = async (id: string) => { if (confirm('Cancel this shipment?') && await run(() => api(`/api/inbound/${id}/cancel`, { method: 'POST', body: {} }), 'Cancelled')) list.reload(); };
  return (
    <>
      <PageHeader title="Inbound shipments" subtitle="Stock on its way to the warehouse. Count it when it arrives."
        actions={can('inventory.manage') && <button className="btn-primary" onClick={() => setCreating(true)}>New shipment</button>} />
      <div className="mb-4 flex gap-2">
        {[['', 'All'], ['EXPECTED', 'Expected'], ['RECEIVED', 'Received'], ['CANCELLED', 'Cancelled']].map(([k, l]) => (
          <button key={k} className={status === k ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'} onClick={() => { setStatus(k); setPage(1); }}>{l}</button>
        ))}
      </div>
      <Card>
        <Table head={['Shipment', 'Seller', 'Warehouse', 'Expected', 'Units', 'Status', '']} empty={list.data && !list.data.rows.length ? 'No shipments.' : undefined}>
          {list.data?.rows.map((s) => (
            <tr key={s.id}>
              <td className="px-4 py-3 font-mono">{s.code}</td><td className="px-4 py-3">{s.seller.name}</td><td className="px-4 py-3">{s.warehouse.name}</td>
              <td className="px-4 py-3">{day(s.expectedDate)}</td><td className="px-4 py-3">{s.itemCount}</td>
              <td className="px-4 py-3"><Badge tone={tone[s.status]}>{s.status[0] + s.status.slice(1).toLowerCase()}</Badge></td>
              <td className="px-4 py-3 text-right">{s.status === 'EXPECTED' && can('inventory.manage') && <div className="flex justify-end gap-2">
                <button className="btn-primary btn-sm" onClick={() => setReceiving(s)}>Receive</button>
                <button className="btn-secondary btn-sm" disabled={busy} onClick={() => cancel(s.id)}>Cancel</button></div>}</td>
            </tr>
          ))}
        </Table>
        {list.data && <Pager page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} />}
      </Card>
      {creating && <Create onClose={() => setCreating(false)} onDone={() => { setCreating(false); list.reload(); }} />}
      {receiving && <Receive s={receiving} onClose={() => setReceiving(null)} onDone={() => { setReceiving(null); list.reload(); }} />}
    </>
  );
}

function Create({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { busy, run } = useAction();
  const sellers = useLoad<any>(() => api('/api/sellers?pageSize=200'));
  const warehouses = useLoad<any[]>(() => api('/api/warehouses'));
  const [sellerId, setSellerId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [expectedDate, setDate] = useState('');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<{ sku: any | null; qty: string }[]>([{ sku: null, qty: '' }]);
  const sellerList: any[] = Array.isArray(sellers.data) ? sellers.data : sellers.data?.rows ?? sellers.data?.items ?? [];
  const setLine = (i: number, p: any) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));
  const ok = sellerId && warehouseId && expectedDate && lines.every((l) => l.sku && Number(l.qty) >= 1);
  const save = async () => {
    const body = { sellerId, warehouseId, expectedDate, note: note || undefined, lines: lines.map((l) => ({ skuId: l.sku.id, expectedQty: Number(l.qty) })) };
    if (await run(() => api('/api/inbound', { method: 'POST', body }), 'Shipment created')) onDone();
  };
  return (
    <Modal title="New inbound shipment" onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Seller"><select className="input" value={sellerId} onChange={(e) => { setSellerId(e.target.value); setLines([{ sku: null, qty: '' }]); }}><option value="">Choose</option>{sellerList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
          <Field label="Warehouse"><select className="input" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}><option value="">Choose</option>{warehouses.data?.filter((w) => w.isActive).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></Field>
          <Field label="Expected on"><input type="date" className="input" value={expectedDate} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        {sellerId && lines.map((l, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="flex-1"><SkuPicker sellerId={sellerId} value={l.sku} onPick={(s) => setLine(i, { sku: s })} /></div>
            <input className="input w-24" placeholder="Qty" inputMode="numeric" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} />
            {lines.length > 1 && <button className="btn-secondary btn-sm mt-1.5" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>Remove</button>}
          </div>
        ))}
        {sellerId && <button className="btn-secondary btn-sm" onClick={() => setLines((ls) => [...ls, { sku: null, qty: '' }])}>Add another variation</button>}
        <Field label="Note"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <div className="flex gap-2"><button className="btn-primary" disabled={busy || !ok} onClick={save}>Create shipment</button><button className="btn-secondary" onClick={onClose}>Cancel</button></div>
      </div>
    </Modal>
  );
}

function Receive({ s, onClose, onDone }: { s: any; onClose: () => void; onDone: () => void }) {
  const { busy, run } = useAction();
  const [rows, setRows] = useState(s.lines.map((l: any) => ({ lineId: l.id, receivedQty: String(l.expectedQty), damagedQty: '0', location: '' })));
  const set = (i: number, p: any) => setRows((rs: any[]) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const ok = rows.every((r: any) => Number.isInteger(Number(r.receivedQty)) && Number(r.receivedQty) >= 0 && Number.isInteger(Number(r.damagedQty)) && Number(r.damagedQty) >= 0);
  const save = async () => {
    const body = { lines: rows.map((r: any) => ({ lineId: r.lineId, receivedQty: Number(r.receivedQty), damagedQty: Number(r.damagedQty), location: r.location || undefined })) };
    if (await run(() => api(`/api/inbound/${s.id}/receive`, { method: 'POST', body }), 'Stock received')) onDone();
  };
  return (
    <Modal title={`Receive ${s.code}`} onClose={onClose} wide>
      <div className="space-y-4">
        <p className="text-sm text-slate-500">Enter what actually arrived. Good units go on the shelf. Damaged units are held in quarantine and cannot be sold.</p>
        <Table head={['SKU', 'Product', 'Expected', 'Good', 'Damaged', 'Shelf']}>
          {s.lines.map((l: any, i: number) => (
            <tr key={l.id}>
              <td className="px-4 py-2 font-mono">{l.code}</td><td className="px-4 py-2">{l.product}{l.variation ? `, ${l.variation}` : ''}</td><td className="px-4 py-2">{l.expectedQty}</td>
              <td className="px-4 py-2"><input className="input w-20" value={rows[i].receivedQty} onChange={(e) => set(i, { receivedQty: e.target.value })} /></td>
              <td className="px-4 py-2"><input className="input w-20" value={rows[i].damagedQty} onChange={(e) => set(i, { damagedQty: e.target.value })} /></td>
              <td className="px-4 py-2"><input className="input w-28" placeholder="A-03-2" value={rows[i].location} onChange={(e) => set(i, { location: e.target.value })} /></td>
            </tr>
          ))}
        </Table>
        <div className="flex gap-2"><button className="btn-primary" disabled={busy || !ok} onClick={save}>Confirm received</button><button className="btn-secondary" onClick={onClose}>Cancel</button></div>
      </div>
    </Modal>
  );
}

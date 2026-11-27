'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Badge, Card, Field, Modal, PageHeader, Spinner, useAction, useLoad } from '@/components/ui';
import { Table } from '@/components/inventory';
import { useAuth } from '@/lib/auth';

export default function Warehouses() {
  const { can } = useAuth();
  const list = useLoad<any[]>(() => api('/api/warehouses'));
  const [edit, setEdit] = useState<any | 'new' | null>(null);
  if (!list.data) return <Spinner />;
  return (
    <>
      <PageHeader title="Warehouses" subtitle="Where stock is held. Orders are packed from the warehouse that has the stock."
        actions={can('warehouses.manage') && <button className="btn-primary" onClick={() => setEdit('new')}>Add warehouse</button>} />
      <Card>
        <Table head={['Warehouse', 'Code', 'City', 'Variations', 'On hand', 'Status', '']} empty={list.data.length ? undefined : 'No warehouses yet.'}>
          {list.data.map((w) => (
            <tr key={w.id}>
              <td className="px-4 py-3 font-medium">{w.name}</td><td className="px-4 py-3 font-mono">{w.code}</td><td className="px-4 py-3">{w.city ?? '-'}</td>
              <td className="px-4 py-3">{w.variations}</td><td className="px-4 py-3">{w.onHand.toLocaleString()}</td>
              <td className="px-4 py-3"><Badge tone={w.isActive ? 'green' : 'gray'}>{w.isActive ? 'Active' : 'Switched off'}</Badge></td>
              <td className="px-4 py-3 text-right">{can('warehouses.manage') && <button className="btn-secondary btn-sm" onClick={() => setEdit(w)}>Edit</button>}</td>
            </tr>
          ))}
        </Table>
      </Card>
      {edit && <Form w={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); list.reload(); }} />}
    </>
  );
}

function Form({ w, onClose, onDone }: { w: any | null; onClose: () => void; onDone: () => void }) {
  const { busy, run } = useAction();
  const [f, setF] = useState({ name: w?.name ?? '', code: w?.code ?? '', city: w?.city ?? '', address: w?.address ?? '', contact: w?.contact ?? '', isActive: w?.isActive ?? true });
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));
  const save = async () => {
    const { code, ...rest } = f;
    const body = w ? rest : f;
    if (await run(() => api(w ? `/api/warehouses/${w.id}` : '/api/warehouses', { method: w ? 'PATCH' : 'POST', body }), 'Saved')) onDone();
  };
  return (
    <Modal title={w ? 'Edit warehouse' : 'Add warehouse'} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Name"><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus /></Field>
        {!w && <Field label="Short code" hint="For example KL. Cannot be changed later."><input className="input" value={f.code} onChange={(e) => set('code', e.target.value)} /></Field>}
        <Field label="City"><input className="input" value={f.city} onChange={(e) => set('city', e.target.value)} /></Field>
        <Field label="Address"><textarea className="input" value={f.address} onChange={(e) => set('address', e.target.value)} /></Field>
        <Field label="Contact"><input className="input" value={f.contact} onChange={(e) => set('contact', e.target.value)} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.isActive} onChange={(e) => set('isActive', e.target.checked)} /> Active, can receive and ship stock</label>
        <div className="flex gap-2"><button className="btn-primary" disabled={busy || !f.name || (!w && !f.code)} onClick={save}>Save</button><button className="btn-secondary" onClick={onClose}>Cancel</button></div>
      </div>
    </Modal>
  );
}

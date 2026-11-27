'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Badge, Card, Empty, Field, Modal, PageHeader, Spinner, useAction, useLoad } from '@/components/ui';

const tone = (s: string) => (s === 'APPROVED' ? 'green' : s === 'PENDING' ? 'amber' : 'red');

export default function Options() {
  const [tab, setTab] = useState<'all' | 'PENDING'>('all');
  const list = useLoad<any[]>(() => api(`/api/admin/options${tab === 'PENDING' ? '?status=PENDING' : ''}`), [tab]);
  const { busy, run } = useAction();
  const [creating, setCreating] = useState(false);
  const [adding, setAdding] = useState<any | null>(null);
  const [rejecting, setRejecting] = useState<{ kind: 'option' | 'value'; id: string; label: string } | null>(null);
  if (!list.data) return <Spinner />;

  const act = async (path: string, msg: string) => { if (await run(() => api(path, { method: 'POST', body: {} }), msg)) list.reload(); };

  return (
    <>
      <PageHeader title="Option library" subtitle="The shared Size, Colour and other options sellers choose from. Sellers can request new ones."
        actions={<button className="btn-primary" onClick={() => setCreating(true)}>Add option</button>} />
      <div className="mb-4 flex gap-2">
        {([['all', 'All'], ['PENDING', 'Needs approval']] as const).map(([k, l]) => (
          <button key={k} className={tab === k ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {!list.data.length ? <Card><Empty>{tab === 'PENDING' ? 'Nothing is waiting for approval.' : 'No options yet.'}</Empty></Card> : (
        <div className="space-y-4">
          {list.data.map((d) => (
            <Card key={d.id} title={d.name} actions={
              <div className="flex items-center gap-2">
                <Badge tone={tone(d.status)}>{d.status === 'PENDING' ? 'Requested by a seller' : d.status === 'APPROVED' ? 'Approved' : 'Declined'}</Badge>
                {d.status === 'PENDING' && <>
                  <button className="btn-primary btn-sm" disabled={busy} onClick={() => act(`/api/admin/options/${d.id}/approve`, 'Option approved')}>Approve</button>
                  <button className="btn-secondary btn-sm" onClick={() => setRejecting({ kind: 'option', id: d.id, label: d.name })}>Decline</button>
                </>}
                {d.status === 'APPROVED' && <button className="btn-secondary btn-sm" onClick={() => setAdding(d)}>Add values</button>}
              </div>
            }>
              <div className="flex flex-wrap gap-2">
                {d.values.map((v: any) => (
                  <span key={v.id} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-sm">
                    {v.value}
                    {v.status === 'PENDING' && d.status === 'APPROVED' && <>
                      <Badge tone="amber">requested</Badge>
                      <button className="text-emerald-700 hover:underline" disabled={busy} onClick={() => act(`/api/admin/options/values/${v.id}/approve`, 'Value approved')}>Approve</button>
                      <button className="text-red-700 hover:underline" onClick={() => setRejecting({ kind: 'value', id: v.id, label: `${d.name}: ${v.value}` })}>Decline</button>
                    </>}
                    {v.status === 'REJECTED' && <Badge tone="red">declined</Badge>}
                  </span>
                ))}
                {!d.values.length && <span className="text-sm text-slate-400">No values yet</span>}
              </div>
            </Card>
          ))}
        </div>
      )}
      {creating && <CreateForm onClose={() => setCreating(false)} onDone={() => { setCreating(false); list.reload(); }} />}
      {adding && <ValuesForm def={adding} onClose={() => setAdding(null)} onDone={() => { setAdding(null); list.reload(); }} />}
      {rejecting && <RejectForm item={rejecting} onClose={() => setRejecting(null)} onDone={() => { setRejecting(null); list.reload(); }} />}
    </>
  );
}

const split = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

function CreateForm({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { busy, run } = useAction();
  const [name, setName] = useState('');
  const [values, setValues] = useState('');
  const save = async () => { if (await run(() => api('/api/admin/options', { body: { name, values: split(values) } }), 'Option added')) onDone(); };
  return (
    <Modal title="Add option" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Option name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Size" autoFocus /></Field>
        <Field label="Values, separated by commas"><input className="input" value={values} onChange={(e) => setValues(e.target.value)} placeholder="S, M, L" /></Field>
        <div className="flex justify-end gap-2"><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy || !name.trim()} onClick={save}>Add</button></div>
      </div>
    </Modal>
  );
}

function ValuesForm({ def, onClose, onDone }: { def: any; onClose: () => void; onDone: () => void }) {
  const { busy, run } = useAction();
  const [values, setValues] = useState('');
  const save = async () => { if (await run(() => api(`/api/admin/options/${def.id}/values`, { body: { values: split(values) } }), 'Values added')) onDone(); };
  return (
    <Modal title={`Add values to ${def.name}`} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Values, separated by commas"><input className="input" value={values} onChange={(e) => setValues(e.target.value)} autoFocus /></Field>
        <div className="flex justify-end gap-2"><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy || !split(values).length} onClick={save}>Add</button></div>
      </div>
    </Modal>
  );
}

function RejectForm({ item, onClose, onDone }: { item: { kind: string; id: string; label: string }; onClose: () => void; onDone: () => void }) {
  const { busy, run } = useAction();
  const [reason, setReason] = useState('');
  const path = item.kind === 'option' ? `/api/admin/options/${item.id}/reject` : `/api/admin/options/values/${item.id}/reject`;
  const save = async () => { if (await run(() => api(path, { body: { reason } }), 'Declined')) onDone(); };
  return (
    <Modal title={`Decline ${item.label}`} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Reason (shown to the seller)"><textarea className="input min-h-[80px]" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus /></Field>
        <div className="flex justify-end gap-2"><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy} onClick={save}>Decline</button></div>
      </div>
    </Modal>
  );
}

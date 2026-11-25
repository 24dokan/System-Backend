'use client';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { date, flattenCategories, fromMinor, money, toMinor } from '@/lib/format';
import { Card, Empty, Field, Modal, PageHeader, Spinner, StatusBadge, useAction, useLoad } from '@/components/ui';

const ACTION_LABEL: Record<string, string> = {
  SUBMIT: 'Submitted for review', RESUBMIT: 'Resubmitted', APPROVE: 'Approved', REJECT: 'Rejected',
  REVISION_SUBMIT: 'Change proposed', REVISION_APPROVE: 'Change approved', REVISION_REJECT: 'Change rejected',
};

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const product = useLoad(() => api(`/api/products/${id}`), [id]);
  const history = useLoad(() => api(`/api/products/${id}/history`), [id]);
  const cats = useLoad(() => api('/api/categories'));
  const { busy, run } = useAction();
  const [revising, setRevising] = useState(false);

  const p = product.data;
  if (product.loading && !p) return <Spinner />;
  if (!p) return <p className="text-red-600">{product.error || 'Not found'}</p>;
  const editable = p.status === 'DRAFT' || p.status === 'REJECTED';
  const refresh = () => { product.reload(); history.reload(); };
  const lastReject = [...(history.data ?? [])].reverse().find((e: any) => e.action === 'REJECT' || e.action === 'REVISION_REJECT');

  const submit = async () => { if (await run(() => api(`/api/products/${id}/submit`, { method: 'POST' }), 'Submitted for review')) refresh(); };

  return (
    <>
      <PageHeader title={p.name} subtitle={p.category?.name} actions={<>
        <StatusBadge status={p.status} />
        {editable && <button className="btn-primary" disabled={busy} onClick={submit}>Submit for review</button>}
        {p.status === 'APPROVED' && <button className="btn-primary" onClick={() => setRevising(true)}>Propose changes</button>}
      </>} />

      {p.status === 'REJECTED' && lastReject && (
        <div className="mb-5 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900"><b>Rejected:</b> {lastReject.reason} <span className="text-red-700">Fix the issues and submit again.</span></div>
      )}
      {p.status === 'PENDING' && <div className="mb-5 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">This product is waiting for review and cannot be edited.</div>}
      {p.status === 'PENDING_REVISION' && <div className="mb-5 rounded-md border border-sky-300 bg-sky-50 p-4 text-sm text-sky-900">Your proposed changes are under review. The live product stays as it was until they are approved.</div>}
      {p.status === 'APPROVED' && <div className="mb-5 rounded-md border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">Approved and live. To change details or prices, use <b>Propose changes</b>.</div>}

      <div className="space-y-5">
        <Details p={p} editable={editable} tree={cats.data} onSaved={refresh} />
        <Options p={p} editable={editable} onSaved={refresh} />
        <Skus p={p} editable={editable} onSaved={refresh} />
        <Card title="History">
          {!history.data?.length ? <Empty>No decisions yet.</Empty> : (
            <ul className="space-y-2 text-sm">
              {history.data.map((e: any) => (
                <li key={e.id} className="flex gap-3"><span className="w-40 shrink-0 text-slate-400">{date(e.createdAt)}</span><span><b>{ACTION_LABEL[e.action] ?? e.action}</b>{e.reason ? ` — ${e.reason}` : ''}</span></li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      {revising && <Revision p={p} onClose={() => setRevising(false)} onDone={() => { setRevising(false); refresh(); }} />}
    </>
  );
}

function Details({ p, editable, tree, onSaved }: any) {
  const { busy, run } = useAction();
  const [name, setName] = useState(p.name);
  const [description, setDescription] = useState(p.description ?? '');
  const [categoryId, setCategoryId] = useState(p.categoryId);
  const cats = tree ? flattenCategories(tree) : [];
  const save = async () => { if (await run(() => api(`/api/products/${p.id}`, { method: 'PATCH', body: { name, description, categoryId } }), 'Saved')) onSaved(); };
  return (
    <Card title="Details">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name"><input className="input" disabled={!editable} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Category">
          <select className="input" disabled={!editable} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </Field>
        <div className="md:col-span-2"><Field label="Description"><textarea className="input min-h-24" disabled={!editable} value={description} onChange={(e) => setDescription(e.target.value)} /></Field></div>
      </div>
      {editable && <button className="btn-primary mt-4" disabled={busy} onClick={save}>Save details</button>}
    </Card>
  );
}

function Options({ p, editable, onSaved }: any) {
  const { busy, run } = useAction();
  const init = () => p.options.map((o: any) => ({ name: o.name, values: o.values.map((v: any) => v.value).join(', ') }));
  const [rows, setRows] = useState<{ name: string; values: string }[]>(init);
  useEffect(() => setRows(init()), [p]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (i: number, k: 'name' | 'values', v: string) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const parsed = rows.filter((r) => r.name.trim()).map((r) => ({ name: r.name.trim(), values: r.values.split(',').map((x) => x.trim()).filter(Boolean) }));
  const save = async () => {
    if (parsed.some((o) => !o.values.length)) return run(async () => { throw new Error('Each option needs at least one value'); });
    if (await run(() => api(`/api/products/${p.id}/options`, { method: 'PUT', body: { options: parsed } }), 'Options saved')) onSaved();
  };
  return (
    <Card title="Options (e.g. Size, Colour)">
      {!editable && !rows.length && <Empty>This product has no options.</Empty>}
      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={i} className="grid items-end gap-3 md:grid-cols-[200px_1fr_auto]">
            <Field label="Option name"><input className="input" disabled={!editable} value={r.name} onChange={(e) => set(i, 'name', e.target.value)} placeholder="Size" /></Field>
            <Field label="Values (comma separated)"><input className="input" disabled={!editable} value={r.values} onChange={(e) => set(i, 'values', e.target.value)} placeholder="S, M, L" /></Field>
            {editable && <button className="btn-secondary" onClick={() => setRows(rows.filter((_, j) => j !== i))}>Remove</button>}
          </div>
        ))}
      </div>
      {editable && (
        <div className="mt-4 flex gap-2">
          {rows.length < 5 && <button className="btn-secondary" onClick={() => setRows([...rows, { name: '', values: '' }])}>Add option</button>}
          <button className="btn-primary" disabled={busy} onClick={save}>Save options</button>
        </div>
      )}
      {editable && <p className="mt-3 text-xs text-slate-500">Changing options removes variations that no longer match. Generate them again afterwards.</p>}
    </Card>
  );
}

function Skus({ p, editable, onSaved }: any) {
  const { busy, run } = useAction();
  const [price, setPrice] = useState('');
  const [edits, setEdits] = useState<Record<string, string>>({});
  const label = new Map<string, string>(p.options.flatMap((o: any) => o.values.map((v: any) => [v.id, v.value] as [string, string])));
  const combos = p.options.reduce((n: number, o: any) => n * o.values.length, 1);

  const generate = async () => {
    const minor = toMinor(price);
    if (minor === null || minor <= 0) return run(async () => { throw new Error('Enter a price above zero, e.g. 59.90'); });
    if (await run(() => api(`/api/products/${p.id}/skus/generate`, { body: { priceMinor: minor } }), 'Variations generated')) onSaved();
  };
  const savePrice = async (sku: any) => {
    const minor = toMinor(edits[sku.id]);
    if (minor === null || minor <= 0) return run(async () => { throw new Error('Enter a valid price'); });
    if (await run(() => api(`/api/products/${p.id}/skus/${sku.id}`, { method: 'PATCH', body: { priceMinor: minor } }), 'Price saved')) {
      setEdits(({ [sku.id]: _, ...rest }) => rest); onSaved();
    }
  };

  return (
    <Card title={`Variations (${p.skus.length})`}>
      {editable && (
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-md bg-slate-50 p-4">
          <div className="w-44"><Field label="Price for new variations (RM)"><input className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="59.90" /></Field></div>
          <button className="btn-primary" disabled={busy} onClick={generate}>Generate {combos} variation{combos === 1 ? '' : 's'}</button>
          <span className="pb-2 text-xs text-slate-500">Creates one SKU per combination. Existing ones are kept.</span>
        </div>
      )}
      {!p.skus.length ? <Empty>No variations yet. Set your options, then generate them.</Empty> : (
        <table className="tbl">
          <thead><tr><th>SKU</th><th>Variation</th><th className="w-48">Price (RM)</th><th></th></tr></thead>
          <tbody>
            {p.skus.map((s: any) => {
              const v = s.values.map((x: any) => label.get(x.optionValueId)).filter(Boolean).join(' / ') || 'Default';
              const dirty = edits[s.id] !== undefined && edits[s.id] !== fromMinor(s.priceMinor);
              return (
                <tr key={s.id}>
                  <td className="font-mono text-xs">{s.code}</td><td>{v}</td>
                  <td>{editable
                    ? <input className="input" inputMode="decimal" value={edits[s.id] ?? fromMinor(s.priceMinor)} onChange={(e) => setEdits({ ...edits, [s.id]: e.target.value })} />
                    : money(s.priceMinor)}</td>
                  <td>{dirty && <button className="btn-primary btn-sm" disabled={busy} onClick={() => savePrice(s)}>Save</button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function Revision({ p, onClose, onDone }: any) {
  const { busy, run } = useAction();
  const [name, setName] = useState(p.name);
  const [description, setDescription] = useState(p.description ?? '');
  const [prices, setPrices] = useState<Record<string, string>>(Object.fromEntries(p.skus.map((s: any) => [s.id, fromMinor(s.priceMinor)])));

  const send = async () => {
    const body: any = {};
    if (name !== p.name) body.name = name;
    if (description !== (p.description ?? '')) body.description = description;
    const skus = p.skus.filter((s: any) => prices[s.id] !== fromMinor(s.priceMinor)).map((s: any) => ({ skuId: s.id, priceMinor: toMinor(prices[s.id]) }));
    if (skus.some((s: any) => s.priceMinor === null)) return run(async () => { throw new Error('One of the prices is not valid'); });
    if (skus.length) body.skus = skus;
    if (!Object.keys(body).length) return run(async () => { throw new Error('You have not changed anything'); });
    if (await run(() => api(`/api/products/${p.id}/revisions`, { body }), 'Change sent for review')) onDone();
  };
  return (
    <Modal title="Propose changes" onClose={onClose} wide>
      <p className="mb-4 text-sm text-slate-500">The live product stays as it is until an administrator approves your changes.</p>
      <div className="space-y-4">
        <Field label="Name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Description"><textarea className="input min-h-24" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <div>
          <div className="mb-1 text-sm font-medium">Prices (RM)</div>
          {p.skus.map((s: any) => (
            <div key={s.id} className="mb-2 flex items-center gap-3"><span className="w-56 truncate font-mono text-xs">{s.code}</span>
              <input className="input max-w-40" inputMode="decimal" value={prices[s.id]} onChange={(e) => setPrices({ ...prices, [s.id]: e.target.value })} /></div>
          ))}
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2"><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy} onClick={send}>Send for review</button></div>
    </Modal>
  );
}

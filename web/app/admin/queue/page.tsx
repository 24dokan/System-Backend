'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { date, money } from '@/lib/format';
import { Card, Empty, Field, Modal, PageHeader, Spinner, useAction, useLoad } from '@/components/ui';

type Target = { kind: 'product' | 'revision'; id: string; name: string };

export default function Queue() {
  const { data, loading, reload } = useLoad(() => api('/api/approval/queue'));
  const { busy, run } = useAction();
  const [rejecting, setRejecting] = useState<Target | null>(null);

  const approve = async (t: Target) => {
    const url = t.kind === 'product' ? `/api/approval/products/${t.id}/approve` : `/api/approval/revisions/${t.id}/approve`;
    if (await run(() => api(url, { method: 'POST' }), 'Approved')) reload();
  };
  if (loading || !data) return <Spinner />;

  return (
    <>
      <PageHeader title="Review queue" subtitle="Oldest first. Rejecting needs a reason the seller can read." />
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">New products ({data.products.length})</h2>
      {!data.products.length ? <Card className="mb-8"><Empty>No new products waiting.</Empty></Card> : data.products.map((p: any) => (
        <Card key={p.id} className="mb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><div className="text-lg font-semibold">{p.name}</div>
              <div className="text-sm text-slate-500">{p.seller.name} · {p.category.name} · submitted {date(p.updatedAt)}</div></div>
            <div className="flex gap-2">
              <button className="btn-secondary" onClick={() => setRejecting({ kind: 'product', id: p.id, name: p.name })}>Reject</button>
              <button className="btn-primary" disabled={busy} onClick={() => approve({ kind: 'product', id: p.id, name: p.name })}>Approve</button>
            </div>
          </div>
          {p.description && <p className="mt-3 whitespace-pre-line text-sm text-slate-700">{p.description}</p>}
          <table className="tbl mt-3"><thead><tr><th>SKU</th><th>Price</th></tr></thead>
            <tbody>{p.skus.map((s: any) => <tr key={s.id}><td className="font-mono text-xs">{s.code}</td><td>{money(s.priceMinor)}</td></tr>)}</tbody></table>
        </Card>
      ))}

      <h2 className="mb-2 mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500">Changes to approved products ({data.revisions.length})</h2>
      {!data.revisions.length ? <Card><Empty>No changes waiting.</Empty></Card> : data.revisions.map((r: any) => {
        const c = r.changes;
        const code = (id: string) => r.product.skus.find((s: any) => s.id === id)?.code ?? id;
        return (
          <Card key={r.id} className="mb-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><div className="text-lg font-semibold">{r.product.name}</div><div className="text-sm text-slate-500">{r.product.seller.name} · proposed {date(r.createdAt)}</div></div>
              <div className="flex gap-2">
                <button className="btn-secondary" onClick={() => setRejecting({ kind: 'revision', id: r.id, name: r.product.name })}>Reject</button>
                <button className="btn-primary" disabled={busy} onClick={() => approve({ kind: 'revision', id: r.id, name: r.product.name })}>Approve</button>
              </div>
            </div>
            <ul className="mt-3 space-y-1 text-sm">
              {c.name && <li>Name: <s className="text-slate-400">{r.product.name}</s> → <b>{c.name}</b></li>}
              {c.description !== undefined && <li>Description changed</li>}
              {c.categoryId && <li>Category changed</li>}
              {c.skus?.map((s: any) => {
                const old = r.product.skus.find((x: any) => x.id === s.skuId);
                return <li key={s.skuId}><span className="font-mono text-xs">{code(s.skuId)}</span>: {s.priceMinor !== undefined && <>price <s className="text-slate-400">{money(old?.priceMinor)}</s> → <b>{money(s.priceMinor)}</b></>}{s.isActive !== undefined && ` active: ${s.isActive}`}</li>;
              })}
            </ul>
          </Card>
        );
      })}
      {rejecting && <Reject target={rejecting} onClose={() => setRejecting(null)} onDone={() => { setRejecting(null); reload(); }} />}
    </>
  );
}

function Reject({ target, onClose, onDone }: { target: Target; onClose: () => void; onDone: () => void }) {
  const { busy, run } = useAction();
  const [reason, setReason] = useState('');
  const send = async () => {
    const url = target.kind === 'product' ? `/api/approval/products/${target.id}/reject` : `/api/approval/revisions/${target.id}/reject`;
    if (await run(() => api(url, { body: { reason } }), 'Rejected')) onDone();
  };
  return (
    <Modal title={`Reject: ${target.name}`} onClose={onClose}>
      <Field label="Reason (shown to the seller)"><textarea className="input min-h-28" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus /></Field>
      <div className="mt-4 flex justify-end gap-2"><button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-danger" disabled={busy || reason.trim().length < 3} onClick={send}>Reject</button></div>
    </Modal>
  );
}

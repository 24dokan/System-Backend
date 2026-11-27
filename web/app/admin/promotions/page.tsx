'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Badge, Card, Field, Modal, PageHeader, useAction, useLoad } from '@/components/ui';
import { Pager, Paged, Table, qs } from '@/components/inventory';
import { date } from '@/lib/format';
import { PROMO_LABEL, PROMO_TONE, off } from '@/components/promotions';

export default function PromotionReview() {
  const [status, setStatus] = useState('PENDING');
  const [page, setPage] = useState(1);
  const list = useLoad<Paged<any>>(() => api(`/api/promotions${qs({ status, page, pageSize: 20 })}`), [status, page]);
  const { busy, run } = useAction();
  const [rejecting, setRejecting] = useState<any | null>(null);
  const approve = async (id: string) => { if (await run(() => api(`/api/promotions/${id}/approve`, { method: 'POST', body: {} }), 'Promotion approved')) list.reload(); };
  return (
    <>
      <PageHeader title="Promotions" subtitle="Seller discounts waiting for your approval. An approved promotion starts on its start date." />
      <div className="mb-4 flex gap-2">
        {[['PENDING', 'Needs approval'], ['APPROVED', 'Approved'], ['REJECTED', 'Declined'], ['CANCELLED', 'Cancelled'], ['', 'All']].map(([k, l]) => (
          <button key={k} className={status === k ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'} onClick={() => { setStatus(k); setPage(1); }}>{l}</button>
        ))}
      </div>
      <Card>
        <Table head={['Promotion', 'Seller', 'Product', 'Discount', 'Runs', 'Status', '']} empty={list.data && !list.data.rows.length ? 'Nothing here.' : undefined}>
          {list.data?.rows.map((p) => (
            <tr key={p.id}>
              <td className="px-4 py-3 font-medium">{p.name}</td><td className="px-4 py-3">{p.seller}</td>
              <td className="px-4 py-3">{p.product}{p.skuCode && <div className="font-mono text-xs text-slate-500">{p.skuCode}</div>}</td>
              <td className="px-4 py-3">{off(p)}</td><td className="px-4 py-3 text-slate-500">{date(p.startsAt)}<br />to {date(p.endsAt)}</td>
              <td className="px-4 py-3"><Badge tone={PROMO_TONE[p.status]}>{p.live ? 'Live now' : PROMO_LABEL[p.status]}</Badge></td>
              <td className="px-4 py-3 text-right">{p.status === 'PENDING' && <div className="flex justify-end gap-2"><button className="btn-primary btn-sm" disabled={busy} onClick={() => approve(p.id)}>Approve</button><button className="btn-secondary btn-sm" onClick={() => setRejecting(p)}>Decline</button></div>}</td>
            </tr>
          ))}
        </Table>
        {list.data && <Pager page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} />}
      </Card>
      {rejecting && <Reject p={rejecting} onClose={() => setRejecting(null)} onDone={() => { setRejecting(null); list.reload(); }} />}
    </>
  );
}

function Reject({ p, onClose, onDone }: { p: any; onClose: () => void; onDone: () => void }) {
  const { busy, run } = useAction();
  const [reason, setReason] = useState('');
  return (
    <Modal title={`Decline "${p.name}"`} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Reason (shown to the seller)"><textarea className="input min-h-[80px]" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus /></Field>
        <div className="flex gap-2"><button className="btn-danger" disabled={busy || reason.trim().length < 3} onClick={async () => { if (await run(() => api(`/api/promotions/${p.id}/reject`, { method: 'POST', body: { reason } }), 'Declined')) onDone(); }}>Decline</button><button className="btn-secondary" onClick={onClose}>Cancel</button></div>
      </div>
    </Modal>
  );
}

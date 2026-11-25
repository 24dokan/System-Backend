'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { date, fromMinor, money, toMinor } from '@/lib/format';
import { Card, Empty, Field, Modal, PageHeader, Spinner, StatusBadge, useAction, useLoad } from '@/components/ui';

export default function Payments() {
  const [status, setStatus] = useState('AWAITING_PAYMENT');
  const { data, loading, reload } = useLoad(() => api(`/api/subscriptions${status ? `?status=${status}` : ''}`), [status]);
  const [confirming, setConfirming] = useState<any>(null);
  return (
    <>
      <PageHeader title="Subscriptions & payments" subtitle="Confirm bank transfers once the money has arrived" />
      <select className="input mb-4 max-w-xs" value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="AWAITING_PAYMENT">Awaiting payment</option><option value="PENDING_APPROVAL">Awaiting account approval</option>
        <option value="ACTIVE">Active</option><option value="CANCELLED">Cancelled</option><option value="">All</option>
      </select>
      <Card className="!p-0">
        {loading || !data ? <Spinner /> : !data.length ? <Empty>Nothing here.</Empty> : (
          <table className="tbl">
            <thead><tr><th>Seller</th><th>Package</th><th>Amount</th><th>Status</th><th>Requested</th><th></th></tr></thead>
            <tbody>
              {data.map((s: any) => (
                <tr key={s.id}>
                  <td className="font-medium">{s.seller.name}</td><td>{s.package.name}</td><td>{money(s.package.priceMinor, s.package.currency)}</td>
                  <td><StatusBadge status={s.status} /></td><td className="text-slate-500">{date(s.createdAt)}</td>
                  <td className="text-right">{s.status === 'AWAITING_PAYMENT' && <button className="btn-primary btn-sm" onClick={() => setConfirming(s)}>Confirm payment</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      {confirming && <Confirm sub={confirming} onClose={() => setConfirming(null)} onDone={() => { setConfirming(null); reload(); }} />}
    </>
  );
}

function Confirm({ sub, onClose, onDone }: any) {
  const { busy, run } = useAction();
  const [amount, setAmount] = useState(sub.package.priceMinor != null ? fromMinor(sub.package.priceMinor) : '');
  const [reference, setReference] = useState('');
  const send = async () => {
    const minor = toMinor(amount);
    if (minor === null) return run(async () => { throw new Error('Enter the amount received'); });
    if (await run(() => api(`/api/subscriptions/${sub.id}/confirm-payment`, { body: { amountMinor: minor, reference: reference || undefined } }), 'Payment confirmed. Subscription active.')) onDone();
  };
  return (
    <Modal title={`Confirm payment: ${sub.seller.name}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">Package <b>{sub.package.name}</b>. This activates the subscription and replaces the seller's previous one.</p>
        <Field label="Amount received (RM)"><input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="Bank reference (optional)"><input className="input" value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
        <div className="flex justify-end gap-2"><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy} onClick={send}>Confirm</button></div>
      </div>
    </Modal>
  );
}

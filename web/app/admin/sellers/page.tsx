'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { date } from '@/lib/format';
import { Card, Empty, PageHeader, Spinner, StatusBadge, useAction, useLoad } from '@/components/ui';

export default function Sellers() {
  const [status, setStatus] = useState('');
  const { data, loading, reload } = useLoad(() => api(`/api/sellers${status ? `?status=${status}` : ''}`), [status]);
  const { busy, run } = useAction();
  const act = async (id: string, what: 'approve' | 'suspend') => {
    if (await run(() => api(`/api/sellers/${id}/${what}`, { method: 'POST' }), what === 'approve' ? 'Seller approved' : 'Seller suspended')) reload();
  };
  return (
    <>
      <PageHeader title="Sellers" subtitle="A brand and a seller are the same thing" />
      <select className="input mb-4 max-w-xs" value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="">All</option><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="SUSPENDED">Suspended</option>
      </select>
      <Card className="!p-0">
        {loading || !data ? <Spinner /> : !data.length ? <Empty>No sellers.</Empty> : (
          <table className="tbl">
            <thead><tr><th>Brand</th><th>Status</th><th>Registered</th><th></th></tr></thead>
            <tbody>
              {data.map((s: any) => (
                <tr key={s.id}>
                  <td><div className="font-medium">{s.name}</div><div className="text-xs text-slate-400">{s.slug}</div></td>
                  <td><StatusBadge status={s.status} /></td><td className="text-slate-500">{date(s.createdAt)}</td>
                  <td className="text-right">
                    {s.status !== 'APPROVED' && <button className="btn-primary btn-sm mr-2" disabled={busy} onClick={() => act(s.id, 'approve')}>Approve</button>}
                    {s.status !== 'SUSPENDED' && <button className="btn-secondary btn-sm" disabled={busy} onClick={() => act(s.id, 'suspend')}>Suspend</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}

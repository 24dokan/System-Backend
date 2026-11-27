'use client';
import { useState } from 'react';
import { api, download } from '@/lib/api';
import { Badge, Card, PageHeader, useAction, useLoad } from '@/components/ui';
import { Pager, Paged, Table, qs } from '@/components/inventory';
import { useAuth } from '@/lib/auth';

export default function Marketplace() {
  const { can } = useAuth();
  const [page, setPage] = useState(1);
  const list = useLoad<Paged<any>>(() => api(`/api/marketplace-updates${qs({ page, pageSize: 25 })}`), [page]);
  const { busy, run } = useAction();
  const sendAll = async () => { if (await run(() => api('/api/marketplace-updates/sent', { method: 'POST', body: {} }), 'Marked as sent')) { setPage(1); list.reload(); } };
  return (
    <>
      <PageHeader title="Marketplace updates" subtitle="Stock levels to send to Shopee, Lazada and TikTok so they never oversell."
        actions={<div className="flex gap-2">
          <button className="btn-secondary" onClick={() => download('/api/marketplace-updates/file', 'marketplace-stock-update.csv')}>Download update file</button>
          {can('inventory.manage') && <button className="btn-primary" disabled={busy || !list.data?.total} onClick={sendAll}>Mark all as sent</button>}
        </div>} />
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4"><div className="text-2xl font-semibold">{list.data?.total ?? '-'}</div><div className="text-sm text-slate-500">Changes waiting to be sent</div></div>
      </div>
      <Card title="Waiting to be sent" actions={<Badge tone="gray">Direct connections come in a later phase</Badge>}>
        <Table head={['SKU', 'Product / variation', 'Available now', 'Last sent']} empty={list.data && !list.data.rows.length ? 'Everything is up to date.' : undefined}>
          {list.data?.rows.map((r) => (
            <tr key={r.skuId}>
              <td className="px-4 py-3 font-mono">{r.code}</td>
              <td className="px-4 py-3"><div className="font-medium">{r.product}</div><div className="text-xs text-slate-500">{r.variation}</div></td>
              <td className="px-4 py-3 font-semibold">{Math.max(0, r.available)}</td><td className="px-4 py-3">{r.syncedQty ?? 'Never'}</td>
            </tr>
          ))}
        </Table>
        {list.data && <Pager page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} />}
      </Card>
      <p className="mt-3 text-sm text-slate-500">Download the file and upload it to each marketplace, then press "Mark all as sent".</p>
    </>
  );
}

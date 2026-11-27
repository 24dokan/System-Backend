'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Badge, Card, Field, Modal, PageHeader, useAction, useLoad } from '@/components/ui';
import { Pager, Paged, Table, qs, useDebounced } from '@/components/inventory';
import { date } from '@/lib/format';
import { useAuth } from '@/lib/auth';

const LABEL: Record<string, string> = { TO_INSPECT: 'To inspect', SELLER_CHECK: 'Seller to check', RESTOCKED: 'Restocked', DAMAGED: 'Damaged' };
const TONE: Record<string, string> = { TO_INSPECT: 'amber', SELLER_CHECK: 'purple', RESTOCKED: 'green', DAMAGED: 'red' };

export default function Returns() {
  const { can } = useAuth();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const ds = useDebounced(search);
  const list = useLoad<Paged<any> & { counts: Record<string, number> }>(() => api(`/api/returns${qs({ status, search: ds, page, pageSize: 25 })}`), [status, ds, page]);
  const [inspecting, setInspecting] = useState<any | null>(null);
  return (
    <>
      <PageHeader title="Returns" subtitle="Returned and cancelled-after-packing units wait here until someone inspects them." />
      <div className="mb-4 flex flex-wrap gap-2">
        {[['', 'All'], ...Object.entries(LABEL)].map(([k, l]) => (
          <button key={k} className={status === k ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'} onClick={() => { setStatus(k); setPage(1); }}>{l}{k && list.data?.counts[k] ? ` (${list.data.counts[k]})` : ''}</button>
        ))}
        <input className="input ml-auto max-w-xs" placeholder="Search return or SKU" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>
      <Card>
        <Table head={['Return', 'Order', 'SKU', 'Product', 'Qty', 'Reason', 'Received', 'Status', '']} empty={list.data && !list.data.rows.length ? 'No returns.' : undefined}>
          {list.data?.rows.map((r) => (
            <tr key={r.id}>
              <td className="px-4 py-3 font-mono">{r.code}</td><td className="px-4 py-3 font-mono">{r.orderNumber ? `#${r.orderNumber}` : '-'}</td><td className="px-4 py-3 font-mono">{r.sku}</td>
              <td className="px-4 py-3">{r.product}<div className="text-xs text-slate-500">{r.variation}</div></td><td className="px-4 py-3">{r.qty}</td>
              <td className="px-4 py-3 text-slate-600">{r.reason ?? '-'}</td><td className="px-4 py-3 text-slate-500">{date(r.receivedAt)}</td>
              <td className="px-4 py-3"><Badge tone={TONE[r.status]}>{LABEL[r.status]}</Badge></td>
              <td className="px-4 py-3 text-right">{['TO_INSPECT', 'SELLER_CHECK'].includes(r.status) && can('returns.manage') && <button className="btn-primary btn-sm" onClick={() => setInspecting(r)}>Inspect</button>}</td>
            </tr>
          ))}
        </Table>
        {list.data && <Pager page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} />}
      </Card>
      {inspecting && <Inspect r={inspecting} onClose={() => setInspecting(null)} onDone={() => { setInspecting(null); list.reload(); }} />}
    </>
  );
}

function Inspect({ r, onClose, onDone }: { r: any; onClose: () => void; onDone: () => void }) {
  const { busy, run } = useAction();
  const [outcome, setOutcome] = useState('RESTOCK');
  const [note, setNote] = useState('');
  return (
    <Modal title={`Inspect ${r.code}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm">{r.qty} x {r.sku}, {r.product}</p>
        <Field label="Result">
          <select className="input" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
            <option value="RESTOCK">Good: put back on the shelf</option><option value="DAMAGED">Damaged: move to quarantine</option><option value="SELLER_CHECK">Needs the seller to check</option>
          </select>
        </Field>
        <Field label="Note"><textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <div className="flex gap-2">
          <button className="btn-primary" disabled={busy || (r.status === 'SELLER_CHECK' && outcome === 'SELLER_CHECK')} onClick={async () => { if (await run(() => api(`/api/returns/${r.id}/inspect`, { method: 'POST', body: { outcome, note: note || undefined } }), 'Saved')) onDone(); }}>Save result</button>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
}

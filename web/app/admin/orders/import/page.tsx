'use client';
import Link from 'next/link';
import { useState } from 'react';
import { api, download } from '@/lib/api';
import { Card, Field, PageHeader, useAction, useLoad } from '@/components/ui';

export default function BulkImport() {
  const sellers = useLoad<any>(() => api('/api/sellers/options'));
  const warehouses = useLoad<any[]>(() => api('/api/warehouses'));
  const { busy, run } = useAction();
  const [sellerId, setSeller] = useState('');
  const [warehouseId, setWarehouse] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const sellerList: any[] = Array.isArray(sellers.data) ? sellers.data : sellers.data?.rows ?? [];

  const go = async (create: boolean) => {
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    const r = await run(() => api<any>(`/api/orders/import?sellerId=${sellerId}&warehouseId=${warehouseId}&create=${create}`, { method: 'POST', form }));
    if (r) setResult(r);
  };
  return (
    <>
      <PageHeader title="Bulk import orders" subtitle="Upload a CSV of marketplace orders. Check it first, then create." actions={<button className="btn-secondary" onClick={() => download('/api/orders/template.csv', 'orders-template.csv')}>Download template</button>} />
      <Card>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Seller"><select className="input" value={sellerId} onChange={(e) => { setSeller(e.target.value); setResult(null); }}><option value="">Choose</option>{sellerList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
          <Field label="Pack from warehouse"><select className="input" value={warehouseId} onChange={(e) => setWarehouse(e.target.value)}><option value="">Choose</option>{warehouses.data?.filter((w) => w.isActive).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></Field>
          <Field label="CSV file"><input type="file" accept=".csv,text/csv" className="input" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); }} /></Field>
        </div>
        <div className="mt-4 flex gap-2">
          <button className="btn-secondary" disabled={busy || !file || !sellerId || !warehouseId} onClick={() => go(false)}>Check file</button>
          <button className="btn-primary" disabled={busy || !file || !sellerId || !warehouseId || !result || result.mode !== 'check' || !result.readyCount} onClick={() => go(true)}>Create {result?.readyCount ?? ''} order(s)</button>
        </div>
      </Card>
      {result && (
        <div className="mt-4 space-y-4">
          <Card title={result.mode === 'check' ? 'Check result' : 'Import result'}>
            <p className="text-sm">{result.mode === 'check' ? `${result.readyCount} order(s) are ready to create.` : `${result.createdCount} order(s) created.`} {result.rejectedCount} could not be used.</p>
            {result.created.length > 0 && <p className="mt-2 text-sm text-slate-500">Created: {result.created.map((c: any) => `#${c.number} (${c.ref})`).join(', ')}. <Link className="text-brand hover:underline" href="/admin/orders">View orders</Link></p>}
          </Card>
          {result.rejected.length > 0 && <Card title="Problems">
            <ul className="space-y-2 text-sm">{result.rejected.map((r: any, i: number) => <li key={i}><span className="font-medium">{r.ref ?? 'Row ' + r.rows[0]}</span> <span className="text-slate-400">(rows {r.rows.join(', ')})</span><ul className="ml-4 list-disc text-red-700">{r.errors.map((e: string, j: number) => <li key={j}>{e}</li>)}</ul></li>)}</ul>
          </Card>}
        </div>
      )}
    </>
  );
}

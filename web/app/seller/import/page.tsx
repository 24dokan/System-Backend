'use client';
import { useRef, useState } from 'react';
import { api, download } from '@/lib/api';
import { Card, PageHeader, useAction } from '@/components/ui';

export default function ImportPage() {
  const { busy, run } = useAction();
  const file = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<any>(null);

  const upload = async () => {
    const f = file.current?.files?.[0];
    if (!f) return run(async () => { throw new Error('Choose a CSV file first'); });
    const form = new FormData(); form.append('file', f);
    const r = await run(() => api('/api/import-export/products', { form }));
    if (r) { setResult(r); if (file.current) file.current.value = ''; }
  };

  return (
    <>
      <PageHeader title="Import / export" subtitle="Add many products at once with a CSV file." />
      <div className="grid gap-5 md:grid-cols-2">
        <Card title="1. Get the template">
          <p className="mb-3 text-sm text-slate-600">One row per variation. Rows with the same <code>product_key</code> belong to one product. Imported products are sent for review as pending.</p>
          <button className="btn-secondary" onClick={() => run(() => download('/api/import-export/template.csv', 'products-template.csv'))}>Download template</button>
        </Card>
        <Card title="Export your products">
          <p className="mb-3 text-sm text-slate-600">Download all your products in the same format.</p>
          <button className="btn-secondary" onClick={() => run(() => download('/api/import-export/products.csv', 'products.csv'))}>Export CSV</button>
        </Card>
      </div>
      <Card title="2. Upload" className="mt-5">
        <div className="flex flex-wrap items-center gap-3">
          <input ref={file} type="file" accept=".csv,text/csv" className="text-sm" />
          <button className="btn-primary" disabled={busy} onClick={upload}>{busy ? 'Importing…' : 'Import'}</button>
        </div>
      </Card>

      {result && (
        <Card title={`Result: ${result.createdCount} created, ${result.rejectedCount} rejected (${result.rows} rows)`} className="mt-5">
          {result.created.length > 0 && (
            <div className="mb-4"><div className="mb-1 text-sm font-medium text-emerald-700">Created (pending review)</div>
              <ul className="text-sm">{result.created.map((c: any) => <li key={c.productId}>{c.key} — {c.skuCount} variation(s)</li>)}</ul></div>
          )}
          {result.rejected.length > 0 && (
            <div><div className="mb-1 text-sm font-medium text-red-700">Rejected</div>
              {result.rejected.map((r: any, i: number) => (
                <div key={i} className="mb-2 rounded-md bg-red-50 p-3 text-sm"><b>{r.key ?? '(no product_key)'}</b>
                  <ul className="mt-1 list-disc pl-5 text-red-900">{r.errors.map((e: string, j: number) => <li key={j}>{e}</li>)}</ul></div>
              ))}</div>
          )}
        </Card>
      )}
    </>
  );
}

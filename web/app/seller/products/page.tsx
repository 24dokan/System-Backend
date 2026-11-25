'use client';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import { date } from '@/lib/format';
import { Card, Empty, PageHeader, Spinner, StatusBadge, useLoad } from '@/components/ui';

const STATUSES = ['', 'DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'PENDING_REVISION'];

export default function Products() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const { data, loading } = useLoad(() => api(`/api/products?page=${page}&pageSize=15${status ? `&status=${status}` : ''}`), [status, page]);

  return (
    <>
      <PageHeader title="My products" actions={<Link className="btn-primary" href="/seller/products/new">Add product</Link>} />
      <div className="mb-4 flex gap-3">
        <select className="input max-w-xs" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          {STATUSES.map((s) => <option key={s} value={s}>{s ? s.replace('_', ' ').toLowerCase() : 'All statuses'}</option>)}
        </select>
      </div>
      <Card className="!p-0">
        {loading || !data ? <Spinner /> : data.items.length === 0 ? <Empty>No products yet. <Link className="text-brand" href="/seller/products/new">Add your first product</Link></Empty> : (
          <table className="tbl">
            <thead><tr><th>Product</th><th>Category</th><th>Variations</th><th>Status</th><th>Updated</th></tr></thead>
            <tbody>
              {data.items.map((p: any) => (
                <tr key={p.id}>
                  <td><Link className="font-medium text-brand hover:underline" href={`/seller/products/${p.id}`}>{p.name}</Link></td>
                  <td>{p.category?.name}</td><td>{p._count.skus}</td><td><StatusBadge status={p.status} /></td><td className="text-slate-500">{date(p.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      {data && data.total > data.pageSize && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-slate-500">{data.total} products</span>
          <div className="flex gap-2">
            <button className="btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
            <button className="btn-secondary btn-sm" disabled={page * data.pageSize >= data.total} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        </div>
      )}
    </>
  );
}

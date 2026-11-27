'use client';
import { ReactNode, useEffect, useState } from 'react';
import { api } from '@/lib/api';

export type Paged<T> = { rows: T[]; total: number; page: number; pageSize: number };

export const qs = (o: Record<string, unknown>) => {
  const p = new URLSearchParams();
  Object.entries(o).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '' && v !== false) p.set(k, String(v)); });
  const s = p.toString();
  return s ? `?${s}` : '';
};

/** Debounced value, so typing in a search box does not send a request per key. */
export function useDebounced<T>(v: T, ms = 300) {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-500">
      <span>Showing {from} to {to} of {total.toLocaleString()}</span>
      <div className="flex gap-2">
        <button className="btn-secondary btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
        <button className="btn-secondary btn-sm" disabled={to >= total} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </div>
  );
}

export function Table({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>{head.map((h, i) => <th key={i} className="px-4 py-2 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
      {empty && <div className="px-4 py-10 text-center text-sm text-slate-400">{empty}</div>}
    </div>
  );
}

/** Finds a variation by code or product name. */
export function SkuPicker({ sellerId, warehouseId, value, onPick, label }: { sellerId?: string; warehouseId?: string; value: any | null; onPick: (s: any | null) => void; label?: string }) {
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [results, setResults] = useState<any[]>([]);
  useEffect(() => {
    if (value || dq.trim().length < 1) { setResults([]); return; }
    let live = true;
    api(`/api/skus/search${qs({ q: dq, sellerId, warehouseId })}`).then((r) => live && setResults(r)).catch(() => live && setResults([]));
    return () => { live = false; };
  }, [dq, sellerId, warehouseId, value]);
  if (value) {
    return (
      <div className="flex items-center justify-between rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm">
        <span><span className="font-mono">{value.code}</span> · {value.product}{value.variation ? `, ${value.variation}` : ''}</span>
        <button type="button" className="text-brand hover:underline" onClick={() => { onPick(null); setQ(''); }}>Change</button>
      </div>
    );
  }
  return (
    <div className="relative">
      <input className="input" placeholder={label ?? 'Type a SKU or product name'} value={q} onChange={(e) => setQ(e.target.value)} />
      {results.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {results.map((s) => (
            <li key={s.id}>
              <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => onPick(s)}>
                <span className="font-mono">{s.code}</span> · {s.product}{s.variation ? `, ${s.variation}` : ''}
                <span className="ml-2 text-xs text-slate-400">{s.available} available</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export const stockTone = (available: number, level: number) => (available <= Math.floor(level / 2) ? 'red' : available <= level ? 'amber' : 'green');
export const stockLabel = (available: number, level: number) => (available <= Math.floor(level / 2) ? 'Very low' : available <= level ? 'Low' : 'OK');

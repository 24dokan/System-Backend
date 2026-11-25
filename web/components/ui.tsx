'use client';
import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';

// ---------- toasts ----------
const ToastCtx = createContext<(msg: string, kind?: 'ok' | 'err') => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string; kind: string }[]>([]);
  const push = useCallback((msg: string, kind: 'ok' | 'err' = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, msg, kind }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), kind === 'err' ? 7000 : 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2">
        {items.map((i) => (
          <div key={i.id} className={`rounded-md px-4 py-3 text-sm text-white shadow-lg ${i.kind === 'err' ? 'bg-red-600' : 'bg-slate-800'}`}>{i.msg}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ---------- basics ----------
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      <div className="flex gap-2">{actions}</div>
    </div>
  );
}

export function Card({ title, actions, children, className = '' }: { title?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {title && (
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>{actions}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

const TONES: Record<string, string> = {
  green: 'bg-emerald-100 text-emerald-800', amber: 'bg-amber-100 text-amber-800', red: 'bg-red-100 text-red-800',
  blue: 'bg-sky-100 text-sky-800', gray: 'bg-slate-200 text-slate-700',
};
export function Badge({ tone = 'gray', children }: { tone?: string; children: ReactNode }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}>{children}</span>;
}

const STATUS_TONE: Record<string, [string, string]> = {
  DRAFT: ['gray', 'Draft'], PENDING: ['amber', 'Pending review'], APPROVED: ['green', 'Approved'], REJECTED: ['red', 'Rejected'],
  PENDING_REVISION: ['blue', 'Edit under review'], SUSPENDED: ['red', 'Suspended'],
  PENDING_APPROVAL: ['amber', 'Awaiting account approval'], AWAITING_PAYMENT: ['blue', 'Awaiting payment'], ACTIVE: ['green', 'Active'],
  EXPIRED: ['gray', 'Expired'], CANCELLED: ['gray', 'Cancelled'], APPLIED: ['green', 'Applied'],
};
export function StatusBadge({ status }: { status: string }) {
  const [tone, label] = STATUS_TONE[status] ?? ['gray', status];
  return <Badge tone={tone}>{label}</Badge>;
}

export function Spinner() {
  return <div className="p-8 text-center text-sm text-slate-400">Loading…</div>;
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="p-8 text-center text-sm text-slate-500">{children}</div>;
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 pt-16" onMouseDown={onClose}>
      <div className={`card w-full ${wide ? 'max-w-3xl' : 'max-w-lg'}`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="font-semibold">{title}</h2>
          <button className="text-slate-400 hover:text-slate-700" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/** Runs an async action with a loading flag and error toast. */
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = async <T,>(fn: () => Promise<T>, okMsg?: string): Promise<T | undefined> => {
    setBusy(true);
    try { const r = await fn(); if (okMsg) toast(okMsg); return r; }
    catch (e: any) { toast(e.message || 'Something went wrong', 'err'); }
    finally { setBusy(false); }
  };
  return { busy, run };
}

/** Loads data once and on demand. */
export function useLoad<T>(fn: () => Promise<T>, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    try { setData(await fn()); setError(''); } catch (e: any) { setError(e.message); } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { reload(); }, [reload]);
  return { data, error, loading, reload, setData };
}

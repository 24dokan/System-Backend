'use client';
import { useRouter } from 'next/navigation';
import { useAction } from '@/components/ui';
import { useAuth } from '@/lib/auth';

// DEV ONLY. Rendered only under `npm run dev` (NODE_ENV === 'development'); a production build never shows it.
// Defaults match the backend seed. Override with NEXT_PUBLIC_QUICK_* in web/.env.local if you changed them.
const ADMIN = {
  email: process.env.NEXT_PUBLIC_QUICK_ADMIN_EMAIL || 'admin@example.com',
  password: process.env.NEXT_PUBLIC_QUICK_ADMIN_PASSWORD || 'change-me-now',
};
const SELLER = {
  email: process.env.NEXT_PUBLIC_QUICK_SELLER_EMAIL || 'demo-seller@example.com',
  password: process.env.NEXT_PUBLIC_QUICK_SELLER_PASSWORD || 'DemoSeller#2026',
  brand: 'Demo Seller',
};

export default function DevQuickLogin() {
  const { login, registerSeller } = useAuth();
  const router = useRouter();
  const { busy, run } = useAction();
  if (process.env.NODE_ENV !== 'development') return null;

  const go = async (fn: () => Promise<unknown>) => { if (await run(fn)) router.replace('/'); };
  const asAdmin = () => go(() => login(ADMIN.email, ADMIN.password));
  // Logs in as the demo seller, creating the account the first time.
  const asSeller = () => go(async () => {
    try { return await login(SELLER.email, SELLER.password); }
    catch { return await registerSeller(SELLER.brand, SELLER.email, SELLER.password); }
  });

  return (
    <div className="mt-5 rounded-md border border-dashed border-amber-400 bg-amber-50 p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-800">Dev quick login (not shown in production)</div>
      <div className="flex gap-2">
        <button type="button" className="btn-secondary btn-sm flex-1" disabled={busy} onClick={asAdmin}>Admin</button>
        <button type="button" className="btn-secondary btn-sm flex-1" disabled={busy} onClick={asSeller}>Seller (demo)</button>
      </div>
    </div>
  );
}

'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AuthPage } from '@/components/AuthForm';
import { useAction } from '@/components/ui';
import { useAuth } from '@/lib/auth';

// TEMPORARY demo access: normal login and registration are switched off while the UI is being shown around.
// These buttons sign in to two accounts that already exist (the admin comes from the backend seed,
// the demo seller is created the first time it is used). Override with NEXT_PUBLIC_DEMO_* in web/.env.local.
const ADMIN = {
  email: process.env.NEXT_PUBLIC_DEMO_ADMIN_EMAIL || 'admin@example.com',
  password: process.env.NEXT_PUBLIC_DEMO_ADMIN_PASSWORD || 'change-me-now',
};
const SELLER = {
  email: process.env.NEXT_PUBLIC_DEMO_SELLER_EMAIL || 'demo-seller@example.com',
  password: process.env.NEXT_PUBLIC_DEMO_SELLER_PASSWORD || 'DemoSeller#2026',
  brand: 'Demo Seller',
};

export default function Login() {
  const { login, registerSeller } = useAuth();
  const router = useRouter();
  const { busy, run } = useAction();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const go = async (fn: () => Promise<unknown>) => { if (await run(fn)) router.replace('/'); };
  const asAdmin = () => go(() => login(ADMIN.email, ADMIN.password));
  const asSeller = () => go(async () => {
    try { return await login(SELLER.email, SELLER.password); }
    catch (e: any) {
      if (e?.status && e.status !== 401) throw e; // backend problem: show it, do not try to register
      return await registerSeller(SELLER.brand, SELLER.email, SELLER.password);
    }
  });

  return (
    <AuthPage title="Demo access" subtitle="Log in and registration are switched off for now. Pick an account to look around." footer={<>Preview build</>}>
      <div className="space-y-3">
        <button className="btn-primary w-full" disabled={busy} onClick={asAdmin}>{busy ? 'Opening…' : 'Open the back office (Administrator)'}</button>
        <button className="btn-secondary w-full" disabled={busy} onClick={asSeller}>{busy ? 'Opening…' : 'Open the seller portal (Demo Seller)'}</button>
      </div>
      <form className="mt-6 space-y-3 border-t border-slate-200 pt-5" onSubmit={(e) => { e.preventDefault(); go(() => login(email.trim(), password)); }}>
        <div className="text-sm font-medium text-slate-700">Staff sign in</div>
        <input className="input" type="email" autoComplete="username" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="input" type="password" autoComplete="current-password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="btn-secondary w-full" disabled={busy || !email || !password}>Sign in</button>
      </form>
    </AuthPage>
  );
}

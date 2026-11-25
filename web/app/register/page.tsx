'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { AuthPage } from '@/components/AuthForm';
import { Field, useAction } from '@/components/ui';
import { useAuth } from '@/lib/auth';

export default function Register() {
  const { registerSeller } = useAuth();
  const router = useRouter();
  const { busy, run } = useAction();
  const [brandName, setBrand] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const u = await run(() => registerSeller(brandName, email, password));
    if (u) router.replace('/seller/plan');
  };
  return (
    <AuthPage title="Become a seller" subtitle="Register your brand. An administrator approves new accounts." footer={<>Already registered? <Link className="font-medium text-brand" href="/login">Log in</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Brand name"><input className="input" required minLength={2} value={brandName} onChange={(e) => setBrand(e.target.value)} autoFocus /></Field>
        <Field label="Email"><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Password" hint="At least 10 characters"><input className="input" type="password" required minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
      </form>
    </AuthPage>
  );
}

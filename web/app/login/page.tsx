'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { AuthPage } from '@/components/AuthForm';
import DevQuickLogin from '@/components/DevQuickLogin';
import { Field, useAction } from '@/components/ui';
import { useAuth } from '@/lib/auth';

export default function Login() {
  const { login } = useAuth();
  const router = useRouter();
  const { busy, run } = useAction();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const u = await run(() => login(email, password));
    if (u) router.replace('/');
  };
  return (
    <AuthPage title="Log in" subtitle="Sellers and administrators" footer={<>New seller? <Link className="font-medium text-brand" href="/register">Create an account</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email"><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus /></Field>
        <Field label="Password"><input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      </form>
      <DevQuickLogin />
    </AuthPage>
  );
}

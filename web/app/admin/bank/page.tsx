'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, Field, PageHeader, Spinner, useAction, useLoad } from '@/components/ui';

export default function Bank() {
  const { data, loading, reload } = useLoad(() => api('/api/payment-instruction'));
  const { busy, run } = useAction();
  const [f, setF] = useState({ bankName: '', accountName: '', accountNumber: '', referenceHint: '' });
  useEffect(() => { if (data) setF({ bankName: data.bankName, accountName: data.accountName, accountNumber: data.accountNumber, referenceHint: data.referenceHint ?? '' }); }, [data]);
  if (loading) return <Spinner />;
  const set = (k: string, v: string) => setF({ ...f, [k]: v });
  const save = async () => { if (await run(() => api('/api/payment-instruction', { method: 'PUT', body: { ...f, referenceHint: f.referenceHint || undefined } }), 'Bank details saved')) reload(); };
  return (
    <>
      <PageHeader title="Bank details" subtitle="Shown to sellers who need to pay for a package by bank transfer" />
      <Card className="max-w-xl">
        <div className="space-y-4">
          <Field label="Bank name"><input className="input" value={f.bankName} onChange={(e) => set('bankName', e.target.value)} /></Field>
          <Field label="Account name"><input className="input" value={f.accountName} onChange={(e) => set('accountName', e.target.value)} /></Field>
          <Field label="Account number"><input className="input" value={f.accountNumber} onChange={(e) => set('accountNumber', e.target.value)} /></Field>
          <Field label="Reference instructions (optional)"><input className="input" value={f.referenceHint} onChange={(e) => set('referenceHint', e.target.value)} /></Field>
          <button className="btn-primary" disabled={busy || !f.bankName || !f.accountName || !f.accountNumber} onClick={save}>Save</button>
        </div>
      </Card>
    </>
  );
}

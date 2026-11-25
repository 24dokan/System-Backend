'use client';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { api } from '@/lib/api';
import { flattenCategories } from '@/lib/format';
import { Card, Field, PageHeader, Spinner, useAction, useLoad } from '@/components/ui';

export default function NewProduct() {
  const router = useRouter();
  const { busy, run } = useAction();
  const { data: tree } = useLoad(() => api('/api/categories'));
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  if (!tree) return <Spinner />;
  const cats = flattenCategories(tree);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const p = await run(() => api('/api/products', { body: { name, categoryId, description: description || undefined } }));
    if (p) router.push(`/seller/products/${p.id}`);
  };
  return (
    <>
      <PageHeader title="Add product" subtitle="Start with the basics. You add sizes, colours and prices on the next screen." />
      <Card className="max-w-2xl">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Product name"><input className="input" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
          <Field label="Category">
            <select className="input" required value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Select a category…</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Description"><textarea className="input min-h-28" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
          <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Create draft'}</button>
        </form>
      </Card>
    </>
  );
}

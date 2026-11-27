'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, Field, useAction, useLoad } from '@/components/ui';

/**
 * Search and sharing details for a product or a store: web address, page title, description and share image.
 * Only the data is kept for now. Public pages come with the storefront phase.
 * `path` is the API path, for example /api/seo/products/ID or /api/seo/store.
 */
export default function SeoCard({ path, images }: { path: string; images?: { mediaId: string; label: string }[] }) {
  const seo = useLoad<any>(() => api(path), [path]);
  const { busy, run } = useAction();
  const [f, setF] = useState({ slug: '', metaTitle: '', metaDescription: '', shareImageMediaId: '' });
  useEffect(() => {
    if (seo.data) setF({ slug: seo.data.slug ?? '', metaTitle: seo.data.metaTitle ?? '', metaDescription: seo.data.metaDescription ?? '', shareImageMediaId: seo.data.shareImageMediaId ?? '' });
  }, [seo.data]);
  if (!seo.data) return null;
  const s = seo.data.suggested;
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const save = () => run(() => api(path, { method: 'PUT', body: { slug: f.slug, metaTitle: f.metaTitle, metaDescription: f.metaDescription, ...(images ? { shareImageMediaId: f.shareImageMediaId || null } : {}) } }), 'Saved').then((r) => r && seo.reload());
  return (
    <Card title="Search and sharing">
      <div className="space-y-4">
        <p className="text-sm text-slate-500">This is how the page will appear in Google and when shared. Leave a box empty to use the suggestion.</p>
        <Field label="Web address" hint={`Suggested: ${s.slug}`}><input className="input" value={f.slug} placeholder={s.slug} onChange={(e) => set('slug', e.target.value.toLowerCase())} /></Field>
        <Field label={`Page title (${f.metaTitle.length}/70)`} hint={`Suggested: ${s.metaTitle}`}><input className="input" maxLength={70} value={f.metaTitle} placeholder={s.metaTitle} onChange={(e) => set('metaTitle', e.target.value)} /></Field>
        <Field label={`Page description (${f.metaDescription.length}/160)`}><textarea className="input" maxLength={160} value={f.metaDescription} placeholder={s.metaDescription} onChange={(e) => set('metaDescription', e.target.value)} /></Field>
        {images && <Field label="Share image">
          <select className="input" value={f.shareImageMediaId} onChange={(e) => set('shareImageMediaId', e.target.value)}>
            <option value="">Use the cover photo</option>{images.map((i) => <option key={i.mediaId} value={i.mediaId}>{i.label}</option>)}
          </select></Field>}
        <button className="btn-primary" disabled={busy} onClick={save}>Save</button>
      </div>
    </Card>
  );
}

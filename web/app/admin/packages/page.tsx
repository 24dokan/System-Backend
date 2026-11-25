'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { fromMinor, money, toMinor } from '@/lib/format';
import { Badge, Card, Field, Modal, PageHeader, Spinner, useAction, useLoad } from '@/components/ui';

export default function Packages() {
  const { data, loading, reload } = useLoad(() => api('/api/packages/all'));
  const [editing, setEditing] = useState<any>(null);
  if (loading || !data) return <Spinner />;
  return (
    <>
      <PageHeader title="Packages" subtitle="The plans sellers can choose. Prices are per billing period." actions={<button className="btn-primary" onClick={() => setEditing({})}>Add package</button>} />
      <Card className="!p-0">
        <table className="tbl">
          <thead><tr><th>Package</th><th>Price</th><th>Products</th><th>SKUs</th><th>Micro stores</th><th></th></tr></thead>
          <tbody>
            {data.map((p: any) => (
              <tr key={p.id}>
                <td><div className="font-medium">{p.name} {p.isPopular && <Badge tone="green">Popular</Badge>} {!p.isActive && <Badge>Hidden</Badge>}</div><div className="text-xs text-slate-400">{p.tagline}</div></td>
                <td>{p.isContactUs ? 'Contact us' : money(p.priceMinor, p.currency)}</td>
                <td>{p.maxProducts ?? 'Unlimited'}</td><td>{p.maxSkus ?? 'Unlimited'}</td><td>{p.maxMicroStores}</td>
                <td className="text-right"><button className="btn-secondary btn-sm" onClick={() => setEditing(p)}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {editing && <PackageForm pkg={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); reload(); }} />}
    </>
  );
}

function PackageForm({ pkg, onClose, onDone }: any) {
  const { busy, run } = useAction();
  const isNew = !pkg.id;
  const [f, setF] = useState({
    name: pkg.name ?? '', tagline: pkg.tagline ?? '',
    price: pkg.priceMinor != null ? fromMinor(pkg.priceMinor) : '',
    maxProducts: pkg.maxProducts != null ? String(pkg.maxProducts) : '',
    maxSkus: pkg.maxSkus != null ? String(pkg.maxSkus) : '',
    maxMicroStores: String(pkg.maxMicroStores ?? 1), displayOrder: String(pkg.displayOrder ?? 0),
    isContactUs: !!pkg.isContactUs, isPopular: !!pkg.isPopular, isActive: pkg.isActive ?? true,
  });
  const set = (k: string, v: any) => setF({ ...f, [k]: v });

  const save = async () => {
    const body: any = {
      name: f.name.trim(), tagline: f.tagline || undefined, isContactUs: f.isContactUs, isPopular: f.isPopular,
      maxMicroStores: Number(f.maxMicroStores), displayOrder: Number(f.displayOrder),
      // Blank = unlimited.
      maxProducts: f.maxProducts === '' ? null : Number(f.maxProducts),
    };
    if (!f.isContactUs) {
      const minor = toMinor(f.price);
      if (minor === null) return run(async () => { throw new Error('Enter a price'); });
      body.priceMinor = minor;
    }
    // Blank SKU limit = 10x the product limit (or unlimited when products are unlimited).
    if (f.maxSkus !== '') body.maxSkus = Number(f.maxSkus);
    if (!isNew) body.isActive = f.isActive;
    const ok = isNew ? await run(() => api('/api/packages', { body }), 'Package created') : await run(() => api(`/api/packages/${pkg.id}`, { method: 'PATCH', body }), 'Package saved');
    if (ok) onDone();
  };
  return (
    <Modal title={isNew ? 'New package' : `Edit ${pkg.name}`} onClose={onClose} wide>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name"><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Tagline"><input className="input" value={f.tagline} onChange={(e) => set('tagline', e.target.value)} /></Field>
        <Field label="Price per year (RM)"><input className="input" inputMode="decimal" disabled={f.isContactUs} value={f.price} onChange={(e) => set('price', e.target.value)} /></Field>
        <Field label="Display order"><input className="input" inputMode="numeric" value={f.displayOrder} onChange={(e) => set('displayOrder', e.target.value)} /></Field>
        <Field label="Product limit" hint="Leave blank for unlimited"><input className="input" inputMode="numeric" value={f.maxProducts} onChange={(e) => set('maxProducts', e.target.value)} /></Field>
        <Field label="SKU limit" hint="Leave blank for 10× the product limit"><input className="input" inputMode="numeric" value={f.maxSkus} onChange={(e) => set('maxSkus', e.target.value)} /></Field>
        <Field label="Micro stores"><input className="input" inputMode="numeric" value={f.maxMicroStores} onChange={(e) => set('maxMicroStores', e.target.value)} /></Field>
        <div className="space-y-2 pt-6 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={f.isContactUs} onChange={(e) => set('isContactUs', e.target.checked)} /> "Contact us" pricing (assigned by admin)</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={f.isPopular} onChange={(e) => set('isPopular', e.target.checked)} /> Most popular</label>
          {!isNew && <label className="flex items-center gap-2"><input type="checkbox" checked={f.isActive} onChange={(e) => set('isActive', e.target.checked)} /> Visible to sellers</label>}
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2"><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy || !f.name.trim()} onClick={save}>Save</button></div>
    </Modal>
  );
}

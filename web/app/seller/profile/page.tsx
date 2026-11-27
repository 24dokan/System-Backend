'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, Field, PageHeader, Spinner, useAction, useLoad } from '@/components/ui';
import SeoCard from '@/components/SeoCard';

type P = Record<string, any>;

/** Text, drop-down and yes/no inputs bound to one profile object. */
function bindFields(p: P, set: (f: (x: P) => P) => void) {
  const up = (k: string, v: any) => set((x) => ({ ...x, [k]: v }));
  return {
    text: (k: string, props: any = {}) => <input className="input" value={p[k] ?? ''} onChange={(e) => up(k, e.target.value)} {...props} />,
    area: (k: string) => <textarea className="input min-h-[72px]" value={p[k] ?? ''} onChange={(e) => up(k, e.target.value)} />,
    pick: (k: string, options: string[]) => (
      <select className="input" value={p[k] ?? ''} onChange={(e) => up(k, e.target.value)}>
        <option value="">Choose…</option>{options.map((o) => <option key={o}>{o}</option>)}
      </select>
    ),
    yesNo: (k: string) => (
      <div className="flex gap-5 py-2 text-sm">
        {[[true, 'Yes'], [false, 'No']].map(([v, label]) => (
          <label key={String(label)} className="flex items-center gap-2"><input type="radio" name={k} checked={p[k] === v} onChange={() => up(k, v)} /> {label}</label>
        ))}
      </div>
    ),
  };
}

export default function StoreProfile() {
  const seller = useLoad(() => api('/api/sellers/me'));
  const status = seller.data?.status;
  const profile = useLoad<any>(() => (status === 'APPROVED' ? api('/api/sellers/me/profile') : Promise.resolve(null)), [status]);
  const [p, setP] = useState<P>({});
  const [missing, setMissing] = useState<string[]>([]);
  const { busy, run } = useAction();
  useEffect(() => { if (profile.data) { setP(profile.data.profile); setMissing(profile.data.missing); } }, [profile.data]);

  if (seller.loading || (status === 'APPROVED' && !profile.data)) return <Spinner />;
  if (status !== 'APPROVED') {
    return (
      <>
        <PageHeader title="Store profile" />
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          This page opens once an administrator approves your account. You will then fill in your company, bank and e-invoicing details here.
        </div>
      </>
    );
  }
  const opt = profile.data.options;
  const b = bindFields(p, setP);

  const save = async () => {
    const out = Object.fromEntries(Object.entries(p).filter(([k]) => !['sellerId', 'completedAt', 'createdAt', 'updatedAt'].includes(k))
      .map(([k, v]) => [k, v === '' ? null : v]));
    const res = await run(() => api<any>('/api/sellers/me/profile', { method: 'PUT', body: out }), 'Profile saved');
    if (res) { setP(res.profile); setMissing(res.missing); }
  };

  return (
    <>
      <PageHeader title="Store profile" subtitle="Company, bank and e-invoicing details" actions={<button className="btn-primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>} />
      {missing.length ? (
        <div className="mb-5 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <b>You cannot submit products yet.</b> Still to fill in ({missing.length}): {missing.join(', ')}.
        </div>
      ) : (
        <div className="mb-5 rounded-md border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">Your profile is complete. You can submit products.</div>
      )}
      <div className="space-y-5">
        <Card title="Contact person"><div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name *">{b.text('contactFirstName')}</Field><Field label="Last name *">{b.text('contactLastName')}</Field>
          <Field label="I.C. / Passport no. *" hint="Shown to staff only if their role allows it">{b.text('idNumber')}</Field>
          <Field label="Email *">{b.text('contactEmail', { type: 'email' })}</Field>
          <Field label="Phone *">{b.text('contactPhone')}</Field>
        </div></Card>

        <Card title="Company information"><div className="grid gap-4 sm:grid-cols-2">
          <Field label="Company legal name *">{b.text('legalName')}</Field><Field label="SST registration no.">{b.text('sstNumber')}</Field>
          <Field label="Type of seller">{b.pick('sellerType', opt.sellerTypes)}</Field><div />
          <div className="sm:col-span-2"><Field label="Company address *">{b.area('companyAddress')}</Field></div>
          <Field label="Country *">{b.pick('country', opt.countries)}</Field><Field label="State / province">{p.country === 'Malaysia' ? b.pick('state', opt.states) : b.text('state')}</Field>
          <Field label="City *">{b.text('city')}</Field><Field label="Postcode *">{b.text('postcode')}</Field>
          <Field label="Woman-owned business? *" hint="Counts as woman-owned if women hold more than 60% of shares">{b.yesNo('womanOwned')}</Field>
          <Field label="Malaysian-owned business? *">{b.yesNo('malaysianOwned')}</Field>
        </div></Card>

        <Card title="Bank account"><div className="grid gap-4 sm:grid-cols-2">
          <Field label="Bank name *">{b.text('bankName')}</Field><Field label="Account owner name *">{b.text('bankAccountName')}</Field>
          <Field label="Account number *" hint="Shown to staff only if their role allows it">{b.text('bankAccountNumber')}</Field>
          <div className="sm:col-span-2"><Field label="Bank address">{b.area('bankAddress')}</Field></div>
        </div></Card>

        <Card title="Store information"><div className="grid gap-4 sm:grid-cols-2">
          <Field label="Store website">{b.text('storeUrl', { placeholder: 'https://' })}</Field><Field label="Main product category">{b.text('productCategory')}</Field>
          <Field label="How many products does your store have?">{b.pick('productCountRange', opt.productCounts)}</Field>
          <Field label="Online shopping system you use now *">{b.pick('cartSystem', opt.cartSystems)}</Field>
          <Field label="Are your products stored in Malaysia? *">{b.yesNo('stockedInMalaysia')}</Field>
        </div></Card>

        <Card title="Technical contact"><div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title">{b.pick('techContactTitle', opt.titles)}</Field><Field label="Name">{b.text('techContactName')}</Field>
          <Field label="Email">{b.text('techContactEmail', { type: 'email' })}</Field><Field label="Mobile">{b.text('techContactMobile')}</Field>
        </div></Card>

        <Card title="E-invoicing"><div className="grid gap-4 sm:grid-cols-2">
          <Field label="Company TIN number *">{b.text('tinNumber')}</Field><Field label="E-invoice contact person *">{b.text('einvoiceContactName')}</Field>
          <Field label="E-invoice email *">{b.text('einvoiceEmail', { type: 'email' })}</Field>
        </div></Card>
        <div className="flex justify-end"><button className="btn-primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button></div>
        <SeoCard path="/api/seo/store" />
      </div>
    </>
  );
}

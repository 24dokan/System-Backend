'use client';
import { api } from '@/lib/api';
import { date, money } from '@/lib/format';
import { Badge, Card, PageHeader, Spinner, StatusBadge, useAction, useLoad } from '@/components/ui';

const NEXT_STEP: Record<string, string> = {
  PENDING_APPROVAL: 'An administrator needs to approve your seller account first. Then you will see the payment details here.',
  AWAITING_PAYMENT: 'Please transfer the amount below to the bank account shown. An administrator confirms it once the payment arrives.',
  ACTIVE: 'Your package is active.',
};

export default function Plan() {
  const { data, loading, reload } = useLoad(async () => {
    const [packages, subs, bank] = await Promise.all([api('/api/packages'), api('/api/subscriptions/mine'), api('/api/payment-instruction')]);
    return { packages, subs, bank };
  });
  const { busy, run } = useAction();
  if (loading || !data) return <Spinner />;
  const { packages, subs, bank } = data;
  const current = subs[0];
  const open = subs.find((s: any) => ['PENDING_APPROVAL', 'AWAITING_PAYMENT'].includes(s.status));

  const choose = async (id: string) => { if (await run(() => api('/api/subscriptions', { body: { packageId: id } }), 'Package requested')) reload(); };

  return (
    <>
      <PageHeader title="Package & payment" subtitle="Pick the package that fits your business. You are charged after an administrator approves your account." />
      {current && (
        <Card title="Your subscription" className="mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-lg font-semibold">{current.package.name}</span><StatusBadge status={current.status} />
            {current.endsAt && <span className="text-sm text-slate-500">valid until {date(current.endsAt)}</span>}
          </div>
          <p className="mt-2 text-sm text-slate-600">{NEXT_STEP[current.status]}</p>
          {current.status === 'AWAITING_PAYMENT' && (
            <div className="mt-4 rounded-md bg-slate-50 p-4 text-sm">
              <div className="mb-2 text-base font-semibold">Amount due: {money(current.package.priceMinor, current.package.currency)}</div>
              {bank ? (
                <dl className="grid grid-cols-[120px_1fr] gap-y-1">
                  <dt className="text-slate-500">Bank</dt><dd>{bank.bankName}</dd>
                  <dt className="text-slate-500">Account name</dt><dd>{bank.accountName}</dd>
                  <dt className="text-slate-500">Account number</dt><dd className="font-mono">{bank.accountNumber}</dd>
                  {bank.referenceHint && (<><dt className="text-slate-500">Reference</dt><dd>{bank.referenceHint}</dd></>)}
                </dl>
              ) : <p className="text-slate-500">Bank details have not been set up yet. Please contact us.</p>}
            </div>
          )}
        </Card>
      )}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {packages.map((p: any) => (
          <div key={p.id} className={`card flex flex-col p-5 ${p.isPopular ? 'ring-2 ring-brand' : ''}`}>
            <div className="flex items-center justify-between"><h3 className="text-lg font-semibold">{p.name}</h3>{p.isPopular && <Badge tone="green">Most popular</Badge>}</div>
            <p className="text-sm text-slate-500">{p.tagline}</p>
            <div className="my-4">
              {p.isContactUs ? <span className="text-2xl font-bold">Contact us</span> : (<><span className="text-2xl font-bold">{money(p.priceMinor, p.currency)}</span><span className="text-sm text-slate-500"> / {p.billingPeriod === 'YEARLY' ? 'year' : 'month'}</span></>)}
            </div>
            <ul className="mb-5 flex-1 space-y-1.5 text-sm text-slate-700">
              <li>✓ {p.maxProducts === null ? 'Unlimited products' : `${p.maxProducts.toLocaleString()} products`}</li>
              <li>✓ {p.maxSkus === null ? 'Unlimited variations' : `${p.maxSkus.toLocaleString()} variations (SKUs)`}</li>
              <li>✓ {p.maxMicroStores} micro store{p.maxMicroStores > 1 ? 's' : ''}</li>
              <li>✓ Transaction fee: {Number(p.transactionFeePercent)}%</li>
              {p.features?.filter((f: any) => f.included).map((f: any) => <li key={f.featureId}>✓ {f.feature.label}</li>)}
            </ul>
            {p.isContactUs
              ? <button className="btn-secondary" disabled>Arranged with our team</button>
              : <button className="btn-primary" disabled={busy || !!open} onClick={() => choose(p.id)}>{open ? 'Request in progress' : current?.status === 'ACTIVE' ? 'Switch to this' : 'Choose'}</button>}
          </div>
        ))}
      </div>
    </>
  );
}

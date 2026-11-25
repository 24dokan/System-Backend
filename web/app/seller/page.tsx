'use client';
import Link from 'next/link';
import { api } from '@/lib/api';
import { date, money } from '@/lib/format';
import { Card, PageHeader, Spinner, StatusBadge, useLoad } from '@/components/ui';

export default function SellerDashboard() {
  const { data, loading, error } = useLoad(async () => {
    const [seller, usage, subs] = await Promise.all([
      api('/api/sellers/me'), api('/api/subscriptions/usage'), api('/api/subscriptions/mine'),
    ]);
    return { seller, usage, sub: subs[0] };
  });
  if (loading) return <Spinner />;
  if (error || !data) return <p className="text-red-600">{error}</p>;
  const { seller, usage, sub } = data;
  const lim = usage.limits;

  return (
    <>
      <PageHeader title={seller.name} subtitle="Your seller account at a glance" actions={<Link className="btn-primary" href="/seller/products/new">Add product</Link>} />
      {seller.status !== 'APPROVED' && (
        <div className="mb-5 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Your account is <b>{seller.status === 'PENDING' ? 'waiting for approval' : 'suspended'}</b>.
          {seller.status === 'PENDING' && ' You can pick a package now. You can add products once an administrator approves your account and your payment is confirmed.'}
        </div>
      )}
      <div className="grid gap-5 md:grid-cols-3">
        <Card title="Account"><StatusBadge status={seller.status} /></Card>
        <Card title="Package" actions={<Link className="text-sm text-brand" href="/seller/plan">Manage</Link>}>
          {usage.package ? <div className="text-lg font-semibold">{usage.package}</div> : <div className="text-sm text-slate-500">No active package</div>}
          {sub && <div className="mt-2 text-sm text-slate-500"><StatusBadge status={sub.status} />{sub.endsAt && <span className="ml-2">until {date(sub.endsAt)}</span>}</div>}
        </Card>
        <Card title="Usage">
          <div className="text-sm">Products: <b>{usage.used.products}</b> / {lim ? lim.maxProducts ?? 'unlimited' : '-'}</div>
          <div className="mt-1 text-sm">Variations (SKUs): <b>{usage.used.skus}</b> / {lim ? lim.maxSkus ?? 'unlimited' : '-'}</div>
          <p className="mt-2 text-xs text-slate-400">Pending and approved products count. Drafts do not.</p>
        </Card>
      </div>
      {sub?.package && <p className="mt-4 text-xs text-slate-400">Latest request: {sub.package.name} ({money(sub.package.priceMinor, sub.package.currency)})</p>}
    </>
  );
}

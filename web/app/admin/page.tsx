'use client';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card, PageHeader, Spinner, useLoad } from '@/components/ui';

export default function AdminDashboard() {
  const { data, loading } = useLoad(async () => {
    const [sellers, subs, queue] = await Promise.all([
      api('/api/sellers?status=PENDING'), api('/api/subscriptions?status=AWAITING_PAYMENT'), api('/api/approval/queue'),
    ]);
    return { sellers: sellers.length, payments: subs.length, products: queue.products.length, revisions: queue.revisions.length };
  });
  if (loading || !data) return <Spinner />;
  const tiles = [
    { label: 'Sellers to approve', n: data.sellers, href: '/admin/sellers' },
    { label: 'Payments to confirm', n: data.payments, href: '/admin/payments' },
    { label: 'New products to review', n: data.products, href: '/admin/queue' },
    { label: 'Product changes to review', n: data.revisions, href: '/admin/queue' },
  ];
  return (
    <>
      <PageHeader title="Dashboard" subtitle="What needs your attention" />
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href}><Card className="transition hover:shadow-md"><div className="text-3xl font-semibold">{t.n}</div><div className="mt-1 text-sm text-slate-500">{t.label}</div></Card></Link>
        ))}
      </div>
    </>
  );
}

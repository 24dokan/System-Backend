'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { Spinner } from './ui';

type Item = { href: string; label: string };
type Group = { title?: string; items: Item[] };

const SELLER_NAV: Group[] = [
  { items: [{ href: '/seller', label: 'Dashboard' }] },
  { title: 'Account', items: [{ href: '/seller/plan', label: 'Package & payment' }] },
  { title: 'Products', items: [{ href: '/seller/products', label: 'My products' }, { href: '/seller/import', label: 'Import / export' }] },
];
const ADMIN_NAV: Group[] = [
  { items: [{ href: '/admin', label: 'Dashboard' }] },
  { title: 'Vendors', items: [{ href: '/admin/sellers', label: 'Sellers' }, { href: '/admin/payments', label: 'Subscriptions & payments' }] },
  { title: 'Products', items: [{ href: '/admin/queue', label: 'Review queue' }, { href: '/admin/categories', label: 'Categories' }] },
  { title: 'Settings', items: [{ href: '/admin/packages', label: 'Packages' }, { href: '/admin/bank', label: 'Bank details' }] },
];

/** Sidebar + top bar. Sends people to the login page, or to their own area, when they should not be here. */
export default function Shell({ role, children }: { role: 'ADMIN' | 'SELLER'; children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
    else if (user.role !== role) router.replace('/');
  }, [user, loading, role, router]);

  if (loading || !user || user.role !== role) return <Spinner />;
  const nav = role === 'ADMIN' ? ADMIN_NAV : SELLER_NAV;
  const active = (h: string) => (h === '/seller' || h === '/admin' ? path === h : path.startsWith(h));

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col bg-slate-900 text-slate-300 md:flex">
        <div className="flex h-14 items-center gap-2 px-5 text-lg font-semibold text-white">
          <span className="grid h-7 w-7 place-items-center rounded bg-brand text-sm">24</span> Dokan
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-2">
          {nav.map((g, i) => (
            <div key={i} className="mb-4">
              {g.title && <div className="px-2 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">{g.title}</div>}
              {g.items.map((it) => (
                <Link key={it.href} href={it.href}
                  className={`block rounded-md px-3 py-2 text-sm ${active(it.href) ? 'bg-brand text-white' : 'hover:bg-slate-800 hover:text-white'}`}>
                  {it.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6">
          <span className="text-sm text-slate-500">{role === 'ADMIN' ? 'Administration' : 'Seller portal'}</span>
          <button className="btn-secondary btn-sm" onClick={logout}>Log out</button>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

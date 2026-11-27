'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { Spinner } from './ui';

type Item = { href: string; label: string; perm?: string };
type Group = { title?: string; items: Item[] };

const SELLER_NAV: Group[] = [
  { items: [{ href: '/seller', label: 'Dashboard' }] },
  { title: 'Account', items: [{ href: '/seller/profile', label: 'Store profile' }, { href: '/seller/plan', label: 'Package & payment' }] },
  { title: 'Products', items: [{ href: '/seller/products', label: 'My products' }, { href: '/seller/import', label: 'Import / export' }] },
  { title: 'Orders & stock', items: [{ href: '/seller/orders', label: 'My orders' }, { href: '/seller/stock', label: 'My stock' }] },
];
const ADMIN_NAV: Group[] = [
  { items: [{ href: '/admin', label: 'Dashboard' }] },
  { title: 'Vendors', items: [{ href: '/admin/sellers', label: 'Sellers', perm: 'sellers.view' }, { href: '/admin/payments', label: 'Subscriptions & payments', perm: 'payments.view' }] },
  { title: 'Products', items: [{ href: '/admin/queue', label: 'Review queue', perm: 'products.review' }, { href: '/admin/categories', label: 'Categories', perm: 'categories.manage' }, { href: '/admin/options', label: 'Option library', perm: 'options.manage' }] },
  { title: 'Orders', items: [
    { href: '/admin/orders', label: 'All orders', perm: 'orders.view' }, { href: '/admin/orders/new', label: 'Create order', perm: 'orders.manage' },
    { href: '/admin/orders/import', label: 'Bulk import', perm: 'orders.manage' }, { href: '/admin/returns', label: 'Returns', perm: 'returns.manage' },
  ] },
  { title: 'Inventory', items: [
    { href: '/admin/stock', label: 'Stock overview', perm: 'inventory.view' }, { href: '/admin/inbound', label: 'Inbound', perm: 'inventory.view' },
    { href: '/admin/adjustments', label: 'Adjustments', perm: 'inventory.manage' }, { href: '/admin/movements', label: 'Movements', perm: 'inventory.view' },
    { href: '/admin/low-stock', label: 'Low stock', perm: 'inventory.view' }, { href: '/admin/marketplace', label: 'Marketplace updates', perm: 'inventory.view' },
    { href: '/admin/warehouses', label: 'Warehouses', perm: 'warehouses.manage' },
  ] },
  { title: 'Reports', items: [{ href: '/admin/reports', label: 'Sales reports', perm: 'reports.view' }] },
  { title: 'Settings', items: [{ href: '/admin/packages', label: 'Packages', perm: 'packages.manage' }, { href: '/admin/bank', label: 'Bank details', perm: 'bank.manage' }] },
  { title: 'Staff', items: [{ href: '/admin/staff', label: 'Staff', perm: 'staff.manage' }, { href: '/admin/roles', label: 'Roles & permissions', perm: 'roles.manage' }] },
];

/** Sidebar + top bar. Sends people to the login page, or to their own area, when they should not be here. */
export default function Shell({ role, children }: { role: 'ADMIN' | 'SELLER'; children: ReactNode }) {
  const { user, loading, logout, can } = useAuth();
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
    else if (user.role !== role) router.replace('/');
  }, [user, loading, role, router]);

  if (loading || !user || user.role !== role) return <Spinner />;
  const allNav = role === 'ADMIN' ? ADMIN_NAV : SELLER_NAV;
  // Staff only see the screens their role allows. Empty groups disappear.
  const nav = allNav.map((g) => ({ ...g, items: g.items.filter((it) => !it.perm || can(it.perm)) })).filter((g) => g.items.length);
  // The longest matching link wins, so /admin/orders/new does not also light up /admin/orders.
  const all = nav.flatMap((g) => g.items.map((i) => i.href));
  const best = all.filter((h) => path === h || (h !== '/seller' && h !== '/admin' && path.startsWith(h + '/'))).sort((a, b) => b.length - a.length)[0];
  const active = (h: string) => h === best;

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
          <div className="flex items-center gap-3">
            {role === 'ADMIN' && <span className="text-sm text-slate-500">{user.name || user.email} · {user.superAdmin ? 'Super admin' : user.staffRole}</span>}
            <button className="btn-secondary btn-sm" onClick={logout}>Log out</button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

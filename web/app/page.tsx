'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { Spinner } from '@/components/ui';

export default function Home() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
    else if (user.role === 'ADMIN') router.replace('/admin');
    else if (user.role === 'SELLER') router.replace('/seller');
  }, [user, loading, router]);

  if (user && user.role === 'WAREHOUSE_STAFF') {
    return (
      <div className="mx-auto mt-24 max-w-md text-center">
        <p className="text-slate-600">The warehouse screens are not built yet (area 1D).</p>
        <button className="btn-secondary mt-4" onClick={logout}>Log out</button>
      </div>
    );
  }
  return <Spinner />;
}

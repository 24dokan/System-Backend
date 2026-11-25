'use client';
import { ReactNode } from 'react';

export function AuthPage({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2 text-2xl font-semibold">
          <span className="grid h-9 w-9 place-items-center rounded bg-brand text-base text-white">24</span> Dokan
        </div>
        <div className="card p-6">
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="mb-5 mt-1 text-sm text-slate-500">{subtitle}</p>
          {children}
        </div>
        <p className="mt-4 text-center text-sm text-slate-500">{footer}</p>
      </div>
    </div>
  );
}

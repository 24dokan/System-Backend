'use client';
import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { api, getTokens, setTokens } from './api';

export type User = {
  id: string; role: 'ADMIN' | 'SELLER' | 'WAREHOUSE_STAFF'; sellerId: string | null;
  email?: string; name?: string | null; staffRole?: string | null;
  /** Administrators only. Used to hide screens; the backend enforces the same rules. */
  superAdmin?: boolean; permissions?: string[];
};
type Ctx = {
  user: User | null; loading: boolean;
  /** True when the logged-in administrator may do this (super admins may do everything). */
  can: (permission: string) => boolean;
  login: (email: string, password: string) => Promise<User>;
  registerSeller: (brandName: string, email: string, password: string) => Promise<User>;
  logout: () => void;
};
const AuthCtx = createContext<Ctx>(null as any);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    if (!getTokens()) { setUser(null); return null; }
    try { const me = await api<User>('/api/auth/me'); setUser(me); return me; }
    catch { setUser(null); return null; }
  }, []);

  useEffect(() => { loadMe().finally(() => setLoading(false)); }, [loadMe]);

  const finish = async (tokens: any) => { setTokens(tokens); return (await loadMe())!; };
  const value: Ctx = {
    user, loading,
    can: (permission) => !!user && (user.superAdmin === true || (user.permissions ?? []).includes(permission)),
    login: async (email, password) => finish(await api('/api/auth/login', { body: { email, password } })),
    registerSeller: async (brandName, email, password) =>
      finish(await api('/api/auth/register-seller', { body: { brandName, email, password } })),
    logout: () => { setTokens(null); setUser(null); window.location.href = '/login'; },
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

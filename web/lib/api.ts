// Thin fetch wrapper: attaches the token, refreshes it once on 401, and turns errors into readable messages.

const KEY = 'sb_tokens';
export type Tokens = { accessToken: string; refreshToken: string };

export function getTokens(): Tokens | null {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
}
export function setTokens(t: Tokens | null) {
  try { t ? localStorage.setItem(KEY, JSON.stringify(t)) : localStorage.removeItem(KEY); } catch {}
}

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

let refreshing: Promise<boolean> | null = null;
async function refresh(): Promise<boolean> {
  const t = getTokens();
  if (!t) return false;
  refreshing ??= fetch('/api/auth/refresh', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: t.refreshToken }),
  })
    .then(async (r) => { if (!r.ok) return false; setTokens(await r.json()); return true; })
    .catch(() => false)
    .finally(() => { refreshing = null; });
  return refreshing;
}

async function send(path: string, opts: { method?: string; body?: unknown; form?: FormData }, token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(opts.body); }
  try {
    return await fetch(path, { method: opts.method ?? (body ? 'POST' : 'GET'), headers, body });
  } catch {
    throw new ApiError('Cannot reach the web server. Is "npm run dev" still running in the web folder?', 0);
  }
}

async function request(path: string, opts: { method?: string; body?: unknown; form?: FormData } = {}) {
  let res = await send(path, opts, getTokens()?.accessToken);
  if (res.status === 401 && getTokens() && (await refresh())) res = await send(path, opts, getTokens()?.accessToken);
  if (res.status === 401 && getTokens() && !path.startsWith('/api/auth/')) {
    setTokens(null);
    if (typeof window !== 'undefined') window.location.href = '/login';
  }
  if (!res.ok) {
    let msg = res.status >= 500
      ? `The backend did not answer (${res.status}). Make sure it is running on port 3000 (npm run start:dev in the main folder).`
      : `Request failed (${res.status})`;
    try {
      const j = await res.json();
      msg = Array.isArray(j.message) ? j.message.join('. ') : j.message || msg;
    } catch {}
    throw new ApiError(msg, res.status);
  }
  return res;
}

/** JSON request. Returns null for empty responses. */
export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const res = await request(path, opts);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

/** Downloads a file (CSV) with the login token attached. */
export async function download(path: string, filename: string) {
  const res = await request(path);
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

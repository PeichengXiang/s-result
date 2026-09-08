import { env } from 'cloudflare:workers';
export type Bindings = {
  DB: D1Database;
  ADMIN_USER?: string;
  ADMIN_PASSWORD_HASH?: string;
  ADMIN_PASSWORD_SALT?: string;
};
export const bindings = () => env as unknown as Bindings;
export const db = () => bindings().DB;
export const json = (
  body: unknown,
  status = 200,
  extra: Record<string, string> = {},
) =>
  Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extra,
    },
  });
export async function sha(value: string) {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(bytes), (v) =>
    v.toString(16).padStart(2, '0'),
  ).join('');
}
export async function passwordHash(password: string, salt: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  return Array.from(
    new Uint8Array(
      await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: new TextEncoder().encode(salt),
          iterations: 100000,
          hash: 'SHA-256',
        },
        key,
        256,
      ),
    ),
    (v) => v.toString(16).padStart(2, '0'),
  ).join('');
}
export function safeEqual(a: string, b: string) {
  let v = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    v |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return v === 0;
}
export function sameOrigin(req: Request) {
  return req.headers.get('origin') === new URL(req.url).origin;
}
export const cookieName = 'arena_session';
export async function sessionHash(req: Request) {
  const token = req.headers
    .get('cookie')
    ?.split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith(cookieName + '='))
    ?.slice(cookieName.length + 1);
  return token && /^[a-f0-9]{64}$/.test(token) ? sha(token) : null;
}
export async function authenticated(req: Request) {
  const hash = await sessionHash(req);
  return hash
    ? !!(await db()
        .prepare('SELECT hash FROM sessions WHERE hash=? AND expires>?')
        .bind(hash, Date.now())
        .first())
    : false;
}
export function cookie(req: Request, value: string, age: number) {
  return `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${new URL(req.url).protocol === 'https:' ? '; Secure' : ''}`;
}
export async function body(req: Request) {
  if (Number(req.headers.get('content-length') ?? 0) > 12000)
    throw new Error('请求过大');
  const text = await req.text();
  if (text.length > 12000) throw new Error('请求过大');
  return JSON.parse(text);
}

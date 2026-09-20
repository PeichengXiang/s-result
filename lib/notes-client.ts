export const hostedOrigin =
  'https://sparkarena-egovla-results.maverick-olson53ius.chatgpt.site';
export type Note = {
  key: string;
  text: string;
  abnormal: number;
  version: number;
  updated_at: string;
  author: string;
};
const adminTokenKey = 's-result-admin-token';
export const onGitHub = () =>
  typeof location !== 'undefined' && location.hostname.endsWith('.github.io');
export const apiUrl = (path: string) =>
  (onGitHub() ? hostedOrigin : '') + '/api/' + path;
const browserToken = () =>
  typeof window === 'undefined'
    ? null
    : window.sessionStorage.getItem(adminTokenKey);
const clearBrowserToken = () => {
  if (typeof window !== 'undefined') window.sessionStorage.removeItem(adminTokenKey);
};
export async function api(path: string, method = 'GET', body?: unknown) {
  const headers = new Headers();
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  if (onGitHub()) {
    const token = browserToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  const res = await fetch(apiUrl(path), {
    method,
    credentials: onGitHub() ? 'omit' : 'same-origin',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const value = (await res.json()) as {
    error?: string;
    notes: Note[];
    note: Note;
    authenticated: boolean;
    token?: string;
  };
  if (onGitHub() && path === 'session' && res.ok) {
    if (method === 'POST' && typeof value.token === 'string')
      window.sessionStorage.setItem(adminTokenKey, value.token);
    if (method === 'DELETE' || (method === 'GET' && !value.authenticated))
      clearBrowserToken();
  }
  if (!res.ok) throw new Error(value.error ?? '请求未完成');
  return value;
}

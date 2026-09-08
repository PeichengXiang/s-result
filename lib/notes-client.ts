export const hostedOrigin =
  'https://sparkarena-egovla-results.swoony-otter-6245.chatgpt.site';
export type Note = {
  key: string;
  text: string;
  abnormal: number;
  version: number;
  updated_at: string;
  author: string;
};
export const onGitHub = () =>
  typeof location !== 'undefined' && location.hostname.endsWith('.github.io');
export const apiUrl = (path: string) =>
  (onGitHub() ? hostedOrigin : '') + '/api/' + path;
export async function api(path: string, method = 'GET', body?: unknown) {
  const res = await fetch(apiUrl(path), {
    method,
    credentials: onGitHub() ? 'omit' : 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const value = (await res.json()) as {
    error?: string;
    notes: Note[];
    note: Note;
    authenticated: boolean;
  };
  if (!res.ok) throw new Error(value.error ?? '请求未完成');
  return value;
}

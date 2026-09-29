// Small JSON helper for the account and settings screens. Errors carry the server's Dutch message.

export class ApiError extends Error {
  constructor(message, status, body) { super(message); this.status = status; this.body = body; }
}

export async function api(method, url, body) {
  let r;
  try {
    r = await fetch(url, {
      method, credentials: 'same-origin', cache: 'no-store',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) { throw new ApiError('Kon de server niet bereiken.', 0); }
  if (r.status === 401) { window.location.href = '/login'; throw new ApiError('Sessie verlopen.', 401); }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(data.message || `Er ging iets mis (${r.status}).`, r.status, data);
  return data;
}

/** Downloads a JSON endpoint as a file. */
export async function download(url) {
  const r = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new ApiError(d.message || 'Downloaden mislukt.', r.status); }
  const name = (/filename="([^"]+)"/.exec(r.headers.get('Content-Disposition') || '') || [])[1] || 'export.json';
  const blob = new Blob([JSON.stringify(await r.json(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export const fmtDate = t => t ? new Date(t).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
export const fmtDateTime = t => t ? new Date(t).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

/** "Chrome op macOS" from a user-agent string. */
export function deviceOf(ua = '') {
  const b = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${b} op ${os}` : b;
}

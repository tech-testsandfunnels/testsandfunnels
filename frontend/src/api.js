/* api.js
   Fetch wrapper for the CRM API. Attaches the stored JWT, sends/parses JSON
   and throws an Error (with the server's message and HTTP status) on any
   non-2xx. A 401 logs the user out. The token lives in localStorage. */
const TOKEN_KEY = 'tf_crm_token';

export const getToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
export const setToken = (t) => { try { localStorage.setItem(TOKEN_KEY, t); } catch { /* private mode */ } };
export const clearToken = () => { try { localStorage.removeItem(TOKEN_KEY); } catch { /* private mode */ } };

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

export async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = 'Bearer ' + token;
  let res;
  try {
    res = await fetch('/api' + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error('Cannot reach the CRM server. Check your connection.');
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/auth/login') onUnauthorized();
  if (!res.ok) {
    const err = new Error(data.error || 'Request failed (' + res.status + ')');
    err.status = res.status;
    throw err;
  }
  return data;
}

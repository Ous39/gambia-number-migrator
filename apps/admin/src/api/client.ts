export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8089/api';

export function getToken() { return localStorage.getItem('gnm_admin_token'); }
export function setToken(token: string) { localStorage.setItem('gnm_admin_token', token); }
export function setAdmin(admin: unknown) { localStorage.setItem('gnm_admin_user', JSON.stringify(admin)); }
export function getAdmin(): any { try { return JSON.parse(localStorage.getItem('gnm_admin_user') || 'null'); } catch { return null; } }
export function clearToken() { localStorage.removeItem('gnm_admin_token'); localStorage.removeItem('gnm_admin_user'); }

async function readJson(res: Response) {
  try { return await res.json(); } catch { return {}; }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
        ...(options.headers || {})
      }
    });
  } catch {
    throw new Error(`Cannot reach API at ${API_BASE_URL}. Start START_API.bat and check port 8089.`);
  }
  const data = await readJson(res);
  if (res.status === 401) {
    clearToken();
    window.dispatchEvent(new CustomEvent('gnm-auth-expired'));
    throw new Error((data as any).message || 'Session expired. Please login again.');
  }
  if (!res.ok) throw new Error((data as any).message || (data as any).error || `Request failed (${res.status})`);
  return data as T;
}

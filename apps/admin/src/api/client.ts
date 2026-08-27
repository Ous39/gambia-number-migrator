export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8089/api';

// Keep privileged credentials only for the browser session. This limits token
// persistence on shared/admin computers and reduces the impact of token theft.
export function getToken() { return sessionStorage.getItem('gnm_admin_token'); }
export function setToken(token: string) { sessionStorage.setItem('gnm_admin_token', token); }
export function setAdmin(admin: unknown) { sessionStorage.setItem('gnm_admin_user', JSON.stringify(admin)); }
export function getAdmin(): any { try { return JSON.parse(sessionStorage.getItem('gnm_admin_user') || 'null'); } catch { return null; } }
export function clearToken() {
  sessionStorage.removeItem('gnm_admin_token');
  sessionStorage.removeItem('gnm_admin_user');
  // Remove credentials written by versions before 2.8.12.
  localStorage.removeItem('gnm_admin_token');
  localStorage.removeItem('gnm_admin_user');
}

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

// Resolves a photo path returned by the upload endpoint (e.g. "/uploads/x.jpg")
// against the API's origin, so it renders whether the admin points at
// localhost or the production API host.
export function resolveAssetUrl(pathOrUrl?: string | null): string {
  if (!pathOrUrl) return '';
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const origin = API_BASE_URL.replace(/\/api\/?$/, '');
  return `${origin}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
}

export async function uploadTeamPhoto(file: File): Promise<{ url: string }> {
  const body = new FormData();
  body.append('photo', file);
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/admin/uploads/team-photo`, {
      method: 'POST',
      headers: { ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
      body,
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
  if (!res.ok) throw new Error((data as any).message || (data as any).error || `Upload failed (${res.status})`);
  return (data as any).data;
}

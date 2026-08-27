export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8089/api';

async function readJson(res: Response) {
  try { return await res.json(); } catch { return {}; }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
  } catch {
    throw new Error('Could not reach the GNM service. Please try again shortly.');
  }
  const data = await readJson(res);
  if (!res.ok) throw new Error((data as any).message || (data as any).error || `Request failed (${res.status})`);
  return data as T;
}

export type TeamMember = {
  id: string;
  name: string;
  role: string;
  bio: string;
  initials: string;
  photoUrl?: string | null;
  longBio?: string | null;
  portfolioUrl?: string | null;
};

export type PublicContent = {
  announcements: Array<{ id: string; title: string; body: string; createdAt: string }>;
  faqs: Array<{ id: string; question: string; answer: string }>;
  team: TeamMember[];
};

export function getPublicContent() {
  return api<{ data: PublicContent }>('/public-content').then((r) => r.data);
}

// Resolves a photo path returned by the API (e.g. "/uploads/x.jpg") against the
// API's origin, so it renders regardless of which host serves the website.
export function resolveAssetUrl(pathOrUrl?: string | null): string {
  if (!pathOrUrl) return '';
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const origin = API_BASE_URL.replace(/\/api\/?$/, '');
  return `${origin}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
}

export type AppConfig = Record<string, unknown>;

export function getAppConfig() {
  return api<{ data: AppConfig }>('/app-config').then((r) => r.data);
}

export function submitInquiry(payload: { name: string; email: string; category: string; message: string }) {
  return api<{ data: { id: string } }>('/inquiries', { method: 'POST', body: JSON.stringify(payload) });
}

export type PublicStatus = {
  generatedAt: string;
  degraded?: boolean;
  service: { maintenance: boolean; minimumAppVersion: string | null };
  pricing: { amount: number; currency: string; freeLaunch: boolean; freeMode: string; promotionalPlacesRemaining: number | null };
  payments: { wave: boolean; aps: boolean };
  stores: { android: string | null; ios: string | null };
  rules: { publishedVersion: number | null; publishedAt: string | null; activeRuleCount: number | null };
  transition: { startDate: string | null; endDate: string | null; showNotice: boolean | null; bannerMessage: string | null };
  announcement: string | null;
};

export type UpdateEntry = { slug: string; title: string; summary: string; body: string; publishedAt: string };

export function getStatus() {
  return api<{ data: PublicStatus }>('/public/status').then((r) => r.data);
}
export function getUpdates() {
  return api<{ data: UpdateEntry[] }>('/public/updates').then((r) => r.data);
}
export function getUpdate(slug: string) {
  return api<{ data: UpdateEntry }>(`/public/updates/${encodeURIComponent(slug)}`).then((r) => r.data);
}

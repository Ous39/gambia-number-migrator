import Constants from 'expo-constants';
import { DEFAULT_RULES_PAYLOAD, DEFAULT_TRANSITION_SETTINGS, PublishedRulesPayload, TransitionSettings } from '@gnm/shared';
import { getJson, keys, setJson } from './storage';

function getExpoHostIp(): string | null {
  const constantsAny = Constants as any;
  const candidates = [(Constants.expoConfig as any)?.hostUri, constantsAny.manifest?.debuggerHost, constantsAny.manifest?.hostUri, constantsAny.manifest2?.extra?.expoClient?.hostUri, constantsAny.manifest2?.extra?.expoGo?.debuggerHost].filter(Boolean) as string[];
  const hostUri = candidates[0];
  if (!hostUri) return null;
  const host = hostUri.replace(/^https?:\/\//, '').split(':')[0];
  if (!host || host === 'localhost' || host === '127.0.0.1') return null;
  return host;
}
export function getApiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL || '';
  const isLocalhost = configured.includes('localhost') || configured.includes('127.0.0.1');
  const expoHost = getExpoHostIp();
  if ((!configured || isLocalhost) && expoHost) return `http://${expoHost}:8089/api`;
  return configured || 'http://localhost:8089/api';
}
async function safeJson(res: Response) { try { return await res.json(); } catch { return {}; } }
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  try {
    const res = await fetch(`${getApiBaseUrl()}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
    const data = await safeJson(res);
    if (!res.ok) throw new Error((data as any).message || (data as any).error || `Request failed (${res.status})`);
    return data as T;
  } catch (error: any) {
    const message = error?.message === 'Network request failed' ? `Cannot reach API at ${getApiBaseUrl()}. Start the API and make sure your phone and PC are on the same network.` : error?.message || 'Network request failed';
    throw new Error(message);
  }
}
export async function syncRules(): Promise<PublishedRulesPayload> { try { const r = await request<{ data: PublishedRulesPayload }>('/migration-rules'); await setJson(keys.rules, r.data); return r.data; } catch { return getJson(keys.rules, DEFAULT_RULES_PAYLOAD); } }
export async function syncTransition(): Promise<TransitionSettings> { try { const r = await request<{ data: TransitionSettings }>('/transition-settings'); await setJson(keys.transition, r.data); return r.data; } catch { return getJson(keys.transition, DEFAULT_TRANSITION_SETTINGS); } }
export async function syncConfig(): Promise<Record<string, unknown>> { try { const r = await request<{ data: Record<string, unknown> }>('/app-config'); await setJson(keys.config, r.data); return r.data; } catch { return getJson(keys.config, {}); } }
export async function createPaymentIntent(body: any) { const data = await request<{ data: any }>('/payments/create-intent', { method: 'POST', body: JSON.stringify(body) }); return data.data; }
export async function verifyPaymentOtp(reference: string, otp: string) { const data = await request<{ data: any }>('/payments/verify-otp', { method: 'POST', body: JSON.stringify({ reference, otp }) }); return data.data; }
export async function getPaymentStatus(reference: string) { const data = await request<{ data: any }>(`/payments/${reference}/status`); return data.data; }
export async function registerDevice(deviceId: string, info: Record<string, unknown>) { try { const data = await request<{ data: any }>('/devices/register', { method: 'POST', body: JSON.stringify({ fingerprint: deviceId, ...info }) }); return data.data || data; } catch { return null; } }
export async function getDeviceStatus(deviceId: string) { const data = await request<{ data: any }>(`/devices/${encodeURIComponent(deviceId)}/status`); return data.data || data; }
export async function consumeTrialAllowance(deviceId: string, count: number) { const data = await request<{ data: any }>(`/devices/${encodeURIComponent(deviceId)}/trial-increment`, { method: 'POST', body: JSON.stringify({ count }) }); return data.data || data; }
export async function registerPushToken(deviceId: string, expoPushToken: string, platform: 'android' | 'ios') { return request('/notifications/register-token', { method: 'POST', body: JSON.stringify({ deviceId, expoPushToken, platform }) }); }
export async function getNotifications(deviceId: string) { const data = await request<{ data: any[] }>(`/notifications?deviceId=${encodeURIComponent(deviceId)}`); return data.data; }

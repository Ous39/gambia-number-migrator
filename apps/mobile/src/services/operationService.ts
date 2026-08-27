import { getJson, keys, setJson } from './storage';

export type OperationKind = 'scan' | 'migration' | 'cleanup' | 'backup' | 'restore';
export type OperationJob = {
  id: string;
  kind: OperationKind;
  title: string;
  status: 'running' | 'completed' | 'failed' | 'paused';
  processed: number;
  total: number;
  percent: number;
  message?: string;
  route?: string;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
};
let lastProgressWrite = 0;

export async function getOperationJob() { return getJson<OperationJob | null>(keys.operationJob, null); }

export async function startOperation(kind: OperationKind, title: string, total = 0, route?: string) {
  const now = new Date().toISOString();
  const job: OperationJob = { id: `OP-${Date.now()}`, kind, title, status: 'running', processed: 0, total, percent: 0, route, startedAt: now, updatedAt: now };
  await setJson(keys.operationJob, job);
  return job;
}

export async function updateOperation(progress: Partial<Pick<OperationJob, 'processed' | 'total' | 'percent' | 'message'>>) {
  const nowMs = Date.now();
  if (Number(progress.percent || 0) < 100 && nowMs - lastProgressWrite < 500) return null;
  lastProgressWrite = nowMs;
  const current = await getOperationJob();
  if (!current || current.status !== 'running') return current;
  const total = Number(progress.total ?? current.total);
  const processed = Number(progress.processed ?? current.processed);
  const percent = Math.max(0, Math.min(100, Number(progress.percent ?? (total ? Math.round((processed / total) * 100) : current.percent))));
  const next = { ...current, ...progress, processed, total, percent, updatedAt: new Date().toISOString() };
  await setJson(keys.operationJob, next);
  return next;
}

export async function finishOperation(message?: string) {
  const current = await getOperationJob();
  if (!current) return null;
  const now = new Date().toISOString();
  const next: OperationJob = { ...current, status: 'completed', percent: 100, message, updatedAt: now, completedAt: now };
  await setJson(keys.operationJob, next);
  return next;
}

export async function failOperation(message: string) {
  const current = await getOperationJob();
  if (!current) return null;
  const next: OperationJob = { ...current, status: 'failed', message, updatedAt: new Date().toISOString() };
  await setJson(keys.operationJob, next);
  return next;
}

export function cleanupAvailability(config: Record<string, unknown>) {
  const enabled = config.cleanup_enabled === true;
  const now = Date.now();
  const from = config.cleanup_available_from ? Date.parse(String(config.cleanup_available_from)) : NaN;
  const until = config.cleanup_available_until ? Date.parse(String(config.cleanup_available_until)) : NaN;
  if (!enabled) return { available: false, reason: 'Duplicate cleanup is currently disabled by the administrator.' };
  if (Number.isFinite(from) && now < from) return { available: false, reason: `Duplicate cleanup opens ${new Date(from).toLocaleString()}.` };
  if (Number.isFinite(until) && now > until) return { available: false, reason: `Duplicate cleanup closed ${new Date(until).toLocaleString()}.` };
  return { available: true, reason: 'Verified duplicate cleanup is available.' };
}

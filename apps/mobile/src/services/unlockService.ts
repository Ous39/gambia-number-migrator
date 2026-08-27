import { getJson, keys, setJson } from './storage';
import { consumeTrialAllowance, getDeviceStatus, registerDevice } from './api';
import { getDeviceFingerprint, getDeviceInfo } from './deviceService';

export const PREMIUM_FEATURES = {
  bulkDuplicateAdd: 'bulk_duplicate_add',
  replace: 'replace',
  cleanup: 'cleanup',
  backupRestore: 'backup_restore',
  exportReport: 'export_report',
  bulkUnlock: 'bulk_unlock'
} as const;

export type PremiumFeatureKey = typeof PREMIUM_FEATURES[keyof typeof PREMIUM_FEATURES];

type UnlockMap = Record<string, boolean | string>;

export type AccessStatus = {
  status: 'trial' | 'pending_payment' | 'active' | 'blocked' | 'offline';
  paid: boolean;
  trialContactsUsed: number;
  freeTrialLimit: number;
  remaining: number;
  accessSource: 'trial' | 'paid' | 'campaign' | 'admin' | 'blocked';
  promotional: boolean;
};

const EMPTY_ACCESS: AccessStatus = { status: 'offline', paid: false, trialContactsUsed: 0, freeTrialLimit: 10, remaining: 10, accessSource: 'trial', promotional: false };

export async function getAccessStatus(): Promise<AccessStatus> {
  const cached = await getJson<AccessStatus>(keys.accessStatus, EMPTY_ACCESS);
  try {
    const deviceId = await getDeviceFingerprint();
    await registerDevice(deviceId, getDeviceInfo());
    const remote = await getDeviceStatus(deviceId);
    const used = Math.max(0, Number(remote?.trialContactsUsed || 0));
    const limit = Math.max(0, Number(remote?.freeTrialLimit ?? 10));
    const status = String(remote?.status || 'trial') as AccessStatus['status'];
    const accessSource = String(remote?.accessSource || (status === 'active' ? 'paid' : 'trial')) as AccessStatus['accessSource'];
    const next = { status, paid: status === 'active', trialContactsUsed: used, freeTrialLimit: limit, remaining: Math.max(0, limit - used), accessSource, promotional: accessSource === 'campaign' };
    await setJson(keys.accessStatus, next);
    if (next.paid) await markFeatureUnlocked(PREMIUM_FEATURES.bulkUnlock, 'server-confirmed');
    return next;
  } catch {
    return cached;
  }
}

export async function isFeatureUnlocked(featureKey: PremiumFeatureKey): Promise<boolean> {
  const unlocks = await getJson<UnlockMap>(keys.unlocks, {});
  return Boolean(unlocks[featureKey] || unlocks[PREMIUM_FEATURES.bulkUnlock]);
}

export async function markFeatureUnlocked(featureKey: PremiumFeatureKey, reference?: string) {
  const unlocks = await getJson<UnlockMap>(keys.unlocks, {});
  unlocks[featureKey] = reference || true;
  if (featureKey === PREMIUM_FEATURES.bulkUnlock) {
    unlocks[PREMIUM_FEATURES.bulkDuplicateAdd] = reference || true;
    unlocks[PREMIUM_FEATURES.replace] = reference || true;
    unlocks[PREMIUM_FEATURES.cleanup] = reference || true;
    unlocks[PREMIUM_FEATURES.backupRestore] = reference || true;
    unlocks[PREMIUM_FEATURES.exportReport] = reference || true;
  }
  await setJson(keys.unlocks, unlocks);
}

export async function authorizeMigration(count: number, mode: 'duplicate' | 'replace') {
  const deviceId = await getDeviceFingerprint();
  await registerDevice(deviceId, getDeviceInfo());
  // Reconcile a successful local write whose allowance update was interrupted
  // before permitting another free migration.
  const pendingUsage = Math.max(0, Math.floor(await getJson<number>(keys.pendingTrialUsage, 0)));
  if (pendingUsage) {
    await consumeTrialAllowance(deviceId, pendingUsage);
    await setJson(keys.pendingTrialUsage, 0);
  }
  const status = await getDeviceStatus(deviceId);
  if (status?.status === 'blocked') throw new Error('This device is blocked. Contact support for assistance.');
  if (status?.status === 'active') {
    await getAccessStatus();
    return { access: 'paid' as const, remaining: null };
  }
  if (mode === 'replace') throw new Error('Replace mode is a premium feature. Complete payment to continue.');
  const limit = Math.max(0, Number(status?.freeTrialLimit || 0));
  const used = Math.max(0, Number(status?.trialContactsUsed || 0));
  const remaining = Math.max(0, limit - used);
  if (count > remaining) throw new Error(`You have ${remaining} free contact migration${remaining === 1 ? '' : 's'} remaining. Select fewer contacts or unlock unlimited migration.`);
  return { access: 'trial' as const, remaining };
}

/**
 * Charge only successful writes. Failed and skipped contacts must never consume
 * the user's free allowance.
 */
export async function settleMigrationAllowance(reserved: number, succeeded: number) {
  void reserved;
  const completed = Math.max(0, Math.floor(succeeded));
  if (!completed) return;
  const deviceId = await getDeviceFingerprint();
<<<<<<< HEAD
  const previousPending = Math.max(0, Math.floor(await getJson<number>(keys.pendingTrialUsage, 0)));
  const total = previousPending + completed;
  await setJson(keys.pendingTrialUsage, total);
  await consumeTrialAllowance(deviceId, total);
  await setJson(keys.pendingTrialUsage, 0);
=======
  await consumeTrialAllowance(deviceId, completed);
>>>>>>> caf642300d18bdafaf97e0019a2a51dfed96b56c
  await getAccessStatus();
}

export async function requirePaidFeature() {
  const deviceId = await getDeviceFingerprint();
  const registered = await registerDevice(deviceId, getDeviceInfo());
  if (!registered) throw new Error('Connect to the internet so the app can verify your Full Unlock.');
  const remote = await getDeviceStatus(deviceId);
  if (remote?.status === 'blocked') throw new Error('This device is blocked. Contact support for assistance.');
  if (remote?.status !== 'active') throw new Error('This feature requires the full unlock. Complete payment to continue.');
  await getAccessStatus();
  return true;
}

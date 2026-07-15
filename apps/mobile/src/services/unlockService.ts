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
  const status = await getDeviceStatus(deviceId);
  if (status?.status === 'blocked') throw new Error('This device is blocked. Contact support for assistance.');
  if (status?.status === 'active') return { access: 'paid' as const, remaining: null };
  if (mode === 'replace') throw new Error('Replace mode is a premium feature. Complete payment to continue.');
  try {
    const result = await consumeTrialAllowance(deviceId, count);
    return { access: 'trial' as const, remaining: Math.max(0, Number(result.freeTrialLimit || 0) - Number(result.trialContactsUsed || 0)) };
  } catch (error: any) {
    throw new Error(error?.message?.includes('Premium') ? 'Your free 10-contact trial is complete. Unlock unlimited migration to continue.' : error?.message || 'Could not verify migration access.');
  }
}

export async function requirePaidFeature() {
  const deviceId = await getDeviceFingerprint();
  await registerDevice(deviceId, getDeviceInfo());
  const status = await getDeviceStatus(deviceId);
  if (status?.status !== 'active') throw new Error('This feature requires the full unlock. Complete payment to continue.');
  return true;
}

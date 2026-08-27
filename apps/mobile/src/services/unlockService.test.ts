import { beforeEach, describe, expect, it, vi } from 'vitest';

const { store, api } = vi.hoisted(() => {
  const store = new Map<string, unknown>();
  const api = {
    registerDevice: vi.fn(async () => ({ id: 'device-1' })),
    getDeviceStatus: vi.fn(),
    consumeTrialAllowance: vi.fn(async () => ({})),
  };
  return { store, api };
});

vi.mock('./storage', () => ({
  keys: { accessStatus: 'gnm_access_status', unlocks: 'gnm_unlocks', pendingTrialUsage: 'gnm_pending_trial_usage' },
  getJson: vi.fn(async (key: string, fallback: unknown) => (store.has(key) ? store.get(key) : fallback)),
  setJson: vi.fn(async (key: string, value: unknown) => { store.set(key, value); }),
}));

vi.mock('./api', () => api);
vi.mock('./deviceService', () => ({
  getDeviceFingerprint: vi.fn(async () => 'device-1'),
  getDeviceInfo: vi.fn(() => ({ platform: 'android' })),
}));

import { authorizeMigration, isFeatureUnlocked, markFeatureUnlocked, PREMIUM_FEATURES, requirePaidFeature, settleMigrationAllowance } from './unlockService';

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
  api.registerDevice.mockResolvedValue({ id: 'device-1' });
  api.consumeTrialAllowance.mockResolvedValue({});
});

describe('authorizeMigration', () => {
  it('blocks a blocked device', async () => {
    api.getDeviceStatus.mockResolvedValue({ status: 'blocked' });
    await expect(authorizeMigration(1, 'duplicate')).rejects.toThrow(/blocked/i);
  });

  it('grants unlimited access for a paid device', async () => {
    api.getDeviceStatus.mockResolvedValue({ status: 'active', accessSource: 'paid' });
    const result = await authorizeMigration(500, 'replace');
    expect(result).toEqual({ access: 'paid', remaining: null });
  });

  it('rejects replace mode for a trial device', async () => {
    api.getDeviceStatus.mockResolvedValue({ status: 'trial', trialContactsUsed: 0, freeTrialLimit: 10 });
    await expect(authorizeMigration(1, 'replace')).rejects.toThrow(/premium feature/i);
  });

  it('enforces the remaining free-trial allowance', async () => {
    api.getDeviceStatus.mockResolvedValue({ status: 'trial', trialContactsUsed: 8, freeTrialLimit: 10 });
    await expect(authorizeMigration(5, 'duplicate')).rejects.toThrow(/2 free contact migrations remaining/i);
    const ok = await authorizeMigration(2, 'duplicate');
    expect(ok).toEqual({ access: 'trial', remaining: 2 });
  });

  it('reconciles interrupted usage before checking the current allowance', async () => {
    store.set('gnm_pending_trial_usage', 3);
    api.getDeviceStatus.mockResolvedValue({ status: 'trial', trialContactsUsed: 3, freeTrialLimit: 10 });
    await authorizeMigration(1, 'duplicate');
    expect(api.consumeTrialAllowance).toHaveBeenCalledWith('device-1', 3);
    expect(store.get('gnm_pending_trial_usage')).toBe(0);
  });
});

describe('settleMigrationAllowance', () => {
  it('never charges the allowance for zero successful writes', async () => {
    await settleMigrationAllowance(10, 0);
    expect(api.consumeTrialAllowance).not.toHaveBeenCalled();
  });

  it('charges only the succeeded count, not the reserved/selected count', async () => {
    api.getDeviceStatus.mockResolvedValue({ status: 'trial', trialContactsUsed: 0, freeTrialLimit: 10 });
    await settleMigrationAllowance(10, 4);
    expect(api.consumeTrialAllowance).toHaveBeenCalledWith('device-1', 4);
  });
});

describe('requirePaidFeature', () => {
  it('rejects when the device is not active', async () => {
    api.getDeviceStatus.mockResolvedValue({ status: 'trial' });
    await expect(requirePaidFeature()).rejects.toThrow(/full unlock/i);
  });
  it('rejects a blocked device even if previously active', async () => {
    api.getDeviceStatus.mockResolvedValue({ status: 'blocked' });
    await expect(requirePaidFeature()).rejects.toThrow(/blocked/i);
  });
  it('resolves for an active device', async () => {
    api.getDeviceStatus.mockResolvedValue({ status: 'active', accessSource: 'paid' });
    await expect(requirePaidFeature()).resolves.toBe(true);
  });
});

describe('feature unlock flags', () => {
  it('unlocks every premium feature when bulkUnlock is granted', async () => {
    expect(await isFeatureUnlocked(PREMIUM_FEATURES.cleanup)).toBe(false);
    await markFeatureUnlocked(PREMIUM_FEATURES.bulkUnlock, 'PAY-REF-1');
    expect(await isFeatureUnlocked(PREMIUM_FEATURES.cleanup)).toBe(true);
    expect(await isFeatureUnlocked(PREMIUM_FEATURES.backupRestore)).toBe(true);
  });
});

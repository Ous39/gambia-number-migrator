import { beforeEach, describe, expect, it, vi } from 'vitest';

const { store } = vi.hoisted(() => ({ store: new Map<string, unknown>() }));

vi.mock('./storage', () => ({
  keys: { operationJob: 'gnm_operation_job' },
  getJson: vi.fn(async (key: string, fallback: unknown) => (store.has(key) ? store.get(key) : fallback)),
  setJson: vi.fn(async (key: string, value: unknown) => { store.set(key, value); }),
}));

import { cleanupAvailability, failOperation, finishOperation, getOperationJob, startOperation, updateOperation } from './operationService';

beforeEach(() => {
  store.clear();
});

describe('operation job persistence', () => {
  it('has no active job before one starts', async () => {
    expect(await getOperationJob()).toBeNull();
  });

  it('tracks a running operation and lets a later screen visit see it', async () => {
    await startOperation('cleanup', 'Removing verified old duplicates', 40, '/cleanup');
    const job = await getOperationJob();
    expect(job).toMatchObject({ kind: 'cleanup', status: 'running', total: 40, processed: 0, percent: 0 });
  });

  it('updates progress and derives percent from processed/total', async () => {
    await startOperation('migration', 'Adding new numbers', 200);
    await updateOperation({ processed: 50, total: 200, percent: 100 } as any);
    const job = await getOperationJob();
    expect(job).toMatchObject({ processed: 50, total: 200 });
  });

  it('marks completion at 100 percent with a summary message', async () => {
    await startOperation('backup', 'Full contacts backup', 10);
    const done = await finishOperation('10 contacts saved locally.');
    expect(done).toMatchObject({ status: 'completed', percent: 100, message: '10 contacts saved locally.' });
  });

  it('marks failure without discarding the last known progress', async () => {
    await startOperation('restore', 'Restoring backup', 5);
    await updateOperation({ processed: 2, total: 5, percent: 100 } as any);
    const failed = await failOperation('The contacts provider rejected the update.');
    expect(failed).toMatchObject({ status: 'failed', processed: 2, message: 'The contacts provider rejected the update.' });
  });

  it('does not update a job that already finished', async () => {
    await startOperation('scan', 'Scanning contacts', 10);
    await finishOperation('done');
    const result = await updateOperation({ processed: 5, total: 10, percent: 100 } as any);
    expect(result?.status).toBe('completed');
    expect(result?.processed).not.toBe(5);
  });
});

describe('cleanupAvailability', () => {
  it('is unavailable when the admin has not enabled cleanup', () => {
    expect(cleanupAvailability({ cleanup_enabled: false }).available).toBe(false);
  });

  it('is unavailable before the configured opening time', () => {
    const from = new Date(Date.now() + 60_000).toISOString();
    const result = cleanupAvailability({ cleanup_enabled: true, cleanup_available_from: from });
    expect(result.available).toBe(false);
    expect(result.reason).toMatch(/opens/i);
  });

  it('is unavailable after the configured closing time', () => {
    const until = new Date(Date.now() - 60_000).toISOString();
    const result = cleanupAvailability({ cleanup_enabled: true, cleanup_available_until: until });
    expect(result.available).toBe(false);
    expect(result.reason).toMatch(/closed/i);
  });

  it('is available when enabled with no schedule restriction', () => {
    expect(cleanupAvailability({ cleanup_enabled: true }).available).toBe(true);
  });

  it('is available inside an open schedule window', () => {
    const from = new Date(Date.now() - 60_000).toISOString();
    const until = new Date(Date.now() + 60_000).toISOString();
    expect(cleanupAvailability({ cleanup_enabled: true, cleanup_available_from: from, cleanup_available_until: until }).available).toBe(true);
  });
});

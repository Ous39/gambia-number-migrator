import type { NextFunction, Request, Response } from 'express';
import crypto from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db/pool', () => ({ query: vi.fn() }));
import { query } from '../src/db/pool';
import { requireDeviceSecret } from '../src/middleware/deviceSecret';

const mockedQuery = vi.mocked(query);

function response() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res._json = vi.fn().mockReturnValue(res);
  res.json = res._json;
  return res as Response;
}

function request(secret?: string) {
  return {
    params: { fingerprint: 'device-123' },
    body: {},
    header: vi.fn((name: string) => name.toLowerCase() === 'x-device-secret' ? secret : undefined),
  } as unknown as Request;
}

describe('requireDeviceSecret', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects a missing secret for a protected device', async () => {
    mockedQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{ device_secret_hash: crypto.createHash('sha256').update('correct').digest('hex') }] } as any);
    const res = response();
    const next = vi.fn() as NextFunction;
    await requireDeviceSecret(request(), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects an incorrect secret', async () => {
    mockedQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{ device_secret_hash: crypto.createHash('sha256').update('correct').digest('hex') }] } as any);
    const res = response();
    const next = vi.fn() as NextFunction;
    await requireDeviceSecret(request('wrong'), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts a matching secret', async () => {
    mockedQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{ device_secret_hash: crypto.createHash('sha256').update('correct').digest('hex') }] } as any);
    const next = vi.fn() as NextFunction;
    await requireDeviceSecret(request('correct'), response(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('soft-migrates a legacy device using the supplied secret', async () => {
    mockedQuery
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ device_secret_hash: null }] } as any)
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'device-123' }] } as any);
    const next = vi.fn() as NextFunction;
    await requireDeviceSecret(request('new-secret'), response(), next);
    expect(mockedQuery).toHaveBeenLastCalledWith(expect.stringContaining('device_secret_hash=$2'), ['device-123', crypto.createHash('sha256').update('new-secret').digest('hex')]);
    expect(next).toHaveBeenCalledOnce();
  });

  it('generates and returns a secret once when a legacy client has none', async () => {
    mockedQuery
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ device_secret_hash: null }] } as any)
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'device-123' }] } as any);
    const res = response();
    const next = vi.fn() as NextFunction;
    await requireDeviceSecret(request(), res, next);
    res.json({ data: { ok: true } });
    expect((res as any)._json).toHaveBeenCalledWith(expect.objectContaining({ deviceSecret: expect.stringMatching(/^[a-f0-9]{64}$/) }));
    expect(next).toHaveBeenCalledOnce();
  });
});

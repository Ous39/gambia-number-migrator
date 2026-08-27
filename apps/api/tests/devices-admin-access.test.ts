import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/middleware/auth', () => ({ requireAdmin: (_req: any, _res: any, next: any) => next() }));
vi.mock('../src/middleware/deviceSecret', () => ({ requireDeviceSecret: (_req: any, _res: any, next: any) => next() }));
vi.mock('../src/services/auditService', () => ({ audit: vi.fn() }));

let device: { id: string; status: string; access_source: string };

function fakeQuery(text: string, params: any[] = []): Promise<any> {
  const sql = text.replace(/\s+/g, ' ').trim();
  if (/SELECT \* FROM devices WHERE id=\$1 LIMIT 1/.test(sql)) {
    return Promise.resolve(device ? { rowCount: 1, rows: [{ ...device }] } : { rowCount: 0, rows: [] });
  }
  if (/UPDATE devices SET status='active', access_source='admin'/.test(sql)) {
    if (device.status === 'blocked') return Promise.resolve({ rowCount: 0, rows: [] });
    device.status = 'active';
    device.access_source = 'admin';
    return Promise.resolve({ rowCount: 1, rows: [{ ...device, trial_contacts_used: 0 }] });
  }
  if (/UPDATE devices SET status='trial', access_source='trial'/.test(sql)) {
    if (device.access_source !== 'admin') return Promise.resolve({ rowCount: 0, rows: [] });
    device.status = 'trial';
    device.access_source = 'trial';
    return Promise.resolve({ rowCount: 1, rows: [{ ...device, trial_contacts_used: 0 }] });
  }
  return Promise.resolve({ rowCount: 0, rows: [] });
}

vi.mock('../src/db/pool', () => ({
  query: (t: string, p: any[]) => fakeQuery(t, p),
  withTransaction: async (work: (c: any) => Promise<any>) => work({ query: (t: string, p: any[]) => fakeQuery(t, p) })
}));

// eslint-disable-next-line import/first
import { devicesRouter } from '../src/routes/devices';
// eslint-disable-next-line import/first
import { errorHandler } from '../src/middleware/errorHandler';

function app() {
  const a = express();
  a.use(express.json());
  a.use('/api', devicesRouter);
  a.use(errorHandler);
  return a;
}

beforeEach(() => { device = { id: 'dev-1', status: 'trial', access_source: 'trial' }; });

describe('admin device access grant/revoke', () => {
  it('grants full access as an administrative source', async () => {
    const res = await request(app()).post('/api/admin/devices/dev-1/grant-access').send({});
    expect(res.status).toBe(200);
    expect(device.status).toBe('active');
    expect(device.access_source).toBe('admin');
  });

  it('refuses to grant access to a blocked device', async () => {
    device.status = 'blocked';
    const res = await request(app()).post('/api/admin/devices/dev-1/grant-access').send({});
    expect(res.status).toBe(409);
  });

  it('404s for an unknown device', async () => {
    device = undefined as any;
    const res = await request(app()).post('/api/admin/devices/nope/grant-access').send({});
    expect(res.status).toBe(404);
  });

  it('revokes only an administrative grant', async () => {
    device = { id: 'dev-1', status: 'active', access_source: 'admin' };
    const res = await request(app()).post('/api/admin/devices/dev-1/revoke-access').send({});
    expect(res.status).toBe(200);
    expect(device.status).toBe('trial');
  });

  it('will not revoke paid access via the admin-grant endpoint', async () => {
    device = { id: 'dev-1', status: 'active', access_source: 'paid' };
    const res = await request(app()).post('/api/admin/devices/dev-1/revoke-access').send({});
    expect(res.status).toBe(409);
    expect(device.access_source).toBe('paid');
  });
});

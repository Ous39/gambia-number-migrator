import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/middleware/auth', () => ({ requireAdmin: (_req: any, _res: any, next: any) => next() }));
vi.mock('../src/middleware/deviceSecret', () => ({ requireDeviceSecret: (_req: any, _res: any, next: any) => next() }));
vi.mock('../src/services/auditService', () => ({ audit: vi.fn() }));

type Code = {
  id: string; code: string; seats: number; redeemed_count: number;
  source: string; status: string; label: string | null; payment_id: string | null;
  expires_at: string | null; created_at: string;
};

let codes: Code[];
let redemptions: Array<{ code_id: string; device_id: string }>;
let device: { id: string; status: string; access_source: string } | null;

function fakeQuery(text: string, params: any[] = []): Promise<any> {
  const sql = text.replace(/\s+/g, ' ').trim();

  if (/SELECT \* FROM access_codes WHERE code=\$1 FOR UPDATE/.test(sql)) {
    const row = codes.find((c) => c.code === params[0]);
    return Promise.resolve({ rowCount: row ? 1 : 0, rows: row ? [{ ...row }] : [] });
  }
  if (/SELECT id,status FROM devices WHERE id=\$1 LIMIT 1/.test(sql)) {
    return Promise.resolve(device ? { rowCount: 1, rows: [{ id: device.id, status: device.status }] } : { rowCount: 0, rows: [] });
  }
  if (/SELECT 1 FROM access_code_redemptions WHERE code_id=\$1 AND device_id=\$2/.test(sql)) {
    const hit = redemptions.some((r) => r.code_id === params[0] && r.device_id === params[1]);
    return Promise.resolve({ rowCount: hit ? 1 : 0, rows: hit ? [{ '?column?': 1 }] : [] });
  }
  if (/INSERT INTO access_code_redemptions/.test(sql)) {
    redemptions.push({ code_id: params[0], device_id: params[1] });
    return Promise.resolve({ rowCount: 1, rows: [] });
  }
  if (/UPDATE access_codes SET redeemed_count = redeemed_count \+ 1/.test(sql)) {
    const c = codes.find((x) => x.id === params[0]);
    if (c) c.redeemed_count += 1;
    return Promise.resolve({ rowCount: 1, rows: [] });
  }
  if (/UPDATE access_codes SET status='expired'/.test(sql)) {
    const c = codes.find((x) => x.id === params[0]);
    if (c) c.status = 'expired';
    return Promise.resolve({ rowCount: 1, rows: [] });
  }
  if (/UPDATE devices SET status = CASE WHEN status = 'blocked'/.test(sql)) {
    if (device && device.status !== 'blocked') { device.status = 'active'; device.access_source = 'code'; }
    return Promise.resolve({ rowCount: 1, rows: [] });
  }
  if (/INSERT INTO audit_logs/.test(sql)) {
    return Promise.resolve({ rowCount: 1, rows: [] });
  }
  if (/INSERT INTO access_codes .* ON CONFLICT \(code\) DO NOTHING RETURNING \*/.test(sql)) {
    const row: Code = {
      id: `code-${codes.length + 1}`, code: params[0], seats: params[1], redeemed_count: 0,
      source: 'admin', status: 'active', label: params[2] ?? null, payment_id: null,
      expires_at: params[4] ?? null, created_at: new Date().toISOString(),
    };
    codes.push(row);
    return Promise.resolve({ rowCount: 1, rows: [{ ...row }] });
  }
  if (/FROM access_codes ac LEFT JOIN payments/.test(sql)) {
    return Promise.resolve({ rowCount: codes.length, rows: codes.map((c) => ({ ...c, payment_reference: null, payment_amount: null, payment_currency: null })) });
  }
  if (/UPDATE access_codes SET status='revoked'.*WHERE id=\$1 AND status<>'revoked' RETURNING \*/.test(sql)) {
    const c = codes.find((x) => x.id === params[0]);
    if (!c || c.status === 'revoked') return Promise.resolve({ rowCount: 0, rows: [] });
    c.status = 'revoked';
    return Promise.resolve({ rowCount: 1, rows: [{ ...c }] });
  }
  if (/SELECT COUNT\(\*\)::int AS n/.test(sql)) {
    return Promise.resolve({ rowCount: 1, rows: [{ n: 0 }] });
  }
  return Promise.resolve({ rowCount: 0, rows: [] });
}

vi.mock('../src/db/pool', () => ({
  query: (t: string, p: any[]) => fakeQuery(t, p),
  withTransaction: async (work: (c: any) => Promise<any>) => work({ query: (t: string, p: any[]) => fakeQuery(t, p) }),
}));

// eslint-disable-next-line import/first
import { accessCodesRouter } from '../src/routes/accessCodes';
// eslint-disable-next-line import/first
import { errorHandler } from '../src/middleware/errorHandler';

function app() {
  const a = express();
  a.use(express.json());
  a.use('/api', accessCodesRouter);
  a.use(errorHandler);
  return a;
}

const CODE_ID = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  codes = [{
    id: CODE_ID, code: 'GNM-ABCD-2345', seats: 2, redeemed_count: 0,
    source: 'admin', status: 'active', label: null, payment_id: null, expires_at: null, created_at: new Date().toISOString(),
  }];
  redemptions = [];
  device = { id: 'device-abc123', status: 'trial', access_source: 'trial' };
});

describe('access codes — admin generate', () => {
  it('creates the requested number of codes', async () => {
    const res = await request(app()).post('/api/admin/access-codes').send({ seats: 10, quantity: 3, label: 'Batch A' });
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.data[0].code).toMatch(/^GNM-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    expect(res.body.data[0].seats).toBe(10);
  });

  it('rejects a non-positive seat count', async () => {
    const res = await request(app()).post('/api/admin/access-codes').send({ seats: 0 });
    expect(res.status).toBe(400);
  });
});

describe('access codes — redeem', () => {
  it('unlocks the device and consumes one seat', async () => {
    const res = await request(app()).post('/api/access/redeem').send({ deviceId: 'device-abc123', code: 'gnm-abcd-2345' });
    expect(res.status).toBe(200);
    expect(res.body.data.seatsRemaining).toBe(1);
    expect(device!.status).toBe('active');
    expect(device!.access_source).toBe('code');
    expect(codes[0].redeemed_count).toBe(1);
  });

  it('is idempotent for the same device — no extra seat used', async () => {
    await request(app()).post('/api/access/redeem').send({ deviceId: 'device-abc123', code: 'GNM-ABCD-2345' });
    const res = await request(app()).post('/api/access/redeem').send({ deviceId: 'device-abc123', code: 'GNM-ABCD-2345' });
    expect(res.status).toBe(200);
    expect(res.body.data.alreadyRedeemed).toBe(true);
    expect(codes[0].redeemed_count).toBe(1);
  });

  it('refuses once every seat is used', async () => {
    codes[0].redeemed_count = 2; // seats = 2
    const res = await request(app()).post('/api/access/redeem').send({ deviceId: 'device-new-999', code: 'GNM-ABCD-2345' });
    expect(res.status).toBe(409);
    expect(device!.status).toBe('trial');
  });

  it('refuses a revoked code', async () => {
    codes[0].status = 'revoked';
    const res = await request(app()).post('/api/access/redeem').send({ deviceId: 'device-abc123', code: 'GNM-ABCD-2345' });
    expect(res.status).toBe(409);
  });

  it('refuses an expired code', async () => {
    codes[0].expires_at = new Date(Date.now() - 1000).toISOString();
    const res = await request(app()).post('/api/access/redeem').send({ deviceId: 'device-abc123', code: 'GNM-ABCD-2345' });
    expect(res.status).toBe(409);
  });

  it('404s an unknown code', async () => {
    const res = await request(app()).post('/api/access/redeem').send({ deviceId: 'device-abc123', code: 'GNM-ZZZZ-9999' });
    expect(res.status).toBe(404);
  });

  it('400s a code of the wrong length', async () => {
    const res = await request(app()).post('/api/access/redeem').send({ deviceId: 'device-abc123', code: 'GNM-12X' });
    expect(res.status).toBe(400);
  });

  it('refuses a blocked device', async () => {
    device!.status = 'blocked';
    const res = await request(app()).post('/api/access/redeem').send({ deviceId: 'device-abc123', code: 'GNM-ABCD-2345' });
    expect(res.status).toBe(403);
  });
});

describe('access codes — revoke', () => {
  it('revokes an active code', async () => {
    const res = await request(app()).post(`/api/admin/access-codes/${CODE_ID}/revoke`).send({});
    expect(res.status).toBe(200);
    expect(codes[0].status).toBe('revoked');
  });

  it('404s a already-revoked code', async () => {
    codes[0].status = 'revoked';
    const res = await request(app()).post(`/api/admin/access-codes/${CODE_ID}/revoke`).send({});
    expect(res.status).toBe(404);
  });

  it('404s a non-uuid id without hitting the database', async () => {
    const res = await request(app()).post('/api/admin/access-codes/not-a-uuid/revoke').send({});
    expect(res.status).toBe(404);
  });
});

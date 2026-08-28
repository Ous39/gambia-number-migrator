import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Organisation purchases run through the same provider pipeline as the
// individual pass, but a successful payment mints a multi-seat access code
// instead of unlocking the buyer's device.

const hoisted = vi.hoisted(() => ({
  env: {
    nodeEnv: 'test',
    jwtSecret: 'test-secret-value-at-least-32-characters-long',
    paymentTestMode: false,
    paymentProviderIntegrationReady: true,
    waveSuccessUrl: 'https://gnm.oceanbrown.gm/payment/success',
    waveErrorUrl: 'https://gnm.oceanbrown.gm/payment/error',
    waveEnablePayerRestriction: false,
    waveCurrency: 'GMD'
  },
  provider: {
    createCheckout: vi.fn(),
    fetchCheckout: vi.fn(),
    verifyAndParseWebhook: vi.fn(),
    health: () => ({ id: 'wave', configured: true, missing: [], currency: 'GMD', apiKeyTail: '1234', testMode: false, integrationReady: true })
  }
}));
const envMock = hoisted.env;
const providerMock = hoisted.provider;

vi.mock('../src/config/env', () => ({ env: hoisted.env, waveConfigHealth: () => ({ configured: true, missing: [] }) }));
vi.mock('../src/middleware/deviceSecret', () => ({ requireDeviceSecret: (_req: any, _res: any, next: any) => next() }));
vi.mock('../src/middleware/auth', () => ({ requireAdmin: (_req: any, _res: any, next: any) => next() }));
vi.mock('../src/services/auditService', () => ({ audit: vi.fn() }));
vi.mock('../src/services/payments', async () => {
  const actual = await vi.importActual<any>('../src/services/payments/waveProvider');
  class ProviderError extends Error { status = 502; code = 'x'; retryable = false; }
  return {
    getProvider: () => hoisted.provider,
    allProviderHealth: () => ({ wave: hoisted.provider.health(), aps: hoisted.provider.health() }),
    outcomeFromStatuses: actual.outcomeFromStatuses,
    ProviderError
  };
});

type State = {
  config: Record<string, unknown>;
  device: { id: string; status: string };
  payment: any | null;
  codes: Array<{ code: string; seats: number; payment_id: string }>;
  seenEvents: Set<string>;
};
let state: State;

function fakeQuery(text: string, params: any[] = []): Promise<any> {
  const sql = text.replace(/\s+/g, ' ').trim();

  if (/FROM app_config/.test(sql)) {
    return Promise.resolve({ rowCount: 1, rows: Object.entries(state.config).map(([k, v]) => ({ config_key: k, config_value: v })) });
  }
  if (/SELECT status FROM devices WHERE id=/.test(sql)) {
    return Promise.resolve({ rowCount: 1, rows: [{ status: state.device.status }] });
  }
  if (/SELECT \* FROM payments WHERE device_id=\$1 AND idempotency_key/.test(sql)) {
    return Promise.resolve({ rowCount: state.payment ? 1 : 0, rows: state.payment ? [state.payment] : [] });
  }
  if (/INSERT INTO payments/.test(sql)) {
    const metaJson = JSON.parse(params[6] ?? '{}');
    state.payment = {
      id: 'pay-1', provider: params[0], reference: params[1], device_id: params[2] ?? state.device.id,
      feature_key: 'bulk_unlock', amount: params[4] ?? 25, currency: params[5] ?? 'GMD',
      status: /'creating'/.test(sql) ? 'creating' : 'pending',
      checkout_url: null, checkout_status: null, payment_status: null, wave_checkout_session_id: null,
      metadata_json: metaJson, provider_metadata_json: {}, updated_at: new Date().toISOString(), otp_attempts: 0
    };
    return Promise.resolve({ rowCount: 1, rows: [state.payment] });
  }
  if (/INSERT INTO payment_webhook_events/.test(sql)) {
    if (state.seenEvents.has(params[0])) return Promise.resolve({ rowCount: 0, rows: [] });
    state.seenEvents.add(params[0]);
    return Promise.resolve({ rowCount: 1, rows: [{ id: 'evt' }] });
  }
  if (/SELECT reference FROM payments WHERE/.test(sql)) {
    return Promise.resolve({ rowCount: state.payment ? 1 : 0, rows: state.payment ? [{ reference: state.payment.reference }] : [] });
  }
  if (/SELECT code FROM access_codes WHERE payment_id=\$1/.test(sql)) {
    const hit = state.codes.find((c) => c.payment_id === params[0]);
    return Promise.resolve({ rowCount: hit ? 1 : 0, rows: hit ? [{ code: hit.code }] : [] });
  }
  if (/INSERT INTO access_codes .* ON CONFLICT \(code\) DO NOTHING RETURNING code/.test(sql)) {
    const row = { code: params[0], seats: params[1], payment_id: params[3] };
    state.codes.push(row);
    return Promise.resolve({ rowCount: 1, rows: [{ code: row.code }] });
  }
  if (/SELECT \* FROM payments WHERE reference = \$1 FOR UPDATE/.test(sql) || /SELECT \* FROM payments WHERE reference=\$1/.test(sql)) {
    return Promise.resolve({ rowCount: state.payment ? 1 : 0, rows: state.payment ? [state.payment] : [] });
  }
  if (/UPDATE payments SET status = CASE WHEN status = 'success'/.test(sql)) {
    if (state.payment.status !== 'success') state.payment.status = params[1];
    state.payment.checkout_status = params[2] ?? state.payment.checkout_status;
    state.payment.payment_status = params[3] ?? state.payment.payment_status;
    return Promise.resolve({ rowCount: 1, rows: [state.payment] });
  }
  if (/UPDATE payments SET provider_metadata_json/.test(sql)) {
    state.payment.provider_metadata_json = { ...(state.payment.provider_metadata_json || {}), issued_code: params[1] };
    return Promise.resolve({ rowCount: 1, rows: [state.payment] });
  }
  if (/UPDATE payments SET/.test(sql)) {
    if (/wave_checkout_session_id=\$2/.test(sql) && state.payment) {
      state.payment.status = 'pending';
      state.payment.wave_checkout_session_id = params[1];
      state.payment.checkout_url = params[2];
    }
    return Promise.resolve({ rowCount: 1, rows: state.payment ? [state.payment] : [] });
  }
  if (/UPDATE devices SET/.test(sql)) {
    if (state.device.status !== 'blocked' && /'active'/.test(sql)) state.device.status = 'active';
    return Promise.resolve({ rowCount: 1, rows: [] });
  }
  if (/INSERT INTO audit_logs/.test(sql)) return Promise.resolve({ rowCount: 1, rows: [] });
  return Promise.resolve({ rowCount: 0, rows: [] });
}

vi.mock('../src/db/pool', () => ({
  query: (t: string, p: any[]) => fakeQuery(t, p),
  withTransaction: async (work: (c: any) => Promise<any>) => work({ query: (t: string, p: any[]) => fakeQuery(t, p) })
}));

// eslint-disable-next-line import/first
import { paymentsRouter } from '../src/routes/payments';
// eslint-disable-next-line import/first
import { errorHandler } from '../src/middleware/errorHandler';

function makeApp() {
  const app = express();
  app.use(express.json({ verify: (req: any, _res, buf) => { req.rawBody = Buffer.from(buf); } }));
  app.use('/api', paymentsRouter);
  app.use(errorHandler);
  return app;
}

const orgIntent = {
  provider: 'wave', deviceId: 'device-abcdef12', featureKey: 'bulk_unlock',
  amount: 190, currency: 'GMD', idempotencyKey: 'org_1700000000_abcd1234efgh',
  metadata: { kind: 'org', seats: 10, source: 'mobile-org' }
};

beforeEach(() => {
  vi.clearAllMocks();
  envMock.paymentTestMode = false;
  envMock.paymentProviderIntegrationReady = true;
  state = {
    config: {
      subscription_price: 25, currency: 'GMD', wave_payment_enabled: true, aps_payment_enabled: false,
      org_pricing: { tiers: { '5': 100, '10': 190, '15': 270 }, custom_unit: 20, custom_min_seats: 2, custom_max_seats: 500 }
    },
    device: { id: 'device-abcdef12', status: 'trial' },
    payment: null,
    codes: [],
    seenEvents: new Set()
  };
});

describe('org create-intent pricing', () => {
  it('prices a 10-seat tier at the configured tier amount', async () => {
    providerMock.createCheckout.mockResolvedValue({
      providerSessionId: 'cos-1', providerTransactionId: null, checkoutUrl: 'https://pay.wave.com/c/cos-1',
      checkoutStatus: 'open', paymentStatus: 'processing', clientReference: null, amount: '190', currency: 'GMD',
      expiresAt: null, completedAt: null, errorCode: null, errorMessage: null, rawSafe: {}
    });
    const res = await request(makeApp()).post('/api/payments/create-intent').send(orgIntent);
    expect(res.status).toBe(201);
    expect(providerMock.createCheckout).toHaveBeenCalledWith(expect.objectContaining({ amount: 190 }));
  });

  it('rejects an org intent whose amount is the individual price', async () => {
    const res = await request(makeApp()).post('/api/payments/create-intent').send({ ...orgIntent, amount: 25 });
    expect(res.status).toBe(400);
  });

  it('rejects an unavailable seat count', async () => {
    const res = await request(makeApp()).post('/api/payments/create-intent').send({ ...orgIntent, amount: 20, metadata: { kind: 'org', seats: 1 } });
    expect(res.status).toBe(400);
  });

  it('prices a custom seat count at unit x seats', async () => {
    providerMock.createCheckout.mockResolvedValue({
      providerSessionId: 'cos-2', providerTransactionId: null, checkoutUrl: 'https://pay.wave.com/c/cos-2',
      checkoutStatus: 'open', paymentStatus: 'processing', clientReference: null, amount: '60', currency: 'GMD',
      expiresAt: null, completedAt: null, errorCode: null, errorMessage: null, rawSafe: {}
    });
    const res = await request(makeApp()).post('/api/payments/create-intent').send({ ...orgIntent, amount: 60, metadata: { kind: 'org', seats: 3 } });
    expect(res.status).toBe(201);
    expect(providerMock.createCheckout).toHaveBeenCalledWith(expect.objectContaining({ amount: 60 }));
  });

  it('lets a buyer who already has access still purchase seats', async () => {
    state.device.status = 'active';
    providerMock.createCheckout.mockResolvedValue({
      providerSessionId: 'cos-3', providerTransactionId: null, checkoutUrl: 'https://pay.wave.com/c/cos-3',
      checkoutStatus: 'open', paymentStatus: 'processing', clientReference: null, amount: '190', currency: 'GMD',
      expiresAt: null, completedAt: null, errorCode: null, errorMessage: null, rawSafe: {}
    });
    const res = await request(makeApp()).post('/api/payments/create-intent').send(orgIntent);
    expect(res.status).toBe(201);
  });
});

describe('org webhook mints a code', () => {
  const completedEvent = {
    id: 'EV_ORG_1', eventType: 'checkout.session.completed', outcome: 'completed',
    clientReference: 'GNM-ORG-1', providerSessionId: 'cos-1', providerTransactionId: 'T1',
    amount: '190', currency: 'GMD', paymentStatus: 'succeeded', checkoutStatus: 'complete',
    errorCode: null, errorMessage: null, rawSafe: {}
  };

  function seedOrgPending() {
    state.payment = {
      id: 'pay-1', provider: 'wave', reference: 'GNM-ORG-1', device_id: 'device-abcdef12',
      feature_key: 'bulk_unlock', amount: 190, currency: 'GMD', status: 'pending',
      wave_checkout_session_id: 'cos-1', checkout_status: 'open', payment_status: 'processing',
      metadata_json: { kind: 'org', seats: 10 }, provider_metadata_json: {},
      updated_at: new Date().toISOString(), otp_attempts: 0
    };
  }

  it('creates one access code and does not unlock the buyer device', async () => {
    seedOrgPending();
    providerMock.verifyAndParseWebhook.mockReturnValue(completedEvent);
    const res = await request(makeApp()).post('/api/payments/webhook/wave').send(completedEvent);
    expect(res.status).toBe(200);
    expect(state.payment.status).toBe('success');
    expect(state.device.status).toBe('trial'); // NOT unlocked
    expect(state.codes).toHaveLength(1);
    expect(state.codes[0].seats).toBe(10);
    expect(res.body.issuedCode).toBe(state.codes[0].code);
  });

  it('does not mint a second code on a duplicate webhook', async () => {
    seedOrgPending();
    providerMock.verifyAndParseWebhook.mockReturnValue(completedEvent);
    const app = makeApp();
    await request(app).post('/api/payments/webhook/wave').send(completedEvent);
    await request(app).post('/api/payments/webhook/wave').send(completedEvent);
    expect(state.codes).toHaveLength(1);
  });
});

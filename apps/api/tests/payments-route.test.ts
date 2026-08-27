import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Mocks --------------------------------------------------------------------
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

// ---- Fake DB ----------------------------------------------------------------
type State = {
  config: Record<string, unknown>;
  device: { id: string; status: string };
  payment: any | null;
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
    state.payment = {
      id: 'pay-1', provider: params[0], reference: params[1], device_id: params[2] ?? state.device.id,
      feature_key: 'bulk_unlock', amount: params[6] ?? 25, currency: params[5] ?? 'GMD',
      status: /'creating'/.test(sql) ? 'creating' : 'pending', checkout_url: null, checkout_status: null,
      payment_status: null, wave_checkout_session_id: null, updated_at: new Date().toISOString(),
      otp_attempts: 0
    };
    return Promise.resolve({ rowCount: 1, rows: [state.payment] });
  }
  if (/INSERT INTO payment_webhook_events/.test(sql)) {
    const id = params[0];
    if (state.seenEvents.has(id)) return Promise.resolve({ rowCount: 0, rows: [] });
    state.seenEvents.add(id);
    return Promise.resolve({ rowCount: 1, rows: [{ id: 'evt-row' }] });
  }
  if (/SELECT reference FROM payments WHERE/.test(sql) || /SELECT reference FROM payments WHERE id=/.test(sql)) {
    return Promise.resolve({ rowCount: state.payment ? 1 : 0, rows: state.payment ? [{ reference: state.payment.reference }] : [] });
  }
  if (/SELECT \* FROM payments WHERE reference = \$1 FOR UPDATE/.test(sql) || /SELECT \* FROM payments WHERE reference=\$1 AND device_id=\$2/.test(sql) || /SELECT \* FROM payments WHERE reference=\$1$/.test(sql)) {
    return Promise.resolve({ rowCount: state.payment ? 1 : 0, rows: state.payment ? [state.payment] : [] });
  }
  if (/UPDATE payments SET status = CASE WHEN status = 'success'/.test(sql)) {
    // applyOutcome main transition. params: $1 ref, $2 nextStatus, $3 checkout_status, $4 payment_status ...
    if (state.payment.status !== 'success') state.payment.status = params[1];
    state.payment.checkout_status = params[2] ?? state.payment.checkout_status;
    state.payment.payment_status = params[3] ?? state.payment.payment_status;
    return Promise.resolve({ rowCount: 1, rows: [state.payment] });
  }
  if (/UPDATE payments SET/.test(sql)) {
    if (/status='pending'|status = \$2/.test(sql) && state.payment) {
      // create-intent live-branch update on success/failure
      if (/wave_checkout_session_id=\$2/.test(sql)) {
        state.payment.status = 'pending';
        state.payment.wave_checkout_session_id = params[1];
        state.payment.checkout_url = params[2];
      }
    }
    return Promise.resolve({ rowCount: 1, rows: state.payment ? [state.payment] : [] });
  }
  if (/UPDATE devices SET/.test(sql)) {
    if (state.device.status !== 'blocked') state.device.status = /'active'/.test(sql) || /= 'active'/.test(sql) ? 'active' : state.device.status;
    return Promise.resolve({ rowCount: 1, rows: [] });
  }
  if (/INSERT INTO audit_logs/.test(sql)) return Promise.resolve({ rowCount: 1, rows: [] });
  if (/SELECT .* FROM payments ORDER BY created_at/.test(sql)) return Promise.resolve({ rowCount: 0, rows: [] });
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

const baseIntent = {
  provider: 'wave', deviceId: 'device-abcdef12', featureKey: 'bulk_unlock',
  amount: 25, currency: 'GMD', idempotencyKey: 'mobile_1700000000_abcd1234efgh'
};

beforeEach(() => {
  vi.clearAllMocks();
  envMock.paymentTestMode = false;
  envMock.paymentProviderIntegrationReady = true;
  state = {
    config: { subscription_price: 25, currency: 'GMD', wave_payment_enabled: true, aps_payment_enabled: false },
    device: { id: 'device-abcdef12', status: 'trial' },
    payment: null,
    seenEvents: new Set()
  };
});

describe('POST /payments/create-intent', () => {
  it('rejects a disabled provider with 403', async () => {
    state.config.wave_payment_enabled = false;
    const res = await request(makeApp()).post('/api/payments/create-intent').send(baseIntent);
    expect(res.status).toBe(403);
  });

  it('rejects a client-supplied amount that is not the server price', async () => {
    const res = await request(makeApp()).post('/api/payments/create-intent').send({ ...baseIntent, amount: 1 });
    expect(res.status).toBe(400);
  });

  it('creates a Wave checkout and returns the launch url', async () => {
    providerMock.createCheckout.mockResolvedValue({
      providerSessionId: 'cos-1', providerTransactionId: null, checkoutUrl: 'https://pay.wave.com/c/cos-1',
      checkoutStatus: 'open', paymentStatus: 'processing', clientReference: null, amount: '25', currency: 'GMD',
      expiresAt: null, completedAt: null, errorCode: null, errorMessage: null, rawSafe: {}
    });
    const res = await request(makeApp()).post('/api/payments/create-intent').send(baseIntent);
    expect(res.status).toBe(201);
    expect(res.body.data.checkoutUrl).toBe('https://pay.wave.com/c/cos-1');
    expect(providerMock.createCheckout).toHaveBeenCalledOnce();
  });

  it('test mode issues a local OTP and never calls the provider', async () => {
    envMock.paymentTestMode = true;
    const res = await request(makeApp()).post('/api/payments/create-intent').send(baseIntent);
    expect(res.status).toBe(201);
    expect(res.body.data.testOtp).toMatch(/^\d{4}$/);
    expect(providerMock.createCheckout).not.toHaveBeenCalled();
  });
});

describe('POST /payments/webhook/wave', () => {
  function seedPending() {
    state.payment = {
      id: 'pay-1', provider: 'wave', reference: 'GNM-1-AAAA', device_id: 'device-abcdef12',
      feature_key: 'bulk_unlock', amount: 25, currency: 'GMD', status: 'pending',
      wave_checkout_session_id: 'cos-1', checkout_status: 'open', payment_status: 'processing',
      updated_at: new Date().toISOString(), otp_attempts: 0
    };
  }
  const completedEvent = {
    id: 'EV_1', eventType: 'checkout.session.completed', outcome: 'completed',
    clientReference: 'GNM-1-AAAA', providerSessionId: 'cos-1', providerTransactionId: 'T1',
    amount: '25', currency: 'GMD', paymentStatus: 'succeeded', checkoutStatus: 'complete',
    errorCode: null, errorMessage: null, rawSafe: {}
  };

  it('rejects an invalid signature with 401', async () => {
    providerMock.verifyAndParseWebhook.mockReturnValue(null);
    const res = await request(makeApp()).post('/api/payments/webhook/wave').send({ any: 'thing' });
    expect(res.status).toBe(401);
  });

  it('marks the payment success and unlocks the device on a completed event', async () => {
    seedPending();
    providerMock.verifyAndParseWebhook.mockReturnValue(completedEvent);
    const res = await request(makeApp()).post('/api/payments/webhook/wave').send(completedEvent);
    expect(res.status).toBe(200);
    expect(state.payment.status).toBe('success');
    expect(state.device.status).toBe('active');
  });

  it('is idempotent for a duplicate event id', async () => {
    seedPending();
    providerMock.verifyAndParseWebhook.mockReturnValue(completedEvent);
    const app = makeApp();
    await request(app).post('/api/payments/webhook/wave').send(completedEvent);
    const res2 = await request(app).post('/api/payments/webhook/wave').send(completedEvent);
    expect(res2.status).toBe(200);
    expect(res2.body.duplicate).toBe(true);
  });

  it('rejects a well-signed event with the wrong amount (422)', async () => {
    seedPending();
    providerMock.verifyAndParseWebhook.mockReturnValue({ ...completedEvent, id: 'EV_2', amount: '2500' });
    const res = await request(makeApp()).post('/api/payments/webhook/wave').send({});
    expect(res.status).toBe(422);
    expect(state.payment.status).toBe('pending');
  });

  it('never downgrades an already-successful payment', async () => {
    seedPending();
    state.payment.status = 'success';
    providerMock.verifyAndParseWebhook.mockReturnValue({
      ...completedEvent, id: 'EV_3', outcome: 'failed', paymentStatus: 'failed', checkoutStatus: 'failed'
    });
    const res = await request(makeApp()).post('/api/payments/webhook/wave').send({});
    expect(res.status).toBe(200);
    expect(state.payment.status).toBe('success');
  });
});

describe('POST /admin/payments/:id/confirm-manual', () => {
  it('is blocked when the live integration is armed', async () => {
    envMock.paymentTestMode = true;
    envMock.paymentProviderIntegrationReady = true;
    const res = await request(makeApp()).post('/api/admin/payments/pay-1/confirm-manual').send({});
    expect(res.status).toBe(403);
  });

  it('is blocked entirely outside test mode', async () => {
    envMock.paymentTestMode = false;
    const res = await request(makeApp()).post('/api/admin/payments/pay-1/confirm-manual').send({});
    expect(res.status).toBe(403);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  env: {
    paymentProviderIntegrationReady: true,
    paymentTestMode: false,
    waveApiBaseUrl: 'https://api.wave.com',
    waveApiKey: 'fake-wave-key-000',
    waveApiSigningSecret: 'sig_secret_abcdefghijkl',
    waveWebhookSecret: 'whsec_abcdefghijkl',
    waveWebhookSecretPrevious: undefined,
    waveCurrency: 'GMD',
    waveSuccessUrl: 'https://gnm.oceanbrown.gm/payment/success',
    waveErrorUrl: 'https://gnm.oceanbrown.gm/payment/error',
    waveRequestTimeoutMs: 10000,
    waveEnablePayerRestriction: false,
    webhookToleranceSeconds: 300
  },
  request: vi.fn()
}));

vi.mock('../src/config/env', () => ({
  env: hoisted.env,
  waveConfigHealth: () => ({
    configured: true, missing: [], integrationReady: true, testMode: false,
    currency: 'GMD', apiKeyTail: 'ijkl', webhookSecretRotationArmed: false
  })
}));
vi.mock('../src/services/payments/httpRetry', () => ({ requestWithRetry: hoisted.request }));

// eslint-disable-next-line import/first
import { waveProvider } from '../src/services/payments/waveProvider';

const okSession = {
  status: 200, ok: true, headers: new Headers(),
  text: JSON.stringify({
    id: 'cos-123', wave_launch_url: 'https://pay.wave.com/c/cos-123',
    checkout_status: 'open', payment_status: 'processing',
    amount: '25', currency: 'GMD', client_reference: 'GNM-1'
  })
};

const baseInput = {
  reference: 'GNM-1', amount: 25, amountString: '25', currency: 'GMD',
  successUrl: 'https://gnm.oceanbrown.gm/payment/success',
  errorUrl: 'https://gnm.oceanbrown.gm/payment/error'
};

beforeEach(() => vi.clearAllMocks());

describe('waveProvider.createCheckout', () => {
  it('creates a session and returns the launch url', async () => {
    hoisted.request.mockResolvedValue(okSession);
    const result = await waveProvider.createCheckout(baseInput);
    expect(result.providerSessionId).toBe('cos-123');
    expect(result.checkoutUrl).toBe('https://pay.wave.com/c/cos-123');
    // Signed POST: exact body string is sent and Wave-Signature is attached.
    const call = hoisted.request.mock.calls[0][0];
    expect(call.method).toBe('POST');
    expect(call.body).toBe(JSON.stringify({
      amount: '25', currency: 'GMD',
      success_url: baseInput.successUrl, error_url: baseInput.errorUrl,
      client_reference: 'GNM-1'
    }));
    expect(call.headers['Wave-Signature']).toMatch(/^t=\d+,v1=[a-f0-9]{64}$/);
    expect(call.headers.Authorization).toBe('Bearer fake-wave-key-000');
  });

  it('rejects a non-integer amount before calling Wave', async () => {
    await expect(waveProvider.createCheckout({ ...baseInput, amount: 25.5, amountString: '25.5' }))
      .rejects.toMatchObject({ code: 'wave_amount_not_integer', status: 422 });
    expect(hoisted.request).not.toHaveBeenCalled();
  });

  it('rejects a currency other than the Wave-confirmed one', async () => {
    await expect(waveProvider.createCheckout({ ...baseInput, currency: 'XOF' }))
      .rejects.toMatchObject({ code: 'wave_currency_mismatch' });
    expect(hoisted.request).not.toHaveBeenCalled();
  });

  it('maps 401 to wave_unauthorized (onboarding not complete)', async () => {
    hoisted.request.mockResolvedValue({ status: 401, ok: false, headers: new Headers(), text: '{"code":"unauthorized"}' });
    await expect(waveProvider.createCheckout(baseInput))
      .rejects.toMatchObject({ code: 'wave_unauthorized', status: 502 });
  });

  it('maps 403 to wave_unauthorized', async () => {
    hoisted.request.mockResolvedValue({ status: 403, ok: false, headers: new Headers(), text: '{}' });
    await expect(waveProvider.createCheckout(baseInput))
      .rejects.toMatchObject({ code: 'wave_unauthorized' });
  });

  it('marks a 500 as retryable', async () => {
    hoisted.request.mockResolvedValue({ status: 500, ok: false, headers: new Headers(), text: '{}' });
    await expect(waveProvider.createCheckout(baseInput))
      .rejects.toMatchObject({ retryable: true, status: 502 });
  });
});

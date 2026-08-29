import { env, waveConfigHealth } from '../../config/env';
import { requestWithRetry } from './httpRetry';
import { computeWaveSignature, verifyWaveWebhook } from './signature';
import {
  CheckoutResult,
  CreateCheckoutInput,
  NormalizedOutcome,
  NormalizedWebhookEvent,
  PaymentProvider,
  ProviderError,
  ProviderHealth
} from './types';

const CHECKOUT_PATH = '/v1/checkout/sessions';

// Keys we are willing to persist/log from a Wave payload. Wave's checkout object
// carries no secrets, but we still allowlist rather than store the raw blob.
const SAFE_KEYS = new Set([
  'id', 'amount', 'currency', 'checkout_status', 'payment_status', 'transaction_id',
  'client_reference', 'aggregated_merchant_id', 'when_created', 'when_expires',
  'when_completed', 'last_payment_error', 'business_name'
]);

function sanitize(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload || {})) {
    if (!SAFE_KEYS.has(key)) continue;
    out[key] = value;
  }
  return out;
}

export function outcomeFromStatuses(checkoutStatus: string | null, paymentStatus: string | null): NormalizedOutcome {
  const c = (checkoutStatus || '').toLowerCase();
  const p = (paymentStatus || '').toLowerCase();
  if (p === 'succeeded' && c === 'complete') return 'completed';
  if (p === 'cancelled' || p === 'failed') return 'failed';
  if (c === 'expired') return 'expired';
  if (c === 'complete' || c === 'open' || p === 'processing') return 'pending';
  return 'ignored';
}

function toCheckoutResult(raw: Record<string, unknown>): CheckoutResult {
  const error = (raw.last_payment_error || null) as Record<string, unknown> | null;
  return {
    providerSessionId: String(raw.id ?? ''),
    providerTransactionId: raw.transaction_id ? String(raw.transaction_id) : null,
    checkoutUrl: String((raw as any).wave_launch_url ?? ''),
    checkoutStatus: String(raw.checkout_status ?? ''),
    paymentStatus: String(raw.payment_status ?? ''),
    clientReference: raw.client_reference ? String(raw.client_reference) : null,
    amount: raw.amount != null ? String(raw.amount) : null,
    currency: raw.currency ? String(raw.currency) : null,
    expiresAt: raw.when_expires ? String(raw.when_expires) : null,
    completedAt: raw.when_completed ? String(raw.when_completed) : null,
    errorCode: error?.code ? String(error.code) : null,
    errorMessage: error?.message ? String(error.message) : null,
    rawSafe: sanitize(raw)
  };
}

function baseHeaders(bodyString: string, method: 'GET' | 'POST'): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${env.waveApiKey}`,
    Accept: 'application/json'
  };
  if (method === 'POST') headers['Content-Type'] = 'application/json';
  // Request signing: only when a signing secret is configured (it is required
  // by our production health gate). Sign `${t}${exact body string}`.
  if (env.waveApiSigningSecret) {
    const t = Math.floor(Date.now() / 1000);
    headers['Wave-Signature'] = `t=${t},v1=${computeWaveSignature(env.waveApiSigningSecret, t, bodyString)}`;
  }
  return headers;
}

function ensureLive() {
  if (!env.paymentProviderIntegrationReady) {
    throw new ProviderError('Wave integration is not enabled on this server', { status: 503, code: 'wave_not_ready' });
  }
  const health = waveConfigHealth();
  if (!health.configured) {
    throw new ProviderError(`Wave configuration is incomplete: ${health.missing.join(', ')}`, { status: 503, code: 'wave_not_configured' });
  }
}

function parseJson(text: string): Record<string, unknown> {
  try {
    const value = JSON.parse(text);
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export const waveProvider: PaymentProvider = {
  id: 'wave',
  enabledConfigKey: 'wave_payment_enabled',

  health(): ProviderHealth {
    const h = waveConfigHealth();
    return {
      id: 'wave',
      enabledConfigKey: 'wave_payment_enabled',
      configured: h.configured,
      missing: h.missing,
      currency: h.currency,
      apiKeyTail: h.apiKeyTail,
      testMode: h.testMode,
      integrationReady: h.integrationReady
    };
  },

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    ensureLive();
    if (input.currency !== env.waveCurrency) {
      throw new ProviderError(`Currency ${input.currency} is not the Wave-confirmed currency`, { status: 409, code: 'wave_currency_mismatch' });
    }
    // Wave rejects decimal amounts for XOF and (per onboarding) GMD is expected
    // to behave the same. Fail loudly here rather than let Wave 400 opaquely.
    if (!Number.isInteger(input.amount) || !/^\d+$/.test(input.amountString)) {
      throw new ProviderError(
        `Wave amount must be a whole number of ${input.currency} (got ${input.amountString})`,
        { status: 422, code: 'wave_amount_not_integer' }
      );
    }
    // Build the body once and sign/send the EXACT same string.
    const payload: Record<string, unknown> = {
      amount: input.amountString,
      currency: input.currency,
      success_url: input.successUrl,
      error_url: input.errorUrl,
      client_reference: input.reference
    };
    if (env.waveEnablePayerRestriction && input.restrictPayerMobile) {
      payload.restrict_payer_mobile = input.restrictPayerMobile;
    }
    const bodyString = JSON.stringify(payload);

    const res = await requestWithRetry({
      method: 'POST',
      url: `${env.waveApiBaseUrl}${CHECKOUT_PATH}`,
      headers: baseHeaders(bodyString, 'POST'),
      body: bodyString,
      timeoutMs: env.waveRequestTimeoutMs
    });

    const parsed = parseJson(res.text);
    if (!res.ok) {
      // 401/403 = the Wave account is not authorised for the Checkout API yet.
      // Surface a distinct code so admin health + logs point at onboarding.
      if (res.status === 401 || res.status === 403) {
        throw new ProviderError(
          'Wave rejected the request: this business account is not authorised for the Checkout API. Contact your Wave partner representative.',
          { status: 502, code: 'wave_unauthorized' }
        );
      }
      const code = String((parsed as any)?.code || `wave_http_${res.status}`);
      throw new ProviderError(`Wave checkout creation failed (${res.status})`, {
        status: res.status === 429 || res.status >= 500 ? 502 : 400,
        code,
        retryable: res.status === 429 || res.status >= 500
      });
    }
    const result = toCheckoutResult(parsed);
    if (!result.providerSessionId || !result.checkoutUrl) {
      throw new ProviderError('Wave returned an incomplete checkout session', { status: 502, code: 'wave_bad_response' });
    }
    return result;
  },

  async fetchCheckout(providerSessionId: string): Promise<CheckoutResult> {
    ensureLive();
    if (!providerSessionId) throw new ProviderError('Missing Wave checkout session id', { status: 400, code: 'wave_bad_request' });
    const res = await requestWithRetry({
      method: 'GET',
      url: `${env.waveApiBaseUrl}${CHECKOUT_PATH}/${encodeURIComponent(providerSessionId)}`,
      headers: baseHeaders('', 'GET'),
      timeoutMs: env.waveRequestTimeoutMs
    });
    const parsed = parseJson(res.text);
    if (!res.ok) {
      throw new ProviderError(`Wave checkout lookup failed (${res.status})`, {
        status: res.status >= 500 || res.status === 429 ? 502 : 404,
        code: String((parsed as any)?.code || `wave_http_${res.status}`),
        retryable: res.status === 429 || res.status >= 500
      });
    }
    return toCheckoutResult(parsed);
  },

  verifyAndParseWebhook(rawBody, headers): NormalizedWebhookEvent | null {
    const header = headers['wave-signature'] || headers['Wave-Signature'];
    const verdict = verifyWaveWebhook(rawBody, header, {
      secrets: [env.waveWebhookSecret, env.waveWebhookSecretPrevious],
      maxAgeSeconds: Math.min(env.webhookToleranceSeconds, 300),
      maxSkewSeconds: 30
    });
    if (!verdict.ok) return null;

    const event = parseJson((rawBody as Buffer).toString('utf8'));
    const data = (event.data || {}) as Record<string, unknown>;
    const eventType = String(event.type || '');
    const checkoutStatus = data.checkout_status ? String(data.checkout_status) : null;
    const paymentStatus = data.payment_status ? String(data.payment_status) : null;
    const error = (data.last_payment_error || null) as Record<string, unknown> | null;

    let outcome: NormalizedOutcome;
    if (eventType === 'checkout.session.completed') outcome = 'completed';
    else if (eventType === 'checkout.session.payment_failed') outcome = 'failed';
    else outcome = outcomeFromStatuses(checkoutStatus, paymentStatus) === 'ignored' ? 'ignored' : outcomeFromStatuses(checkoutStatus, paymentStatus);

    return {
      id: String(event.id || ''),
      eventType,
      outcome,
      clientReference: data.client_reference ? String(data.client_reference) : null,
      providerSessionId: data.id ? String(data.id) : null,
      providerTransactionId: data.transaction_id ? String(data.transaction_id) : null,
      amount: data.amount != null ? String(data.amount) : null,
      currency: data.currency ? String(data.currency) : null,
      paymentStatus,
      checkoutStatus,
      errorCode: error?.code ? String(error.code) : null,
      errorMessage: error?.message ? String(error.message) : null,
      rawSafe: sanitize({ id: event.id, type: event.type, ...data })
    };
  }
};

import crypto from 'node:crypto';
import { env } from '../../config/env';
import {
  CheckoutResult,
  CreateCheckoutInput,
  NormalizedWebhookEvent,
  PaymentProvider,
  ProviderError,
  ProviderHealth
} from './types';

// APS is a SEPARATE provider. Its production API is not integrated yet, and its
// webhook signature/event shape is expected to differ from Wave. This module
// deliberately keeps APS's interim scheme isolated so nothing Wave-specific
// leaks in (and vice versa). Do not port Wave's `Wave-Signature` handling here.

const APS_INTERIM_ALLOWED_STATUS = new Set(['pending', 'success', 'failed', 'cancelled', 'expired', 'under_review']);

function secureEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

export const apsProvider: PaymentProvider = {
  id: 'aps',
  enabledConfigKey: 'aps_payment_enabled',

  health(): ProviderHealth {
    const missing: string[] = [];
    if (!env.apsWebhookSecret) missing.push('APS_WEBHOOK_SECRET');
    return {
      id: 'aps',
      enabledConfigKey: 'aps_payment_enabled',
      configured: missing.length === 0,
      missing,
      currency: null,
      apiKeyTail: null,
      testMode: env.paymentTestMode,
      integrationReady: env.paymentProviderIntegrationReady
    };
  },

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    // No hosted-checkout API is wired for APS. Preserve the historical behaviour:
    // a pending payment record with no redirect URL; the customer follows APS's
    // own instructions and the interim webhook reconciles the result.
    if (!env.paymentProviderIntegrationReady) {
      throw new ProviderError('APS integration is not enabled on this server', { status: 503, code: 'aps_not_ready' });
    }
    return {
      providerSessionId: `aps_${input.reference}`,
      providerTransactionId: null,
      checkoutUrl: '',
      checkoutStatus: 'open',
      paymentStatus: 'processing',
      clientReference: input.reference,
      amount: input.amountString,
      currency: input.currency,
      expiresAt: null,
      completedAt: null,
      errorCode: null,
      errorMessage: null,
      rawSafe: { provider: 'aps', mode: 'manual_instructions' }
    };
  },

  async fetchCheckout(): Promise<CheckoutResult> {
    throw new ProviderError('APS reconciliation is not available', { status: 501, code: 'aps_reconcile_unsupported' });
  },

  verifyAndParseWebhook(rawBody, headers): NormalizedWebhookEvent | null {
    const secret = env.apsWebhookSecret;
    const timestamp = String(headers['x-webhook-timestamp'] || '');
    const eventId = String(headers['x-webhook-id'] || '');
    const supplied = String(headers['x-webhook-signature'] || '').replace(/^sha256=/, '');
    const timestampMs = Number(timestamp) * 1000;
    if (!secret || !eventId || !supplied || !Number.isFinite(timestampMs)) return null;
    if (Math.abs(Date.now() - timestampMs) > env.webhookToleranceSeconds * 1000) return null;

    const raw = rawBody && rawBody.length ? rawBody.toString('utf8') : '';
    if (!raw) return null;
    const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${raw}`).digest('hex');
    if (!secureEqual(supplied, expected)) return null;

    let body: Record<string, unknown> = {};
    try { body = JSON.parse(raw) as Record<string, unknown>; } catch { return null; }
    const status = String(body.status || '');
    if (!APS_INTERIM_ALLOWED_STATUS.has(status)) return null;

    const outcome = status === 'success' ? 'completed'
      : status === 'failed' || status === 'cancelled' ? 'failed'
      : status === 'expired' ? 'expired'
      : status === 'pending' || status === 'under_review' ? 'pending'
      : 'ignored';

    return {
      id: eventId,
      eventType: `aps.${status}`,
      outcome,
      clientReference: body.reference ? String(body.reference) : null,
      providerSessionId: null,
      providerTransactionId: body.externalReference ? String(body.externalReference) : null,
      amount: body.amount != null ? String(body.amount) : null,
      currency: body.currency ? String(body.currency) : null,
      paymentStatus: status,
      checkoutStatus: status === 'success' ? 'complete' : status,
      errorCode: null,
      errorMessage: null,
      rawSafe: { reference: body.reference ?? null, status }
    };
  }
};

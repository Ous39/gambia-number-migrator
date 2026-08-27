// Provider-agnostic payment contracts. Wave and APS each implement this behind
// `getProvider()` so the route layer never contains provider-specific wire
// formats. Wave = Checkout API only (never Payout).

export type ProviderId = 'wave' | 'aps';

export interface CreateCheckoutInput {
  /** GNM-internal payment reference; sent to the provider as client_reference. */
  reference: string;
  /** Numeric major-unit amount (e.g. 25) used for our own validation. */
  amount: number;
  /** Exact string amount sent on the wire (Wave requires a string). */
  amountString: string;
  /** ISO-4217, upper case. Must equal the provider-confirmed currency. */
  currency: string;
  successUrl: string;
  errorUrl: string;
  /** E.164 (+220…) — only forwarded when the operator has enabled payer restriction. */
  restrictPayerMobile?: string;
}

export interface CheckoutResult {
  providerSessionId: string;
  providerTransactionId: string | null;
  checkoutUrl: string;
  /** Provider-native checkout lifecycle: open | complete | expired (Wave). */
  checkoutStatus: string;
  /** Provider-native payment lifecycle: processing | cancelled | succeeded (Wave). */
  paymentStatus: string;
  clientReference: string | null;
  amount: string | null;
  currency: string | null;
  expiresAt: string | null;
  completedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  /** Provider payload with secrets/PII removed — safe to persist and log. */
  rawSafe: Record<string, unknown>;
}

export type NormalizedOutcome = 'completed' | 'failed' | 'pending' | 'expired' | 'ignored';

export interface NormalizedWebhookEvent {
  /** Provider event id — the idempotency key for webhook processing. */
  id: string;
  eventType: string;
  outcome: NormalizedOutcome;
  clientReference: string | null;
  providerSessionId: string | null;
  providerTransactionId: string | null;
  amount: string | null;
  currency: string | null;
  paymentStatus: string | null;
  checkoutStatus: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  rawSafe: Record<string, unknown>;
}

export interface ProviderHealth {
  id: ProviderId;
  enabledConfigKey: string;
  configured: boolean;
  missing: string[];
  currency: string | null;
  apiKeyTail: string | null;
  testMode: boolean;
  integrationReady: boolean;
}

export class ProviderError extends Error {
  /** HTTP status to surface to the caller. */
  status: number;
  /** Stable machine code, e.g. 'wave_timeout', 'wave_unavailable'. */
  code: string;
  /** True when the failure is transient and the caller may retry later. */
  retryable: boolean;
  constructor(message: string, opts: { status?: number; code?: string; retryable?: boolean } = {}) {
    super(message);
    this.name = 'ProviderError';
    this.status = opts.status ?? 502;
    this.code = opts.code ?? 'provider_error';
    this.retryable = opts.retryable ?? false;
  }
}

export interface PaymentProvider {
  readonly id: ProviderId;
  /** Config key in app_config that the admin toggles. */
  readonly enabledConfigKey: string;
  /** Configuration completeness — never throws, never leaks secrets. */
  health(): ProviderHealth;
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult>;
  fetchCheckout(providerSessionId: string): Promise<CheckoutResult>;
  /**
   * Verify the raw request against the provider signature scheme and return a
   * normalized event, or null when the signature/timestamp is invalid.
   */
  verifyAndParseWebhook(
    rawBody: Buffer | undefined,
    headers: Record<string, string | undefined>
  ): NormalizedWebhookEvent | null;
}

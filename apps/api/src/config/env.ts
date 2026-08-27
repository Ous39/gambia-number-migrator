import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config();

const PLACEHOLDER = /replace-with|change-me|dev-only|your-|xxxx|example|<paste/i;

function firstDefined(...values: Array<string | undefined>) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim();
  }
  return '';
}

const waveWebhookTolerance = Number(
  firstDefined(process.env.WAVE_WEBHOOK_TOLERANCE_SECONDS, process.env.PAYMENT_WEBHOOK_TOLERANCE_SECONDS) || 300
);

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || process.env.API_PORT || 8089),
  databaseUrl: process.env.DATABASE_URL || 'postgres://gnm_user:gnm_password@localhost:5434/gambia_number_migrator',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-change-me',
  paymentTestMode: process.env.PAYMENT_TEST_MODE === 'true',
  paymentProviderIntegrationReady: process.env.PAYMENT_PROVIDER_INTEGRATION_READY === 'true',

  // Wave Checkout — server-only credentials. These must never appear in the mobile
  // bundle, Expo config, CI logs, tests or documentation.
  waveApiBaseUrl: (firstDefined(process.env.WAVE_API_BASE_URL) || 'https://api.wave.com').replace(/\/$/, ''),
  waveApiKey: firstDefined(process.env.WAVE_API_KEY),
  waveApiSigningSecret: firstDefined(process.env.WAVE_API_SIGNING_SECRET),
  waveWebhookSecret: firstDefined(process.env.WAVE_WEBHOOK_SECRET),
  waveWebhookSecretPrevious: firstDefined(process.env.WAVE_WEBHOOK_SECRET_PREVIOUS),
  waveCurrency: firstDefined(process.env.WAVE_CURRENCY).toUpperCase(),
  waveSuccessUrl: firstDefined(process.env.WAVE_SUCCESS_URL, 'https://gnm.oceanbrown.gm/payment/success'),
  waveErrorUrl: firstDefined(process.env.WAVE_ERROR_URL, 'https://gnm.oceanbrown.gm/payment/error'),
  waveRequestTimeoutMs: Number(firstDefined(process.env.WAVE_REQUEST_TIMEOUT_MS) || 10000),
  waveEnablePayerRestriction: process.env.WAVE_ENABLE_PAYER_RESTRICTION === 'true',

  // APS keeps its own, separate interim scheme. Do not reuse Wave values here.
  apsWebhookSecret: firstDefined(process.env.APS_WEBHOOK_SECRET),

  webhookToleranceSeconds: Number.isFinite(waveWebhookTolerance) ? waveWebhookTolerance : 300,
  // Optional: the public HTTPS origin of this API. Only used to sanity-check the
  // Wave enable-guard; unset means "skip that check" so it can't break boot.
  publicApiBaseUrl: firstDefined(process.env.PUBLIC_API_BASE_URL),
  expoAccessToken: process.env.EXPO_ACCESS_TOKEN || '',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  adminBaseUrl: process.env.ADMIN_BASE_URL || 'http://localhost:5173'
};

function isHttps(value: string) {
  return /^https:\/\//i.test(value);
}

/**
 * Wave configuration health. Used by production boot validation, the admin
 * `/admin/payments/health` endpoint and the `wave_payment_enabled` guard.
 * Never returns secret values — only which keys are present or missing.
 */
export function waveConfigHealth() {
  const missing: string[] = [];
  if (!env.waveApiKey || PLACEHOLDER.test(env.waveApiKey)) missing.push('WAVE_API_KEY');
  if (!env.waveApiSigningSecret || PLACEHOLDER.test(env.waveApiSigningSecret)) missing.push('WAVE_API_SIGNING_SECRET');
  if (!env.waveWebhookSecret || PLACEHOLDER.test(env.waveWebhookSecret)) missing.push('WAVE_WEBHOOK_SECRET');
  if (!env.waveCurrency) missing.push('WAVE_CURRENCY');
  if (!isHttps(env.waveApiBaseUrl)) missing.push('WAVE_API_BASE_URL(must be https)');
  if (!isHttps(env.waveSuccessUrl)) missing.push('WAVE_SUCCESS_URL(must be https)');
  if (!isHttps(env.waveErrorUrl)) missing.push('WAVE_ERROR_URL(must be https)');
  if (!Number.isFinite(env.waveRequestTimeoutMs) || env.waveRequestTimeoutMs < 1000 || env.waveRequestTimeoutMs > 60000) {
    missing.push('WAVE_REQUEST_TIMEOUT_MS(1000-60000)');
  }
  return {
    configured: missing.length === 0,
    missing,
    integrationReady: env.paymentProviderIntegrationReady,
    testMode: env.paymentTestMode,
    currency: env.waveCurrency || null,
    // Last four safe characters of the key identifier — never the key itself.
    apiKeyTail: env.waveApiKey ? env.waveApiKey.slice(-4) : null,
    webhookSecretRotationArmed: Boolean(env.waveWebhookSecretPrevious)
  };
}

if (env.nodeEnv === 'production') {
  const problems: string[] = [];
  if (!process.env.DATABASE_URL) problems.push('DATABASE_URL is required');
  if (!process.env.JWT_SECRET || env.jwtSecret.length < 32 || /replace-with|change-me|dev-only/i.test(env.jwtSecret)) problems.push('JWT_SECRET must be a random non-placeholder value of at least 32 characters');
  if (env.paymentTestMode) problems.push('PAYMENT_TEST_MODE must be false');
  if (!Number.isFinite(env.webhookToleranceSeconds) || env.webhookToleranceSeconds < 60 || env.webhookToleranceSeconds > 900) problems.push('WAVE_WEBHOOK_TOLERANCE_SECONDS must be between 60 and 900');
  if (/localhost|127\.0\.0\.1/.test(env.corsOrigin)) problems.push('CORS_ORIGIN must contain the production admin origin');
  if (env.publicApiBaseUrl && !isHttps(env.publicApiBaseUrl)) problems.push('PUBLIC_API_BASE_URL / VITE_API_BASE_URL must be https in production');

  // Wave being DISABLED must never block boot. Only when the operator asserts the
  // integration is ready do we require a complete, well-formed Wave configuration.
  if (env.paymentProviderIntegrationReady) {
    const health = waveConfigHealth();
    if (!health.configured) problems.push(`PAYMENT_PROVIDER_INTEGRATION_READY=true but Wave configuration is incomplete: ${health.missing.join(', ')}`);
  } else {
    // Even when not "ready", reject values that are present but obviously wrong so
    // a typo can't silently ship.
    if (env.waveApiBaseUrl && !isHttps(env.waveApiBaseUrl)) problems.push('WAVE_API_BASE_URL must be https');
    if (process.env.WAVE_SUCCESS_URL && !isHttps(env.waveSuccessUrl)) problems.push('WAVE_SUCCESS_URL must be https');
    if (process.env.WAVE_ERROR_URL && !isHttps(env.waveErrorUrl)) problems.push('WAVE_ERROR_URL must be https');
  }

  if (problems.length) throw new Error(`Invalid production configuration: ${problems.join('; ')}`);
}

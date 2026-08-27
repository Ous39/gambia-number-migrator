import { DEFAULT_RULES_PAYLOAD, DEFAULT_TRANSITION_SETTINGS } from '@gnm/shared';

// paymentTestMode here describes an offline fallback only; live payment gating uses env.paymentTestMode and env.paymentProviderIntegrationReady.
export const FALLBACK_APP_CONFIG = {
  appName: 'GNM',
  paymentTestMode: true,
  allowedPaymentProviders: [],
  wave_payment_enabled: false,
  aps_payment_enabled: false,
  defaultPaymentAmount: 25,
  subscription_price: 25,
  free_access_mode: 'off',
  free_access_user_limit: 100,
  cleanup_enabled: false,
  cleanup_available_from: '',
  cleanup_available_until: '',
  currency: 'GMD',
  contactUploadAllowed: false,
  privacyMode: 'local_contacts_only',
  fallbackMode: true,
};

export function isDbUnavailable(error: any) {
  const code = String(error?.code || error?.cause?.code || '');
  const message = String(error?.message || '');
  return code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ETIMEDOUT' || message.includes('ECONNREFUSED') || message.includes('Connection terminated') || message.includes('connect ECONNREFUSED');
}

export function withApiFallback<T>(data: T, warning: string) {
  return {
    data,
    meta: {
      fallback: true,
      warning,
      timestamp: new Date().toISOString(),
    },
  };
}

export { DEFAULT_RULES_PAYLOAD, DEFAULT_TRANSITION_SETTINGS };

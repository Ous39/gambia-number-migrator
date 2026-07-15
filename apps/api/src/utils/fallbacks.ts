import { DEFAULT_RULES_PAYLOAD, DEFAULT_TRANSITION_SETTINGS } from '@gnm/shared';

export const FALLBACK_APP_CONFIG = {
  appName: 'Gambia Number Migrator',
  paymentTestMode: true,
  allowedPaymentProviders: ['wave', 'aps'],
  defaultPaymentAmount: 100,
  subscription_price: 100,
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

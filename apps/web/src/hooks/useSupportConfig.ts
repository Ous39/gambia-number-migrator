import { useEffect, useState } from 'react';
import { getAppConfig } from '../api/client';

export type SupportConfig = {
  supportEmail: string;
  supportPhone: string;
  supportWhatsApp: string;
  privacyUrl: string;
  termsUrl: string;
  validEmail: boolean;
  validPhone: boolean;
  validWhatsApp: boolean;
};

const DEFAULT_EMAIL = 'support@oceanbrown.gm';

// Reads the same live app_config the mobile app's Settings screen reads, so an
// administrator only ever updates the official support contact in one place.
export function useSupportConfig(): SupportConfig {
  const [config, setConfig] = useState<Record<string, unknown>>({});

  useEffect(() => {
    let active = true;
    getAppConfig().then((data) => { if (active) setConfig(data); }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const supportEmail = String(config.support_email || DEFAULT_EMAIL);
  const supportPhone = String(config.support_phone || '');
  const supportWhatsApp = String(config.support_whatsapp || '');
  const privacyUrl = String(config.privacy_policy_url || '');
  const termsUrl = String(config.terms_url || '');

  return {
    supportEmail,
    supportPhone,
    supportWhatsApp,
    privacyUrl,
    termsUrl,
    validEmail: supportEmail.includes('@') && !supportEmail.endsWith('@example.com'),
    validPhone: supportPhone.replace(/\D/g, '').length >= 7 && !/^2200+$/.test(supportPhone.replace(/\D/g, '')),
    validWhatsApp: supportWhatsApp.replace(/\D/g, '').length >= 7 && !/^2200+$/.test(supportWhatsApp.replace(/\D/g, '')),
  };
}

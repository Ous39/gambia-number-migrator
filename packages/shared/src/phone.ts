import type { PhoneNormalizationResult } from './types';

export function digitsOnly(raw: string): string {
  return String(raw || '').replace(/\D/g, '');
}

export function normalizeGambianPhone(raw: string): PhoneNormalizationResult {
  const digits = digitsOnly(raw);
  const comparableDigits = digits.startsWith('00220') ? digits.slice(2) : digits;
  let localDigits = comparableDigits;
  let countryCodeStripped = false;

  if (comparableDigits.startsWith('220') && (comparableDigits.length === 10 || comparableDigits.length === 12)) {
    localDigits = comparableDigits.slice(3);
    countryCodeStripped = true;
  }

  if (localDigits.length === 7) {
    return { raw, digits, localDigits, type: 'old_7_digit', countryCodeStripped };
  }
  if (localDigits.length === 9) {
    return { raw, digits, localDigits, type: 'new_9_digit', countryCodeStripped };
  }
  return { raw, digits, localDigits, type: 'invalid', countryCodeStripped };
}

export function sameLocalNumber(a: string, b: string): boolean {
  const left = normalizeGambianPhone(a);
  const right = normalizeGambianPhone(b);
  return left.type !== 'invalid' && right.type !== 'invalid' && left.localDigits === right.localDigits;
}

export function formatMigratedLikeOriginal(original: string, migratedLocalDigits: string): string {
  const trimmed = String(original || '').trim();
  const rawDigits = digitsOnly(trimmed);
  if (trimmed.startsWith('+220')) return `+220 ${migratedLocalDigits}`;
  if (rawDigits.startsWith('00220')) return `00220${migratedLocalDigits}`;
  if (rawDigits.startsWith('220')) return `220${migratedLocalDigits}`;
  return migratedLocalDigits;
}

export function formatLocalForDisplay(localDigits: string): string {
  if (localDigits.length === 7) return `${localDigits.slice(0, 3)} ${localDigits.slice(3)}`;
  if (localDigits.length === 9) return `${localDigits.slice(0, 2)} ${localDigits.slice(2, 5)} ${localDigits.slice(5)}`;
  return localDigits;
}

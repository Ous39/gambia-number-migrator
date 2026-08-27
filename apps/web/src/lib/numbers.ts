// Small, self-contained numbering helpers for the public website. Deliberately
// NOT imported from @gnm/shared: the website only needs a format + published-rule
// preview, and the GNM app remains the authority for real eligibility.

export function digitsOnly(raw: string): string {
  return String(raw || '').replace(/\D/g, '');
}

export type NumberType = 'old_7_digit' | 'new_9_digit' | 'invalid';

export function normalizeLocal(raw: string): { digits: string; localDigits: string; type: NumberType } {
  const digits = digitsOnly(raw);
  const comparable = digits.startsWith('00220') ? digits.slice(2) : digits;
  let localDigits = comparable;
  if (comparable.startsWith('220') && (comparable.length === 10 || comparable.length === 12)) {
    localDigits = comparable.slice(3);
  }
  const type: NumberType = localDigits.length === 7 ? 'old_7_digit' : localDigits.length === 9 ? 'new_9_digit' : 'invalid';
  return { digits, localDigits, type };
}

export function formatLocal(localDigits: string): string {
  if (localDigits.length === 7) return `${localDigits.slice(0, 3)} ${localDigits.slice(3)}`;
  if (localDigits.length === 9) return `${localDigits.slice(0, 2)} ${localDigits.slice(2, 5)} ${localDigits.slice(5)}`;
  return localDigits;
}

export type PublicRule = {
  ruleType: 'prefix' | 'range' | 'exact' | 'exception';
  prefixValue?: string | null;
  rangeFrom?: string | null;
  rangeTo?: string | null;
  exactNumber?: string | null;
  newPrefix: string;
  priority?: number;
  status?: string;
  operatorName?: string | null;
};
export type PublicRulesPayload = { rules?: PublicRule[]; versionNumber?: number };

/** Match a 7-digit local number against the published rules and return the
 *  migrated 9-digit number, or null. Mirrors the app's precedence
 *  (exception > exact > range > prefix, then priority, then specificity). */
export function previewMigration(local7: string, payload: PublicRulesPayload | null): { migrated: string; operator?: string } | null {
  if (!payload?.rules || !/^\d{7}$/.test(local7)) return null;
  const active = payload.rules.filter((r) => (r.status ?? 'active') === 'active');

  const exception = active.find((r) => r.ruleType === 'exception' && ruleCovers(r, local7));
  if (exception) return null; // explicitly excluded from automatic migration

  const specificity = (r: PublicRule) =>
    r.ruleType === 'exact' ? 4 : r.ruleType === 'range' ? 3 : r.ruleType === 'prefix' ? 2 : 1;

  const candidates = active
    .filter((r) => r.ruleType !== 'exception' && ruleCovers(r, local7))
    .sort((a, b) => (b.priority ?? 100) - (a.priority ?? 100) || specificity(b) - specificity(a));

  const best = candidates[0];
  if (!best || !/^\d{2}$/.test(best.newPrefix)) return null;
  const migrated = `${best.newPrefix}${local7}`;
  return /^\d{9}$/.test(migrated) ? { migrated, operator: best.operatorName || undefined } : null;
}

function ruleCovers(rule: PublicRule, local7: string): boolean {
  switch (rule.ruleType) {
    case 'exact':
    case 'exception':
      if (rule.exactNumber) return rule.exactNumber === local7;
      if (rule.prefixValue) return local7.startsWith(rule.prefixValue);
      if (rule.rangeFrom && rule.rangeTo) return local7 >= rule.rangeFrom && local7 <= rule.rangeTo;
      return false;
    case 'prefix':
      return Boolean(rule.prefixValue) && local7.startsWith(rule.prefixValue as string);
    case 'range':
      return Boolean(rule.rangeFrom && rule.rangeTo) && local7 >= (rule.rangeFrom as string) && local7 <= (rule.rangeTo as string);
    default:
      return false;
  }
}

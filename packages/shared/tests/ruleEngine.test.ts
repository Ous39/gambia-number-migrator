import { describe, expect, it } from 'vitest';
import { detectOperator, findAmbiguousRuleConflict, formatMigratedLikeOriginal, generateMigrationCandidates, findCleanupCandidates, hasApprovedMigrationRules, normalizeGambianPhone, sameLocalNumber, verifyMigratedPair } from '../src';

const payload = {
  versionNumber: 1,
  publishedAt: '2026-01-01T00:00:00Z',
  operators: [],
  rules: [
    { id: 'r1', operatorId: 'q', operatorName: 'QCell', ruleName: 'QCell 3', ruleType: 'prefix' as const, prefixValue: '3', newPrefix: '83', priority: 10, status: 'active' as const },
    { id: 'r2', operatorId: 'a', operatorName: 'Africell', ruleName: 'Africell exact', ruleType: 'exact' as const, exactNumber: '3451567', newPrefix: '87', priority: 50, status: 'active' as const }
  ]
};

describe('phone normalization', () => {
  it('normalizes common formats', () => {
    expect(normalizeGambianPhone('+220 345-1567').localDigits).toBe('3451567');
    expect(normalizeGambianPhone('220873451567').type).toBe('new_9_digit');
    expect(normalizeGambianPhone('00220 3451567').localDigits).toBe('3451567');
    expect(sameLocalNumber('abc', 'def')).toBe(false);
    expect(formatMigratedLikeOriginal('+220 3451567', '833451567')).toBe('+220 833451567');
  });
});

describe('rule engine', () => {
  it('rejects demo rule payloads for real contact scans', () => {
    expect(hasApprovedMigrationRules({ ...payload, rules: [{ ...payload.rules[0], notes: 'Demo only. Do not publish.' }] })).toBe(false);
  });
  it('uses higher priority exact rule', () => {
    const result = detectOperator('3451567', payload);
    expect(result.operatorName).toBe('Africell');
    expect(result.migratedNumber).toBe('873451567');
  });

  it('verifies safe old/new pairs', () => {
    expect(verifyMigratedPair('3451567', '873451567', payload).matched).toBe(true);
  });
  it('returns manual review for equal-priority conflicting rules', () => {
    const conflictPayload = { ...payload, rules: [payload.rules[0], { ...payload.rules[0], id: 'r-conflict', operatorId: 'other', operatorName: 'Other', newPrefix: '99' }] };
    expect(findAmbiguousRuleConflict(conflictPayload.rules)).not.toBeNull();
    expect(detectOperator('3123456', conflictPayload).matched).toBe(false);
  });
});

describe('range and exception rules', () => {
  const rangePayload = {
    versionNumber: 2,
    publishedAt: '2026-01-01T00:00:00Z',
    operators: [],
    rules: [
      { id: 'rr1', operatorId: 'g', operatorName: 'Gamcel', ruleName: 'Gamcel range', ruleType: 'range' as const, rangeFrom: '4000000', rangeTo: '4099999', newPrefix: '77', priority: 10, status: 'active' as const },
      { id: 'rr2', operatorId: 'g', operatorName: 'Gamcel', ruleName: 'Gamcel exception', ruleType: 'exception' as const, exactNumber: '4000001', newPrefix: '99', priority: 20, status: 'active' as const }
    ]
  };
  it('matches a number inside an active range', () => {
    const result = detectOperator('4050000', rangePayload);
    expect(result.matched).toBe(true);
    expect(result.migratedNumber).toBe('774050000');
  });
  it('rejects a number outside the range', () => {
    expect(detectOperator('4100000', rangePayload).matched).toBe(false);
  });
  it('lets a higher-priority exception override its containing range', () => {
    const result = detectOperator('4000001', rangePayload);
    expect(result.matched).toBe(true);
    expect(result.newPrefix).toBe('99');
    expect(result.migratedNumber).toBe('994000001');
  });
});

describe('invalid and foreign numbers', () => {
  it('never matches a non-Gambian or malformed number', () => {
    expect(detectOperator('1234', payload).matched).toBe(false);
    expect(detectOperator('12345678901', payload).matched).toBe(false);
    expect(normalizeGambianPhone('+1 555 0100').type).toBe('invalid');
  });
  it('blocks a rule whose new prefix would not produce a valid 9-digit number', () => {
    const badPayload = { ...payload, rules: [{ ...payload.rules[1], newPrefix: '8' }] };
    const result = detectOperator('3451567', badPayload);
    expect(result.matched).toBe(false);
    expect(result.reason).toMatch(/valid 9-digit number/);
  });
});

describe('migration candidates and cleanup', () => {
  const contacts = [{ id: 'c1', name: 'Lamin', phoneNumbers: [{ number: '3451567' }, { number: '873451567' }] }];
  it('detects duplicate pairs', () => {
    expect(generateMigrationCandidates(contacts, payload, 'duplicate')[0].status).toBe('Duplicate Pair Found');
  });
  it('shows a standalone verified new number as already updated', () => {
    const current = [{ id: 'c-new', name: 'Awa', phoneNumbers: [{ number: '+220 87 345 1567' }] }];
    const result = generateMigrationCandidates(current, payload, 'duplicate');
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('Already Updated');
    expect(result[0].operatorName).toBe('Africell');
  });
  it('does not double-count the new side of a duplicate pair', () => {
    const result = generateMigrationCandidates(contacts, payload, 'duplicate');
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('Duplicate Pair Found');
  });
  it('keeps an unknown 9-digit number visible for review without changing it', () => {
    const unknown = [{ id: 'c-unknown', name: 'Other', phoneNumbers: [{ number: '991234567' }] }];
    const result = generateMigrationCandidates(unknown, payload, 'duplicate');
    expect(result[0].status).toBe('Manual Review');
  });
  it('finds cleanup candidates', () => {
    expect(findCleanupCandidates(contacts, payload)).toHaveLength(1);
  });
  it('assigns a distinct phoneIndex per candidate when a contact has the exact same old number saved twice, so UI list keys never collide', () => {
    const duplicateOldNumber = [{ id: 'c-dup', name: 'Awa', phoneNumbers: [{ number: '3451567' }, { number: '3451567' }, { number: '873451567' }] }];
    const found = findCleanupCandidates(duplicateOldNumber, payload);
    expect(found).toHaveLength(2);
    expect(found[0].phoneIndex).not.toBe(found[1].phoneIndex);
    const keys = found.map((item) => `${item.contactId}:${item.phoneIndex}:${item.oldNumber}:${item.newNumber}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('does not mark an unrelated new number from the same operator as duplicate risk', () => {
    const multiple = [{ id: 'c2', name: 'Fatou', phoneNumbers: [{ number: '3123456' }, { number: '839999999' }] }];
    expect(generateMigrationCandidates(multiple, payload, 'duplicate')[0].status).toBe('Ready');
  });
});

describe('large phonebook performance', () => {
  it('processes 100,000 contacts without losing or duplicating candidates', () => {
    const contacts = Array.from({ length: 100_000 }, (_, index) => ({
      id: `contact-${index}`,
      name: `Contact ${index}`,
      phoneNumbers: [{ number: `3${String(index).padStart(6, '0')}` }],
    }));
    const started = performance.now();
    const candidates = generateMigrationCandidates(contacts, payload, 'duplicate');
    const elapsedMs = performance.now() - started;
    expect(candidates).toHaveLength(100_000);
    expect(new Set(candidates.map((candidate) => candidate.contactId)).size).toBe(100_000);
    expect(elapsedMs).toBeLessThan(15_000);
  }, 20_000);
});

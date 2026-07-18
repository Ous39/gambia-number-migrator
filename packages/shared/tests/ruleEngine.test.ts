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

describe('migration candidates and cleanup', () => {
  const contacts = [{ id: 'c1', name: 'Lamin', phoneNumbers: [{ number: '3451567' }, { number: '873451567' }] }];
  it('detects duplicate pairs', () => {
    expect(generateMigrationCandidates(contacts, payload, 'duplicate')[0].status).toBe('Duplicate Pair Found');
  });
  it('finds cleanup candidates', () => {
    expect(findCleanupCandidates(contacts, payload)).toHaveLength(1);
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

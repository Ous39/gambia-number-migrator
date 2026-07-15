import type { ContactLike, MigrationCandidate, PublishedRulesPayload, UpdateMode } from './types';
import { normalizeGambianPhone } from './phone';
import { detectOperator, verifyMigratedPair } from './ruleEngine';

export function generateMigrationCandidates(contacts: ContactLike[], payload: PublishedRulesPayload, updateMode: UpdateMode): MigrationCandidate[] {
  const candidates: MigrationCandidate[] = [];
  for (const contact of contacts) {
    const phoneNumbers = contact.phoneNumbers || [];
    const normalizedNumbers = phoneNumbers.map((p) => normalizeGambianPhone(p.number));
    phoneNumbers.forEach((phone, phoneIndex) => {
      const normalized = normalizeGambianPhone(phone.number);
      if (normalized.type !== 'old_7_digit') return;
      const detection = detectOperator(normalized.localDigits, payload);
      if (!detection.matched || !detection.migratedNumber) {
        candidates.push({
          contactId: contact.id,
          contactName: contact.name || 'Unnamed Contact',
          phoneIndex,
          phoneLabel: phone.label,
          originalNumber: phone.number,
          normalizedOldNumber: normalized.localDigits,
          matchConfidence: detection.confidence,
          updateMode,
          status: 'Manual Review',
          reason: detection.reason
        });
        return;
      }
      const hasMatchingNew = normalizedNumbers.some((n) => n.type === 'new_9_digit' && n.localDigits === detection.migratedNumber);
      candidates.push({
        contactId: contact.id,
        contactName: contact.name || 'Unnamed Contact',
        phoneIndex,
        phoneLabel: phone.label,
        originalNumber: phone.number,
        normalizedOldNumber: normalized.localDigits,
        migratedNumber: detection.migratedNumber,
        operatorName: detection.operatorName,
        operatorId: detection.operatorId,
        matchConfidence: detection.confidence,
        matchedRuleId: detection.matchedRuleId,
        matchedRuleType: detection.matchedRuleType,
        updateMode,
        status: hasMatchingNew ? 'Duplicate Pair Found' : 'Ready',
        reason: hasMatchingNew ? 'Matching new number already exists in this contact.' : detection.reason
      });
    });
  }
  return candidates;
}

export function findCleanupCandidates(contacts: ContactLike[], payload: PublishedRulesPayload) {
  const candidates = [];
  for (const contact of contacts) {
    const numbers = (contact.phoneNumbers || []).map((phone, index) => ({ phone, index, normalized: normalizeGambianPhone(phone.number) }));
    const oldNumbers = numbers.filter((n) => n.normalized.type === 'old_7_digit');
    const newNumbers = numbers.filter((n) => n.normalized.type === 'new_9_digit');
    for (const oldItem of oldNumbers) {
      let safeMatch = undefined as undefined | typeof newNumbers[number];
      let detection = undefined as ReturnType<typeof verifyMigratedPair> | undefined;
      for (const newItem of newNumbers) {
        const check = verifyMigratedPair(oldItem.normalized.localDigits, newItem.normalized.localDigits, payload);
        if (check.matched) {
          safeMatch = newItem;
          detection = check;
          break;
        }
      }
      if (safeMatch && detection) {
        candidates.push({
          contactId: contact.id,
          contactName: contact.name || 'Unnamed Contact',
          oldNumber: oldItem.phone.number,
          newNumber: safeMatch.phone.number,
          operatorName: detection.operatorName,
          operatorId: detection.operatorId,
          matchedRuleId: detection.matchedRuleId,
          confidence: detection.confidence,
          status: 'Safe' as const,
          reason: 'Verified old/new duplicate pair. Safe to remove old number after user confirmation.'
        });
      }
    }
  }
  return candidates;
}

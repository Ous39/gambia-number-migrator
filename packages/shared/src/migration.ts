import type { ContactLike, MigrationCandidate, PublishedRulesPayload, UpdateMode } from './types';
import { normalizeGambianPhone } from './phone';
import { detectOperator, verifyMigratedPair } from './ruleEngine';

export function generateMigrationCandidates(contacts: ContactLike[], payload: PublishedRulesPayload, updateMode: UpdateMode): MigrationCandidate[] {
  const candidates: MigrationCandidate[] = [];
  for (const contact of contacts) {
    const phoneNumbers = contact.phoneNumbers || [];
    const normalizedNumbers = phoneNumbers.map((p) => normalizeGambianPhone(p.number));
    const pairedNewNumbers = new Set<string>();
    for (const normalized of normalizedNumbers) {
      if (normalized.type !== 'old_7_digit') continue;
      const detection = detectOperator(normalized.localDigits, payload);
      if (detection.matched && detection.migratedNumber && normalizedNumbers.some((value) => value.type === 'new_9_digit' && value.localDigits === detection.migratedNumber)) {
        pairedNewNumbers.add(detection.migratedNumber);
      }
    }
    phoneNumbers.forEach((phone, phoneIndex) => {
      const normalized = normalizeGambianPhone(phone.number);
      if (normalized.type === 'new_9_digit') {
        // A matching old-number row already represents a verified duplicate
        // pair. Standalone new numbers still need to appear in scan results so
        // users can see that they are already migrated.
        if (pairedNewNumbers.has(normalized.localDigits)) return;
        const possibleOldNumber = normalized.localDigits.slice(2);
        const detection = detectOperator(possibleOldNumber, payload);
        const isVerifiedNewNumber = detection.matched && detection.migratedNumber === normalized.localDigits;
        candidates.push({
          contactId: contact.id,
          contactName: contact.name || 'Unnamed Contact',
          phoneIndex,
          phoneLabel: phone.label,
          originalNumber: phone.number,
          normalizedOldNumber: isVerifiedNewNumber ? possibleOldNumber : undefined,
          migratedNumber: normalized.localDigits,
          operatorName: isVerifiedNewNumber ? detection.operatorName : undefined,
          operatorId: isVerifiedNewNumber ? detection.operatorId : undefined,
          matchConfidence: isVerifiedNewNumber ? detection.confidence : 'manual_review',
          matchedRuleId: isVerifiedNewNumber ? detection.matchedRuleId : undefined,
          matchedRuleType: isVerifiedNewNumber ? detection.matchedRuleType : undefined,
          updateMode,
          status: isVerifiedNewNumber ? 'Already Updated' : 'Manual Review',
          reason: isVerifiedNewNumber
            ? 'Verified new 9-digit number is already saved in this contact.'
            : 'This is a 9-digit number, but it does not match a published migration rule. No change will be made.',
          beforePhoneNumbers: phoneNumbers.map((value) => ({ id: value.id, label: value.label, number: value.number }))
        });
        return;
      }
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
          reason: detection.reason,
          beforePhoneNumbers: phoneNumbers.map((value) => ({ id: value.id, label: value.label, number: value.number }))
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
        reason: hasMatchingNew ? 'Matching new number already exists in this contact.' : detection.reason,
        beforePhoneNumbers: phoneNumbers.map((value) => ({ id: value.id, label: value.label, number: value.number }))
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
          phoneIndex: oldItem.index,
          oldNumber: oldItem.phone.number,
          newNumber: safeMatch.phone.number,
          operatorName: detection.operatorName,
          operatorId: detection.operatorId,
          matchedRuleId: detection.matchedRuleId,
          confidence: detection.confidence,
          status: 'Safe' as const,
          reason: 'Verified old/new duplicate pair. Safe to remove old number after user confirmation.',
          beforePhoneNumbers: (contact.phoneNumbers || []).map((value) => ({ id: value.id, label: value.label, number: value.number }))
        });
      }
    }
  }
  return candidates;
}

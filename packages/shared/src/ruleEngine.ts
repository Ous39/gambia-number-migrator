import type { DetectionResult, MigrationRule, PublishedRulesPayload } from './types';
import { normalizeGambianPhone } from './phone';

function activeRules(payload: PublishedRulesPayload | { rules: MigrationRule[]; versionNumber?: number }): MigrationRule[] {
  return (payload.rules || []).filter((r) => r.status === 'active');
}

export function hasApprovedMigrationRules(payload: PublishedRulesPayload | null | undefined): boolean {
  return getMigrationRulesApprovalIssues(payload).length === 0;
}

export function getMigrationRulesApprovalIssues(payload: PublishedRulesPayload | null | undefined): string[] {
  const rules = payload?.rules || [];
  const issues: string[] = [];
  if (!rules.length) return ['No active migration rules exist.'];
  const operators = new Map((payload?.operators || []).map((operator) => [operator.id, operator]));
  for (const rule of rules) {
    if (rule.id.startsWith('local-')) issues.push(`${rule.ruleName}: local fallback rules cannot be published.`);
    if (/\b(sample|demo|fallback)\b/i.test(`${rule.ruleName} ${rule.notes || ''}`)) issues.push(`${rule.ruleName}: remove Sample, Demo or Fallback from its name and notes, or disable this rule.`);
    if (!/^\d{2}$/.test(rule.newPrefix)) issues.push(`${rule.ruleName}: the new prefix must contain exactly two digits.`);
    const operator = operators.get(rule.operatorId);
    if (!operator) issues.push(`${rule.ruleName}: its operator no longer exists.`);
    else if (operator.status !== 'active') issues.push(`${rule.ruleName}: operator ${operator.name} is disabled.`);
    else if (operator.newPrefix !== rule.newPrefix) issues.push(`${rule.ruleName}: prefix ${rule.newPrefix} does not match ${operator.name} prefix ${operator.newPrefix}.`);
  }
  const conflict = findAmbiguousRuleConflict(rules);
  if (conflict) issues.push(`${conflict.first.ruleName} conflicts with ${conflict.second.ruleName} at equal priority.`);
  return Array.from(new Set(issues));
}

function ruleIntervals(rule: MigrationRule): Array<[number, number]> {
  const intervals: Array<[number, number]> = [];
  if (rule.exactNumber) intervals.push([Number(rule.exactNumber), Number(rule.exactNumber)]);
  if (rule.rangeFrom && rule.rangeTo) intervals.push([Number(rule.rangeFrom), Number(rule.rangeTo)]);
  if (rule.prefixValue) {
    const start = Number(rule.prefixValue.padEnd(7, '0'));
    const end = Number(rule.prefixValue.padEnd(7, '9'));
    intervals.push([start, end]);
  }
  return intervals;
}

export function findAmbiguousRuleConflict(rules: MigrationRule[]): { first: MigrationRule; second: MigrationRule } | null {
  const active = rules.filter((rule) => rule.status === 'active');
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const first = active[i], second = active[j];
      if (first.priority !== second.priority || ruleSpecificity(first) !== ruleSpecificity(second)) continue;
      if (first.operatorId === second.operatorId && first.newPrefix === second.newPrefix) continue;
      const overlaps = ruleIntervals(first).some(([a, b]) => ruleIntervals(second).some(([c, d]) => Math.max(a, c) <= Math.min(b, d)));
      if (overlaps) return { first, second };
    }
  }
  return null;
}

export function ruleSpecificity(rule: MigrationRule): number {
  if (rule.ruleType === 'exact') return 4000;
  if (rule.ruleType === 'exception') return 3000 + Math.max(rule.prefixValue?.length || 0, rule.exactNumber?.length || 0);
  if (rule.ruleType === 'range') return 2000;
  if (rule.ruleType === 'prefix') return 1000 + (rule.prefixValue?.length || 0);
  return 0;
}

export function sortRulesForDetection(rules: MigrationRule[]): MigrationRule[] {
  return [...rules].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return ruleSpecificity(b) - ruleSpecificity(a);
  });
}

function matchesRule(oldNumber: string, rule: MigrationRule): boolean {
  if (rule.ruleType === 'exact') return oldNumber === rule.exactNumber;
  if (rule.ruleType === 'range') return Number(oldNumber) >= Number(rule.rangeFrom) && Number(oldNumber) <= Number(rule.rangeTo);
  if (rule.ruleType === 'prefix') return !!rule.prefixValue && oldNumber.startsWith(rule.prefixValue);
  if (rule.ruleType === 'exception') {
    if (rule.exactNumber && oldNumber === rule.exactNumber) return true;
    if (rule.prefixValue && oldNumber.startsWith(rule.prefixValue)) return true;
    if (rule.rangeFrom && rule.rangeTo && Number(oldNumber) >= Number(rule.rangeFrom) && Number(oldNumber) <= Number(rule.rangeTo)) return true;
  }
  return false;
}

export function detectOperator(oldRaw: string, payload: PublishedRulesPayload | { rules: MigrationRule[]; versionNumber?: number }): DetectionResult {
  const normalized = normalizeGambianPhone(oldRaw);
  const versionNumber = 'versionNumber' in payload ? payload.versionNumber : undefined;
  if (normalized.type !== 'old_7_digit') {
    return { matched: false, confidence: 'manual_review', reason: 'Number is not a normalized 7-digit old Gambian number.', rulesVersion: versionNumber };
  }
  const oldNumber = normalized.localDigits;
  const matches = sortRulesForDetection(activeRules(payload)).filter((rule) => matchesRule(oldNumber, rule));
  const matched = matches[0];
  if (!matched) {
    return { matched: false, confidence: 'manual_review', reason: 'No active migration rule matched this number. Manual review required.', rulesVersion: versionNumber };
  }
  const ambiguous = matches.find((rule) => rule.id !== matched.id && rule.priority === matched.priority && ruleSpecificity(rule) === ruleSpecificity(matched) && (rule.operatorId !== matched.operatorId || rule.newPrefix !== matched.newPrefix));
  if (ambiguous) return { matched: false, confidence: 'manual_review', reason: `Conflicting rules matched with equal priority: ${matched.ruleName} and ${ambiguous.ruleName}.`, rulesVersion: versionNumber };
  const migratedNumber = `${matched.newPrefix}${oldNumber}`;
  if (!/^\d{9}$/.test(migratedNumber)) return { matched: false, confidence: 'manual_review', reason: 'Matched rule did not produce a valid 9-digit number.', rulesVersion: versionNumber };
  return {
    matched: true,
    operatorId: matched.operatorId,
    operatorName: matched.operatorName,
    operatorCode: matched.operatorCode,
    newPrefix: matched.newPrefix,
    migratedNumber,
    confidence: matched.ruleType === 'prefix' ? 'medium' : 'high',
    matchedRuleId: matched.id,
    matchedRuleType: matched.ruleType,
    reason: `${matched.ruleType} rule matched: ${matched.ruleName}`,
    rulesVersion: versionNumber
  };
}

export function verifyMigratedPair(oldRaw: string, newRaw: string, payload: PublishedRulesPayload | { rules: MigrationRule[]; versionNumber?: number }): DetectionResult {
  const oldNormalized = normalizeGambianPhone(oldRaw);
  const newNormalized = normalizeGambianPhone(newRaw);
  if (oldNormalized.type !== 'old_7_digit' || newNormalized.type !== 'new_9_digit') {
    return { matched: false, confidence: 'manual_review', reason: 'Old/new pair is not in expected 7-digit and 9-digit formats.' };
  }
  const detection = detectOperator(oldNormalized.localDigits, payload);
  if (!detection.matched || !detection.migratedNumber) return detection;
  if (detection.migratedNumber !== newNormalized.localDigits) {
    return { ...detection, matched: false, confidence: 'manual_review', reason: 'New number does not match the current rule-generated migrated number.' };
  }
  return { ...detection, reason: 'Old and new numbers are a verified migration pair.' };
}

export function getKnownNewPrefixes(payload: PublishedRulesPayload): string[] {
  return Array.from(new Set(payload.rules.filter((r) => r.status === 'active').map((r) => r.newPrefix))).sort((a, b) => b.length - a.length);
}

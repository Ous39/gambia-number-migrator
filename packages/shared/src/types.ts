export type RuleType = 'prefix' | 'range' | 'exact' | 'exception';
export type RuleStatus = 'active' | 'inactive';
export type OperatorStatus = 'active' | 'disabled';
export type UpdateMode = 'duplicate' | 'replace';
export type TransitionStatus = 'before_transition' | 'during_transition' | 'after_transition';
export type CandidateStatus =
  | 'Ready'
  | 'Manual Review'
  | 'Already Updated'
  | 'Already Added'
  | 'Duplicate Pair Found'
  | 'Duplicate Risk'
  | 'Invalid'
  | 'Unsafe'
  | 'Skipped';

export interface OperatorConfig {
  id: string;
  name: string;
  code: string;
  newPrefix: string;
  color?: string;
  status: OperatorStatus;
  notes?: string | null;
}

export interface MigrationRule {
  id: string;
  operatorId: string;
  operatorName: string;
  operatorCode?: string;
  ruleName: string;
  ruleType: RuleType;
  prefixValue?: string | null;
  rangeFrom?: string | null;
  rangeTo?: string | null;
  exactNumber?: string | null;
  newPrefix: string;
  priority: number;
  status: RuleStatus;
  notes?: string | null;
}

export interface PublishedRulesPayload {
  versionNumber: number;
  publishedAt: string;
  operators: OperatorConfig[];
  rules: MigrationRule[];
}

export interface DetectionResult {
  matched: boolean;
  operatorId?: string;
  operatorName?: string;
  operatorCode?: string;
  newPrefix?: string;
  migratedNumber?: string;
  confidence: 'high' | 'medium' | 'low' | 'manual_review';
  matchedRuleId?: string;
  matchedRuleType?: RuleType;
  reason: string;
  rulesVersion?: number;
}

export interface PhoneNormalizationResult {
  raw: string;
  digits: string;
  localDigits: string;
  type: 'old_7_digit' | 'new_9_digit' | 'invalid';
  countryCodeStripped: boolean;
}

export interface TransitionSettings {
  transitionStartDate: string;
  transitionEndDate: string;
  defaultUpdateMode: UpdateMode;
  allowReplaceMode: boolean;
  showTransitionNotice: boolean;
  showCleanupRecommendation: boolean;
  transitionBannerMessage: string;
  afterTransitionMessage: string;
  cleanupRecommendationMessage: string;
}

export interface ContactPhoneLike {
  id?: string;
  label?: string;
  number: string;
}

export interface ContactLike {
  id: string;
  name: string;
  phoneNumbers: ContactPhoneLike[];
}

export interface MigrationCandidate {
  contactId: string;
  contactName: string;
  phoneIndex: number;
  phoneLabel?: string;
  originalNumber: string;
  normalizedOldNumber?: string;
  migratedNumber?: string;
  operatorName?: string;
  operatorId?: string;
  matchConfidence: DetectionResult['confidence'];
  matchedRuleId?: string;
  matchedRuleType?: RuleType;
  updateMode: UpdateMode;
  status: CandidateStatus;
  reason: string;
  /** Local-only snapshot used to create a safe backup without rereading every contact. */
  beforePhoneNumbers?: ContactPhoneLike[];
}

export interface CleanupCandidate {
  contactId: string;
  contactName: string;
  /** Index of the old-number phone row on the contact. Distinguishes two
   * candidates that share the same contact/old/new numbers (e.g. a contact
   * with the exact same 7-digit number saved twice) so UI list keys and
   * downstream matching stay unique per phone row rather than per value. */
  phoneIndex: number;
  oldNumber: string;
  newNumber: string;
  operatorName?: string;
  operatorId?: string;
  matchedRuleId?: string;
  confidence: DetectionResult['confidence'];
  status: 'Safe' | 'Manual Review' | 'Unsafe';
  reason: string;
  /** Local-only snapshot used to create a safe backup without rereading every contact. */
  beforePhoneNumbers?: ContactPhoneLike[];
}

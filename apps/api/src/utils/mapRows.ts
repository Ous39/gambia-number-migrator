import { DEFAULT_TRANSITION_SETTINGS } from '@gnm/shared';

export function mapOperator(row: any) {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    newPrefix: row.new_prefix,
    color: row.color,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapRule(row: any) {
  return {
    id: row.id,
    operatorId: row.operator_id,
    operatorName: row.operator_name,
    operatorCode: row.operator_code,
    ruleName: row.rule_name,
    ruleType: row.rule_type,
    prefixValue: row.prefix_value,
    rangeFrom: row.range_from,
    rangeTo: row.range_to,
    exactNumber: row.exact_number,
    newPrefix: row.new_prefix,
    priority: row.priority,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapTransition(row: any) {
  if (!row) return DEFAULT_TRANSITION_SETTINGS;
  return {
    transitionStartDate: String(row.transition_start_date).slice(0, 10),
    transitionEndDate: String(row.transition_end_date).slice(0, 10),
    defaultUpdateMode: row.default_update_mode,
    allowReplaceMode: row.allow_replace_mode,
    showTransitionNotice: row.show_transition_notice,
    showCleanupRecommendation: row.show_cleanup_recommendation,
    transitionBannerMessage: row.transition_banner_message,
    afterTransitionMessage: row.after_transition_message,
    cleanupRecommendationMessage: row.cleanup_recommendation_message,
    updatedAt: row.updated_at
  };
}

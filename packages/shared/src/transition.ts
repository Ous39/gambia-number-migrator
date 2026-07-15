import type { TransitionSettings, TransitionStatus, UpdateMode } from './types';

export const DEFAULT_TRANSITION_SETTINGS: TransitionSettings = {
  transitionStartDate: '2026-09-04',
  transitionEndDate: '2026-11-30',
  defaultUpdateMode: 'duplicate',
  allowReplaceMode: true,
  showTransitionNotice: true,
  showCleanupRecommendation: true,
  transitionBannerMessage: 'During the transition period, both 7-digit and 9-digit numbers may work. We recommend adding the new number while keeping the old one until the transition ends.',
  afterTransitionMessage: 'The transition period has ended. You can now remove old 7-digit duplicates and keep the new 9-digit numbers.',
  cleanupRecommendationMessage: 'Remove old 7-digit numbers only when the matching new 9-digit number exists in the same contact.'
};

export function getTransitionStatus(settings: TransitionSettings, date = new Date()): TransitionStatus {
  const current = date.toISOString().slice(0, 10);
  if (current < settings.transitionStartDate) return 'before_transition';
  if (current <= settings.transitionEndDate) return 'during_transition';
  return 'after_transition';
}

export function getRecommendedUpdateMode(settings: TransitionSettings, date = new Date()): UpdateMode {
  const status = getTransitionStatus(settings, date);
  if (status === 'during_transition') return 'duplicate';
  if (status === 'after_transition') return settings.defaultUpdateMode;
  return 'duplicate';
}

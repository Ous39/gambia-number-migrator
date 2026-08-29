import { z } from 'zod';

export const operatorSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2).max(20),
  newPrefix: z.string().regex(/^\d{2}$/, 'New prefix must contain exactly 2 digits'),
  color: z.string().optional().nullable(),
  status: z.enum(['active', 'disabled']).default('active'),
  notes: z.string().optional().nullable()
});

export const migrationRuleSchema = z.object({
  operatorId: z.string().uuid(),
  ruleName: z.string().min(2),
  ruleType: z.enum(['prefix', 'range', 'exact', 'exception']),
  prefixValue: z.string().regex(/^\d{1,7}$/).optional().nullable(),
  rangeFrom: z.string().regex(/^\d{7}$/).optional().nullable(),
  rangeTo: z.string().regex(/^\d{7}$/).optional().nullable(),
  exactNumber: z.string().regex(/^\d{7}$/).optional().nullable(),
  newPrefix: z.string().regex(/^\d{2}$/, 'New prefix must contain exactly 2 digits'),
  priority: z.coerce.number().int().min(0).max(100000).default(100),
  status: z.enum(['active', 'inactive']).default('active'),
  notes: z.string().optional().nullable()
}).superRefine((value, ctx) => {
  if (value.ruleType === 'prefix' && !value.prefixValue) ctx.addIssue({ code: 'custom', message: 'Prefix value is required for prefix rules', path: ['prefixValue'] });
  if (value.ruleType === 'range' && (!value.rangeFrom || !value.rangeTo)) ctx.addIssue({ code: 'custom', message: 'Range from and range to are required', path: ['rangeFrom'] });
  if (value.ruleType === 'exact' && !value.exactNumber) ctx.addIssue({ code: 'custom', message: 'Exact old number is required', path: ['exactNumber'] });
  if (value.ruleType === 'exception' && !value.prefixValue && !value.exactNumber && !(value.rangeFrom && value.rangeTo)) ctx.addIssue({ code: 'custom', message: 'Exception rules require a prefix, exact number, or complete range', path: ['ruleType'] });
  if (value.rangeFrom && value.rangeTo && Number(value.rangeFrom) > Number(value.rangeTo)) ctx.addIssue({ code: 'custom', message: 'Range from must be lower than range to', path: ['rangeFrom'] });
});

export const transitionSettingsSchema = z.object({
  transitionStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  transitionEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  defaultUpdateMode: z.enum(['duplicate', 'replace']),
  allowReplaceMode: z.boolean(),
  showTransitionNotice: z.boolean(),
  showCleanupRecommendation: z.boolean(),
  transitionBannerMessage: z.string().min(5),
  afterTransitionMessage: z.string().min(5),
  cleanupRecommendationMessage: z.string().min(5)
}).superRefine((value, ctx) => {
  if (value.transitionStartDate > value.transitionEndDate) ctx.addIssue({ code: 'custom', message: 'Transition start date must be on or before the end date', path: ['transitionEndDate'] });
  if (!value.allowReplaceMode && value.defaultUpdateMode === 'replace') ctx.addIssue({ code: 'custom', message: 'Default mode cannot be replace while replace mode is disabled', path: ['defaultUpdateMode'] });
});

// GNM never handles a payment PIN or OTP. Checkout is a signed provider session
// opened in the system browser; access is granted only from a verified webhook
// (or a provider-side reconciliation), never from the client.
export const paymentIntentSchema = z.object({
  provider: z.enum(['wave', 'aps']),
  deviceId: z.string().min(8).max(200),
  featureKey: z.literal('bulk_unlock'),
  amount: z.coerce.number().positive(),
  currency: z.literal('GMD').default('GMD'),
  customerPhone: z.string().regex(/^(\d{7}|\d{9})$/).optional(),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9:_-]{16,100}$/),
  metadata: z.record(z.unknown()).optional().default({})
});

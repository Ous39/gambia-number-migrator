# Dashboard, Scan, and Preview Fix Report

## Dashboard

- Accurate counts for ready, already updated, manual review, and safe cleanup.
- Completion percentage now uses actionable migration numbers rather than the whole contact list.
- Already Updated opens its own result filter instead of a mixed review list.
- Preview actions require a current scan and offer **Scan Now** when none exists.
- Saved scans are invalidated when the published rules version changes or rules are withdrawn.
- Removed hard-coded personal greeting and prevented duplicate scan starts.

## Scan

- Scan summary is generated in the service and supports multiple eligible numbers in one contact.
- Results distinguish ready, already updated, needs review, and unchanged contacts.
- Unrelated new numbers from the same operator no longer create a false duplicate-risk result.
- Scan refuses demo, fallback, missing, or retired rules.
- Existing automatically published sample rules are retired by migration `007_disable_demo_rules.sql`.

## Preview

- Eligible contacts are no longer selected automatically.
- **Select All** affects ready numbers visible under the current search/filter only.
- Updated results and manual-review results use separate filters.
- Replace mode is disabled when the admin transition configuration disallows it.
- Direct access without a current scan shows a clear Scan Required state.
- Loading, empty search, stale scan, payment return, busy selection, and completion totals are handled safely.

## Additional fixes

- Migration `006_pricing_payload_consistency.sql` aligns the stored pricing payload with D100.
- Migration `008_deduplicate_seed_rules.sql` removes repeated seed rules and prevents them from being inserted again.
- Apply migrations `001` through `008` before testing this version.

## Validation note

JSON configuration and archive integrity were validated. The dependency registry continued returning HTTP 502 responses, so the complete TypeScript/build/test commands could not be executed in this environment.

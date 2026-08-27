# GNM v2.8.9 full audit

Date: 20 August 2026

## Main incident: only three contacts update

Two independent defects reproduced the reported behaviour:

1. The mobile client called `trial-increment` before contact writes. Failed and skipped writes therefore consumed free allowance. A device that had seven earlier attempts showed only three remaining and Select All was capped at three.
2. Preview derived the migration payload from `visibleReady`. Selections outside the current search/operator filter disappeared silently when a user changed filters.

## Fixes included

- Trial usage is validated before migration but charged only for successful contact writes.
- Failed and skipped contacts no longer consume free allowance.
- Selection now persists across All, Needs Update, operator, search, and Review filters.
- Preview shows selected-in-total and selected-in-current-view separately.
- Native contact write exceptions are retained per contact and shown on the completion screen (maximum three on-screen summaries; full details remain in local history).
- Admin Support Devices now provides an audited, confirmed **Reset trial usage** action for test devices affected by the old counting defect.
- Mobile version advanced to 2.8.9, Android versionCode 34, and iOS buildNumber 34.
- Device telemetry fallback version advanced to 2.8.9.

## Migration rule review

- The engine processes every phone number in every returned contact; no hard-coded three-item scan or migration limit exists.
- The published data model supports prefix, range, exact, and exception rules with ambiguity detection.
- Country-code formats `+220`, `220`, and `00220` are normalized for 7-digit and 9-digit local numbers.
- Only 7-digit numbers that match an active published rule are automatically migrated. Unmatched numbers correctly remain Manual Review.
- The currently seeded Phase 1 rules are QCell 3/5, Comium 6/84/85/86/87, and Africell 7/2/40/41/45. These production allocations must be checked against the final signed PURA operator schedule before store release.

## Safety review

- Contacts remain on-device; the API receives only a privacy-safe device reference and counters.
- A local backup is created before a migration job.
- Duplicate Add keeps the old number and avoids adding an existing matching 9-digit number.
- Replace mode remains admin-controlled and premium-gated.
- Cleanup removes an old number only when its verified new pair exists in the same contact.
- Interrupted jobs remain resumable through checkpoints.

## Verification status

- `git diff --check`: passed.
- Dependency installation and automated TypeScript/Vitest execution could not be completed in this workspace because the package registry was unavailable. Run the commands below in CI or the deployment checkout before release:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
```

## Required device acceptance test

Use at least one Android and one iPhone with 12 disposable contacts: multiple operators, formatted `+220` numbers, one contact with two old numbers, one already-migrated pair, one invalid number, and one unmatched number. Confirm that successful writes alone reduce trial allowance and that selected contacts remain selected while switching filters.

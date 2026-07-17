# Gambia Number Migrator v2.4.0 Audit

## Fixed in this release

- Removed quadratic migration checkpoint copying that became severe on large selections.
- Reduced Contacts-provider verification reads from every write to the first writes and periodic safety samples.
- Reused the scan-time local phone snapshot for pre-migration backups, with a legacy fallback for older scans.
- Preserved and recalculated the saved scan after successful migration so Dashboard and Preview update immediately without rescanning.
- Simplified Preview into a familiar phone-contact list with avatar, name, number transition, operator/status, and trailing selection control.
- Corrected the Android notification channel to `general` in both native config and runtime setup.
- Re-registers push notification tokens when the installed app returns to the foreground.
- Uses the async last-notification response API and opens in-app notification history on tap.
- Deactivates Expo tokens reported as `DeviceNotRegistered` and distinguishes sent, partial, failed, and no-device notification results.
- Added optional `EXPO_ACCESS_TOKEN` support for Expo projects with enhanced push security.
- Added Android/iOS notification previews and clearer acceptance wording in Admin.
- Fixed an undefined Admin CSS border token and improved notification preview controls.
- Removed duplicate root Expo configuration with a conflicting Android package identifier.
- Corrected invalid `eas.json` JSON, duplicate Android permissions, misspelled `eas.jon`, local `.env`, and `.expo` device metadata.
- Added safe root and mobile environment examples plus repository ignore rules.

## Verified

- TypeScript: shared, API, Admin, and Mobile pass.
- Automated tests: 9/9 pass.
- Admin production bundle builds successfully.
- `apps/mobile/eas.json` and `apps/mobile/app.json` parse as valid JSON.

## Production blockers requiring external accounts

- Wave and APS are not live API integrations yet. The current production backend supports secure webhook confirmation and admin confirmation, but real checkout creation requires each provider's official merchant API contract, credentials, signature specification, and sandbox access.
- Store builds intentionally do not expose the direct Wave/APS unlock flow. Google Play Billing and Apple In-App Purchase receipt validation must be completed for a store-distributed digital feature.
- Public Privacy Policy and Terms URLs are still required before store submission.
- Apple builds require an active Apple Developer organization membership when OceanBrown is ready.

## Large-phonebook expectation

Android's Contacts provider remains the final throughput limit. v2.4 removes avoidable JavaScript/AsyncStorage overhead and redundant reads, but writing 10,000–100,000 native contacts is not instantaneous. Test 1k, 10k, 50k, then 100k on a dedicated device, keep the app foregrounded, and use pause/resume checkpoints.

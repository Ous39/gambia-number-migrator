# GNM v2.8.2 Full Audit and Remediation Report

Audit date: 6 August 2026

## Outcome

The v2.8.1 verified source package was reviewed across the Expo mobile app, React admin portal, Express API, shared migration engine, PostgreSQL migrations, backup/restore paths, payment controls, notification delivery, dependency security, builds, and tests. Confirmed defects found during this audit were remediated in v2.8.2.

## Changes completed

- Removed automatic notification permission and push-token registration from app startup and foreground events.
- Moved notification permission and preference controls into Settings.
- Added explicit Allow Notifications, Turn Off Notifications, and Open Phone Notification Settings actions.
- Kept the notification inbox focused on received messages instead of permission setup.
- Added an API preference endpoint that deactivates a device's push tokens when the user turns notifications off.
- Preserved native notification sound, badge, vibration, lock-screen visibility, Android channel, and notification-tap routing.
- Updated Vite to a patched production version.
- Added safe dependency overrides for vulnerable PostCSS and brace-expansion versions.
- Reduced the production dependency audit from nine high-severity findings to zero high-severity findings.
- Rebuilt mobile, admin, API, and shared packages from source.

## Functional audit findings

- Contact permission remains explicit and requested only when the user starts a contact operation.
- Migration rules must be approved and published before contacts can be changed.
- Add-and-keep-old, replace, and duplicate cleanup operations create a verified local backup before writes.
- Backup data is chunked, verified after writing, capped, and restored using saved contact snapshots where available.
- Completed add/replace migrations update the stored scan summary, avoiding an unnecessary rescan.
- Duplicate cleanup verifies the old/new number pair against current official rules and confirms the new number remains after cleanup.
- Payment access is confirmed server-side and device trial usage is enforced by the API.
- Admin authentication, rate limiting, CORS, request validation, payment idempotency, and webhook replay controls are present.

## Verification completed

- TypeScript type checks: passed for shared, API, admin, and mobile.
- Automated tests: 10 passed (9 migration engine tests and 1 API health test).
- Production builds: passed for shared, API, admin, Android bundle, iOS bundle, and web bundle.
- Production dependency audit: zero high or critical vulnerabilities; nine moderate transitive development/tooling findings remain.

## External release requirements

These are not source-code defects and must be completed with production accounts before store release:

- Provide live Wave and APS merchant credentials and validated webhook secrets.
- Set production API, admin, CORS, database, JWT, and initial-admin environment variables.
- Add the private Android Firebase `google-services.json` file and confirm the EAS project configuration.
- Publish working Privacy Policy, Terms, and official support URLs in Admin App Config.
- Run physical-device acceptance tests on at least one supported Android phone and one iPhone, including contacts, backup, restore, payment, and push delivery.
- Perform a small controlled pilot before national rollout.

## Release decision

The repository is build-clean and suitable for staging/pilot deployment. It should not be described as fully production-ready until the external payment credentials, Firebase configuration, legal URLs, and physical-device acceptance tests above are completed.

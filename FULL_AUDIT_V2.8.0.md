# GNM Full Audit v2.8.0

Date: 31 July 2026

## Scope and method

Reviewed the mobile app, admin portal, API, shared rule engine, SQL migrations, authentication, authorization, payments, notifications, contact scan/migration, backup/restore, entitlement, configuration, deployment files, release metadata, tests, and prior audit/design documents.

## Confirmed findings and disposition

| Class | Finding | Result |
|---|---|---|
| Security vulnerability | Payment creation had no client idempotency key. A network retry could create more than one intent. | Fixed with device-scoped unique idempotency keys and migration 014. |
| Security vulnerability | Webhooks used a static secret header with no signed timestamp or replay-event record. | Fixed with HMAC SHA-256 verification, a 60–900 second tolerance, unique event IDs, and transactional processing. |
| Confirmed defect | Admin dashboard advertised API/app version `1.0.0`. | Fixed to `2.8.0`. |
| UX/branding problem | Admin styles still used the older purple palette. | Replaced with OceanBrown deep navy and electric blue tokens. |
| Maintainability problem | Release version was repeated inconsistently and native build numbers were absent. | Packages, visible app version, Android versionCode, and iOS buildNumber updated. |
| Potential risk | Production checkout previously implied that GNM itself sends a four-digit OTP. | Production now remains pending and explicitly follows only official provider instructions; generated OTP remains test-mode only. |
| Security vulnerability | API responses had no request correlation identifier. | Added bounded `x-request-id` response headers. |
| Performance strength | Contact loading yields every 50 records; backup data is chunked and verified; large rule-engine regression covers 100,000 contacts. | Preserved. Physical-device validation still required. |
| Privacy strength | Contact names and numbers are processed and backed up locally; backend registration uses a device reference and diagnostics rather than the contact book. | Preserved. |
| Accessibility risk | Mobile has accessible labels and large targets in common components, but full screen-reader and 200% text-scale testing was not possible here. | Documented as a release gate. |
| Dependency risk | The security audit reports transitive vulnerabilities, including React Router/Vite/Expo CLI paths. | Not silently upgraded across majors; owner must apply tested framework upgrades before production sign-off. |
| Third-party requirement | Live Wave/APS provider creation, redirect, signature format, refund, expiry, and reconciliation cannot be confirmed without official documentation and credentials. | Integration remains an explicit secure boundary, not claimed live. |

## Preserved safeguards

- Production test mode is rejected.
- Manual payment confirmation remains unavailable outside test mode.
- Admin login rate limiting, input schemas, parameterized SQL, role checks, secure headers, constrained CORS, and sanitized errors remain.
- Only published verified rule payloads can reach the migration engine.
- Scan does not modify contacts.
- Automatic pre-change backup and post-write verification remain.
- Trial usage remains server controlled, with default 10 contacts.

## Routes reviewed

Mobile: index/splash routing, onboarding, dashboard, scan completion, preview/selection, backup, cleanup, migration completion, history, payment selection/checkout/status, notifications, and settings/support/legal.

Admin: login, dashboard, operators, rules, transition settings, app config, payments, support devices, notifications, audit logs, and team.

## Remaining release gates

1. Obtain official Wave and APS integration/security specifications and sandbox accounts.
2. Run migration 014 against a staging clone and confirm rollback/restore procedure.
3. Resolve dependency audit findings with tested framework upgrades.
4. Test 10,000+ real contacts, interruption recovery, backup/restore, notifications, and payments on physical low-cost Android and iOS devices.
5. Perform WCAG screen-reader, keyboard, 200% text, contrast, and reduced-motion review.
6. Capture approved production screenshots after the API, seeded staging database, browser, and physical/emulated devices are available.

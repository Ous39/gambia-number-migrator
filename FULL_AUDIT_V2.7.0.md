# Gambia Number Migrator — Full Audit v2.7.0

Date: 30 July 2026  
Scope: Expo mobile app, React/Vite administration console, Express API, PostgreSQL migrations, shared migration engine, deployment and operator documentation.

## Release outcome

Version 2.7.0 is a production-focused UI, interaction, accessibility, and security upgrade of v2.6.2. The migration rules, on-device contact processing, local backups, free allowance, payment entitlement, support diagnostics, and push-notification architecture remain intact.

## Before / after

| Before | After | Why |
| --- | --- | --- |
| Purple carried nearly every brand and status state | Deep navy foundation, electric-blue actions, and separate semantic success/warning/danger colours | Establishes clear visual hierarchy and aligns the product with OceanBrown |
| Touch controls relied mainly on opacity | Buttons, icon controls, and pressable cards use subtle 0.97–0.985 press feedback | Makes the interface feel responsive without distracting animation |
| Dark bottom navigation retained an unrelated green tint | Bottom navigation now uses the same navy surface system | Removes a visible theme inconsistency |
| Admin mobile navigation used a wide grid | Sticky, horizontally scrollable mobile navigation | Makes every admin section reachable on narrow screens |
| Notification inbox content could touch screen edges | Responsive horizontal and vertical safe spacing | Improves readability on phones and tablets |
| Browser motion ignored OS preferences | `prefers-reduced-motion` disables non-essential motion | Improves accessibility |
| Focus indication varied by component | Unified high-contrast `:focus-visible` treatment | Supports keyboard administration |
| Manual payment confirmation route remained callable in production | API blocks manual confirmation unless payment test mode is enabled | Prevents accidental entitlement grants |
| Login used only the general API limiter | Login receives a dedicated 10-attempt / 15-minute limiter | Reduces brute-force risk |
| Version labels remained at 2.6.2 | All application packages and visible version labels use 2.7.0 | Keeps builds, support data, and documentation consistent |

## Functional audit

- Migration computation remains centralized in `@gnm/shared`.
- Contact scanning and migration remain on-device.
- Saved scans are invalidated when the published rules version changes.
- Backup creation, chunked storage, verification, restoration, and history remain available.
- Trial allowance and paid entitlement remain device-bound and server-verified.
- Production configuration rejects weak JWT secrets, test payments, missing databases, and localhost CORS.
- Admin authorization continues to validate the current database account on every protected request.
- Push registration checks physical device, permission, EAS project ID, token format, device status, and API registration.
- Notification delivery uses high priority, sound, badges, vibration, and the Android `general` channel.

## Deployment gates

Before production:

1. Set `NODE_ENV=production`, a strong `JWT_SECRET`, production `DATABASE_URL`, HTTPS `CORS_ORIGIN`, and `PAYMENT_TEST_MODE=false`.
2. Add live provider credentials and complete provider-specific signed webhook verification before accepting real payments.
3. Place the private Android Firebase `google-services.json` in `apps/mobile` for the production EAS build.
4. Run migrations `001`–`013`, seed the verified operator configuration, then publish rules from Admin.
5. Build a development/production client for push testing; Expo Go does not support remote push notifications on current Expo SDKs.
6. Test contact migration and restore with representative 100, 1,000, and 10,000-contact datasets on physical Android and iOS devices.

## Remaining external dependencies

Live Wave and APS checkout behavior cannot be completed from source code alone; it requires approved merchant credentials, provider API specifications, callback URLs, and signing requirements. Store release also requires Apple and Google developer accounts, signed binaries, privacy declarations, and device testing.

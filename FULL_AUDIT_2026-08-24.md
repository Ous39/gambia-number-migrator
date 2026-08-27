# GNM Full Source Audit — 24 August 2026

## Release decision

This audited package uses `GNM-v1.0.0-STORE-READY-FULL-SOURCE (2)` as its base. Despite its archive name, its internal application packages are v2.8.15 and it contains later production/security work than `Gambia-Number-Migrator-v2_8_15-FULL-SOURCE_2`.

The second archive remains useful as historical documentation and brand-asset history, but should not be deployed as the production base because it lacks the final production Compose file, dependency security overrides, the final free-launch migration, hashed device credential middleware, and the latest payment/device integrity migration.

## Changes completed in this audited release

- Preserved all store-facing mobile flows, admin portal, API, PostgreSQL migrations, local backup/restore, duplicate cleanup, resumable migration jobs, notifications, live configuration, official PURA rules, and role-based admin controls.
- Retained the production Docker Compose and Nginx deployment configuration.
- Kept Wave and APS opt-in: neither wallet appears until enabled by an administrator after provider approval and production integration.
- Kept the App Store/Play Store distribution channel free during launch, avoiding an unapproved in-app wallet flow in store builds.
- Bound test OTP verification and payment-status lookup to the registered device secret.
- Changed new app installations to use a random app-scoped identifier instead of Android/iOS platform identifiers.
- Aligned the shared package version with v2.8.15.
- Updated Windows startup to reuse an existing PostgreSQL container instead of attempting to create a conflicting duplicate.
- Added offline Expo LAN startup to bypass the Expo dependency-service response error while retaining local Metro/phone testing.
- Added `FIX_DOCKER_DATABASE.bat`, a non-destructive local database startup repair tool.
- Added dedicated `start:lan` and `start:tunnel` package scripts, eliminating Windows/pnpm flag forwarding entirely.
- Added `CLEAN_INSTALL_WINDOWS.bat` to remove stale generated dependencies and reinstall exactly from the lockfile while preserving source, environment configuration and PostgreSQL data.
- Removed redundant forced installation from first setup and added a safe Windows file-lock retry path for pnpm `EBUSY` failures.
- Corrected Expo SDK 54 connection modes: LAN/offline uses only `--offline`, while tunnel uses only `--tunnel`.

## Audit coverage

### Mobile app

- Contact permission and local-only contact processing
- Scan, preview, selection, Add & Keep Old, controlled Replace mode
- Pre-change backup, post-write verification, restore, duplicate cleanup
- Large-phonebook progress, checkpoints, pause/resume and completion notification
- Free/trial/paid/campaign access handling
- Payment provider visibility and phone validation
- Expo/EAS identifiers, HTTPS production API, Android/iOS permissions and store versioning
- Light/dark styling, fixed navigation, keyboard-safe payment layout and accessibility labels

### API and database

- Production environment validation, Helmet, restricted CORS, request limits and rate limiting
- Password hashing, JWT admin auth, role/area authorization and audit logs
- Device credential hashing and protected mutation routes
- Idempotent payment creation, signed/replay-protected webhook processing and success immutability
- Payment/device foreign-key integrity
- Notification audiences, preferences, delivery/receipt tracking
- Ordered, transactional SQL migrations and official published rules

### Admin and deployment

- Dashboard, rules/operators, transition controls, pricing/app configuration
- Payment-provider enable/disable controls
- Notifications, support devices, team roles and audit history
- Docker production services, health checks, Nginx example and environment templates

## Important launch gates

The source is consolidated and release-ready, but external production items must still be completed before enabling paid wallets:

1. Obtain written/API approval and production credentials from Wave and/or APS.
2. Implement and certify each provider's real checkout/API contract; keep `PAYMENT_PROVIDER_INTEGRATION_READY=false` and both provider switches disabled until then.
3. Use a production `JWT_SECRET` of at least 32 random characters, a strong PostgreSQL password, HTTPS origins, and test database backups.
4. Build Android/iOS binaries with the OceanBrown store accounts and complete real-device regression testing.
5. Confirm the final PURA numbering rules and effective date before publishing a new rules version.
6. Complete privacy, support, terms, store listing, data-safety/privacy labels, screenshots and reviewer notes.

## Verification note

Archive structure, configuration, source differences, security boundaries, migration order, JSON files and source references were audited locally. Dependency installation could not be repeated in the restricted audit environment because registry access was unavailable. Run the commands below on the release machine before signing binaries:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm lint
pnpm build
```

Then run the local Docker/PostgreSQL integration flow in `LOCAL_TESTING.md` and the physical-device checklist in `STORE_RELEASE.md`.

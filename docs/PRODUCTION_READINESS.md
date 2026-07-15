# Production readiness status

## Completed in the codebase

- Production Docker builds for the API and admin SPA.
- Automatic database migration at API deployment.
- Fail-fast production environment validation and graceful shutdown.
- HTTPS/CORS-ready configuration and server-only merchant secret placeholders.
- Native splash lifecycle, adaptive icon assets, notifications, support diagnostics and privacy-safe support codes.
- Separate `store` and `direct` payment presentation to avoid offering an unapproved external digital payment in store builds.
- EAS remote versioning, automatic build increments and draft/internal submission defaults.
- PURA Phase 1 ranges are installed and published automatically by migrations 012-013.
- Purple production design system: `#49225B`, `#6E3482`, `#A56ABD`, `#E7DBEF`, `#F5EBFA`.
- Named team accounts with owner, admin, operations, finance, support and viewer access controls.

## Owner actions still required

- Create Apple Developer, App Store Connect, Google Play Console, Expo/EAS, Railway, Wave Business and APS Merchant accounts.
- Replace domains, email, phone, privacy and terms placeholders with real published values.
- Obtain DPA/privacy review and complete Apple privacy nutrition labels and Play Data Safety using actual production behavior.
- Create `contact_migration_pass` and add server receipt verification before enabling store purchases.
- Receive official Wave/APS credentials and specifications; no developer can manufacture these credentials.
- Supply final screenshots, support URL, reviewer notes and any demo/reviewer access.
- Test on multiple real low/mid/high Android devices and a real iPhone through internal testing/TestFlight.
- Configure monitoring, database backups, alerting, log retention and secret rotation.

Do not submit the store build while it displays “Purchase setup pending.” That deliberate fail-closed state prevents taking money without verifiable entitlement delivery.

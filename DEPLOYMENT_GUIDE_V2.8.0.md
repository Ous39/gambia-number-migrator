# Deployment Guide v2.8.0

Required production variables: `NODE_ENV=production`, `DATABASE_URL`, random `JWT_SECRET` of at least 32 characters, `PAYMENT_TEST_MODE=false`, `CORS_ORIGIN`, `ADMIN_BASE_URL`, `WAVE_WEBHOOK_SECRET`, `APS_WEBHOOK_SECRET`, `PAYMENT_WEBHOOK_TOLERANCE_SECONDS=300`, and `EXPO_ACCESS_TOKEN` only where push delivery requires it. Mobile build uses `EXPO_PUBLIC_API_BASE_URL`; admin uses `VITE_API_BASE_URL`.

1. Back up PostgreSQL and verify restore.
2. Deploy to staging; run `pnpm db:migrate`.
3. Run typecheck, tests, builds, health/readiness, admin login/RBAC, published-rule fetch, payment sandbox idempotency/replay, push, scan, backup, migration, and restore tests.
4. Build signed mobile artifacts with the preserved identifiers and version/build 2.8.0/28.
5. Deploy API, then Admin, then mobile release. Monitor errors and payment/notification delivery.
6. Production rollback: stop new writes, restore the pre-release database snapshot if schema rollback is essential, redeploy the previous API/Admin/mobile build, and reconcile provider payments before reopening.

Never enable test payments or manual confirmation in production.

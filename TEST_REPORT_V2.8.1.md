# GNM v2.8.1 Verification Report

Verification date: 2026-08-03

## Results

- Workspace TypeScript type-check: PASS
- Shared migration-rule tests: PASS (9/9)
- API health-route test: PASS (1/1)
- API production build: PASS
- Admin production build: PASS
- Expo export for Android, iOS, and Web: PASS
- ZIP integrity test: required after packaging

## Release checks

- Package versions: 2.8.1
- Android versionCode: 29
- iOS buildNumber: 29
- Database migrations required: 001 through 014 (no new v2.8.1 migration)

## Production configuration reminder

Set `PAYMENT_TEST_MODE=false` in the API and `EXPO_PUBLIC_PAYMENT_TEST_MODE=false` in the direct-distribution mobile build only after real Wave/APS credentials and verified callbacks are ready.

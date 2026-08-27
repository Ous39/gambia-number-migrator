# GNM — Production Readiness

**Date:** 2026-08-27 · **Branch:** `main` (deployed to the VPS) · supersedes the earlier
Wave-branch version of this file.

## Verdict

| Area | Status |
|---|---|
| **Backend / API** | ✅ Live on the VPS. 27 migrations applied, `/api/health` green, `/api/public/status` serving. |
| **Website** (`gnm.oceanbrown.gm`) | ✅ Deployable. Redesigned, brand palette, status/updates/organisations pages, legal + refunds + payment-result pages, admin-managed store & social links. |
| **Admin** | ✅ App settings and website settings are separated. |
| **Mobile — free store release** | 🟢 **Ready to build & submit.** No blockers in code. Remaining work is store-console setup + assets — see `STORE_SUBMISSION_CHECKLIST.md`. |
| **Wave payments** | ⛔ Built, tested, **disabled**. Cannot go live until Wave confirms GMD and issues credentials — `WAVE_INTEGRATION_AUDIT.md` §8, `WAVE_DEPLOYMENT_AND_ROLLBACK.md`. |
| **APS payments** | ⛔ Provider stub only; no real APS API integrated. Disabled. `ADDING_A_PAYMENT_PROVIDER.md`. |

Verified now: `pnpm typecheck` (shared + 4 apps), `pnpm test` (api 69, mobile 43, admin 7, web 6,
shared 18 = **143**), `pnpm build` (all apps).

---

## 1. Green

- API boots in production with payments disabled; **refuses to boot** if `PAYMENT_PROVIDER_INTEGRATION_READY=true` and the Wave config is incomplete or non-HTTPS.
- `PAYMENT_TEST_MODE` cannot be true in production (env guard).
- Entitlement is granted only on a verified provider confirmation (signature + amount + currency + reference + `succeeded`/`complete`); a `success` can't be downgraded; only the paying device is unlocked; duplicate webhooks are inert.
- No Wave/APS in `store`-channel mobile builds — free-launch screen only, no IAP path.
- Testers can be granted access without any provider: Admin → Campaign mode, or Admin → Support devices → Grant full access (per device, revocable, audited).
- Migrations `001–027` are forward-only / idempotent; `025–027` applied cleanly on the VPS.
- Secrets: none committed, none in the mobile bundle (`secrets-hygiene.test.ts`).
- Web: legal pages (`/privacy`, `/terms`, `/refunds`, `/data-deletion`) and `/payment/success` + `/payment/error` routes exist.

## 2. Blockers for LIVE Wave (unchanged)

1. Wave confirms `currency: "GMD"` for a Gambia business wallet.
2. Wave issues production API key + request-signing secret + webhook secret.
3. VPS static egress IP allow-listed on the key; Wave's 15 webhook source IPs allow-listed inbound.
4. Real `WAVE_*` in `.env.production`; `PAYMENT_PROVIDER_INTEGRATION_READY=true`; API restarts clean.
5. `GET /admin/payments/health` shows Wave `configured: true`.
6. One successful sandbox end-to-end (create → pay → signed webhook → unlock → reconcile).

Send `WAVE_API_ONBOARDING_REQUEST.md` to Wave to start.

## 3. Should fix (non-blocking)

| Item | Notes |
|---|---|
| **Homepage screenshot weight** | `apps/web/public/screens/*` are ~400 KB PNGs, 5 loaded eagerly (~2 MB). Convert to WebP (~60 KB) or lazy-load all but the first. Matters for Gambian mobile data. No image tooling in this environment — do it locally with `cwebp` / an online converter, keep the same filenames. |
| **Android push** | Non-functional until Firebase `google-services.json` + FCM v1 key are added (`ANDROID_PUSH_SETUP.md`). In-app notifications work. Not a store blocker. |
| **iOS push** | Add an APNs key via `eas credentials` (managed). |
| **iOS privacy manifest** | Rely on Expo SDK 54 + module defaults; run `npx expo-doctor` and check the first EAS build for a "required reason" flag. |
| **Device attestation** | Registration abuse is per-IP rate limiting only (documented `TODO` in `app.ts`). Accepted risk. Real fix = App Attest / Play Integrity. |
| **`.env.production` (VPS)** | Must hold a strong non-placeholder `JWT_SECRET`, real `DATABASE_URL`, and `CORS_ORIGIN` = the admin origin. The API is booting in production, so this is presumably in place — verify `JWT_SECRET` length ≥ 32 and non-placeholder. |
| **Mobile tests** | Service-layer only (43). No screen/flow tests (e.g. payment-checkout). |
| **`pricing` config blob** | Migration `026` leaves `pricing.bulk_unlock` at `100` due to statement order; harmless — nothing reads it, the charge path uses `subscription_price` (= 25). |

## 4. Recommendation

- **Ship the free store release now.** Follow `STORE_SUBMISSION_CHECKLIST.md`. No payment
  integration is required for it.
- **Keep Wave/APS disabled** until §2 is cleared; the backend enforces this regardless of the
  admin toggle.
- Deployment / rollback for the API and website: `WAVE_DEPLOYMENT_AND_ROLLBACK.md`,
  `RELEASE_RUNBOOK.md`.

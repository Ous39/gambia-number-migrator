# GNM — Production Readiness Check (Wave payments branch)

**Branch:** `feat/wave-checkout-integration` · **Date:** 2026-08-27
**Scope of this check:** the payments changes on this branch, plus what `pnpm typecheck / test / build`
and a simulated production boot actually prove. It is **not** a full re-audit of every GNM subsystem —
for that, see `GNM-v1.0.0-FINAL-AUDIT.md`.

**Verdict:**
- **Payments code / infra:** ✅ ready to merge and deploy — **with Wave switched off**.
- **Live Wave payments:** ⛔ NO-GO until the external blockers below are cleared.
- **Whole-system "fully ready":** ⚠️ mostly, with the non-payment caveats in §3 to confirm before a store/VPS release.

---

## 1. Verified green

| Check | Evidence |
|---|---|
| Price is **D25 GMD** everywhere | `app_config.subscription_price = 25` (migration `021`); API `create-intent` and `apps/mobile` both charge from `subscription_price`; new migration `026` also aligns the stale `pricing` blob and any legacy `100` default to 25. |
| Type safety | `pnpm typecheck` — shared, api, admin, web, mobile all pass, no `any`/`@ts-ignore` added. |
| Tests | `pnpm test` — api 64 (incl. new wave-signature 12, payments-route 11, secrets-hygiene 3), mobile 43, admin 7, web 6, shared 18. All pass. |
| Production builds | `pnpm build` — api (`tsc`), admin, web (Vite), mobile (`expo export`) all exit 0. |
| API boots in production with **Wave disabled** | Simulated `NODE_ENV=production … PAYMENT_PROVIDER_INTEGRATION_READY=false` → loads clean. A disabled provider never blocks boot. |
| API **refuses to boot** if Wave is "armed" but misconfigured | `PAYMENT_PROVIDER_INTEGRATION_READY=true` with missing/`http` Wave values → throws `Invalid production configuration: …`. |
| `PAYMENT_TEST_MODE` still cannot be true in production | Existing `env.ts` guard retained. |
| Entitlement cannot be granted without a verified provider confirmation | Webhook requires valid `Wave-Signature`, matching amount/currency/`client_reference`, `payment_status=succeeded` + `checkout_status=complete`; `verify-otp` is test-mode-only; `confirm-manual` is blocked outside test mode **and** when integration is ready. |
| A successful payment cannot be downgraded | SQL `status = CASE WHEN status='success' THEN 'success' ELSE $2 END`. |
| Only the paying device is unlocked | Unlock is scoped to `payments.device_id`; the webhook never creates or unblocks a device. |
| Duplicate webhooks are inert | Dedup on `event.id` in `payment_webhook_events`; returns `{duplicate:true}`. |
| Secrets are not committed or shipped to mobile | `secrets-hygiene.test.ts` asserts empty `.env.example` values, no `wave_sn_*` literals, and no `WAVE_*` secret names in `apps/mobile`. |
| Migration safety | `025` and `026` are forward-only, idempotent, no `DROP`/`DELETE`, and backfill existing rows. `db:migrate` records them in `schema_migrations`. |
| Store builds unaffected | `EXPO_PUBLIC_DISTRIBUTION_CHANNEL=store` still renders the free-launch screen; no Wave/APS code path. |
| APS isolated | APS keeps its own provider + interim webhook scheme; nothing Wave-specific leaks into it. |

---

## 2. External blockers for **live** Wave (all must be cleared)

1. **Wave confirms `currency: "GMD"`** is accepted by the Checkout API for a Gambia business wallet (public docs show only XOF).
2. Wave issues a **production API key** (Checkout scope, request signing on), a **request-signing secret**, and a **webhook signing secret**.
3. VPS **static egress IP** added to the API key's allow-list; the 15 Wave webhook **source IPs** allow-listed inbound (Nginx/firewall).
4. Real values set in `.env.production`; `PAYMENT_PROVIDER_INTEGRATION_READY=true`; API restarts cleanly.
5. `GET /admin/payments/health` shows Wave `configured: true`.
6. One successful **sandbox / live end-to-end**: create → pay → signed webhook → unlock → reconcile, plus the negative cases in `WAVE_DEPLOYMENT_AND_ROLLBACK.md` §4.

Until then, the `wave_payment_enabled` admin toggle is rejected by the backend with the exact missing item.

---

## 3. Non-payment items to confirm before a full release

These are **not** introduced by this branch; noting them so "ready for production" is an informed decision.

| Area | Status / action |
|---|---|
| `.env.production` (VPS) | The copy in this workspace is a UTF-16 placeholder stub. The real file on the VPS must contain a strong `JWT_SECRET` (≥32 chars, non-placeholder), `DATABASE_URL`, `CORS_ORIGIN` = the real admin origin, and (when arming Wave) the full `WAVE_*` block. It is git-ignored — never commit it. |
| Firebase / push | `apps/mobile/google-services.json` is absent (removed at v1.0.0 for the package rename). Remote push-token registration fails gracefully; add a fresh config for `gm.oceanbrown.gnm` before relying on push. Not a payment blocker. |
| Migrations on prod DB | Run `025` + `026` against a **restored copy of production** first (`WAVE_DEPLOYMENT_AND_ROLLBACK.md` §2). Could not be executed here (no Docker/Postgres in this environment). |
| Device attestation | Registration abuse protection is per-IP rate limiting only (documented `TODO` for App Attest / Play Integrity). Accepted risk at v1.0.0. |
| Legal pages | `https://gnm.oceanbrown.gm/privacy`, `/terms`, and a new `/refunds` must be live and reachable before Wave onboarding and store review. |
| CI | No `.github/workflows` — `pnpm typecheck && pnpm test && pnpm build` are run manually. Consider adding a CI gate. |
| Store policy | Wave must stay out of App Store / Google Play builds unless OceanBrown has written platform approval (`WAVE_ONBOARDING.md` §5). |

---

## 4. Recommendation

Merge `feat/wave-checkout-integration` and deploy it now — it is safe with Wave disabled and
tightens several existing weaknesses. Do **not** enable live Wave payments until every item in §2
is cleared and the §3 VPS/legal items are confirmed. Follow `WAVE_DEPLOYMENT_AND_ROLLBACK.md` for
the exact ordered rollout, and send `WAVE_API_ONBOARDING_REQUEST.md` to Wave to start §2.

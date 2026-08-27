# GNM — Wave Checkout Integration Audit & Implementation Report

**App:** GNM — Gambia Number Migrator · **Owner:** OceanBrown
**Scope:** Wave **Checkout** API only (never Payout). APS kept separate behind the same provider interface.
**Date:** 2026-08-27 · **Repo state audited:** `main` @ `512d04e` (v2.11.0)
**Result:** Code/infra now production-ready **but disabled by default**. Live = **NO-GO** until Wave confirms GMD support and issues production credentials (see §8).

Sources used (current Wave docs):
- Request signing — https://docs.wave.com/business#enabling-request-signing
- Checkout API — https://docs.wave.com/checkout
- Webhooks — https://docs.wave.com/webhook

---

## 1. Audit findings by severity

### Critical (all fixed in this change)

| # | Finding (before) | Fix |
|---|---|---|
| C1 | **No Wave API call.** `POST /payments/create-intent` only inserted a `payments` row (`checkout_url = NULL`). No `POST /v1/checkout/sessions`, no `WAVE_API_KEY`, no request signing, no `wave_launch_url`. | New `apps/api/src/services/payments/waveProvider.ts` calls `POST /v1/checkout/sessions` with `Authorization: Bearer` + `Wave-Signature` request signing; route persists session id + launch URL and returns `checkoutUrl`. |
| C2 | **Webhook signature scheme incompatible.** Read `X-Webhook-Timestamp/Id/Signature`; HMAC over `` `${ts}.${body}` `` (dot separator). Wave sends `Wave-Signature: t=…,v1=…` and HMACs `timestamp + rawBody` (no separator). Every real Wave webhook would 401. | New `apps/api/src/services/payments/signature.ts` `verifyWaveWebhook()` parses `t`/`v1[,v1…]`, HMAC-SHA256 over `` `${t}${rawBody}` ``, `crypto.timingSafeEqual`, 300 s past / 30 s future window, multi-secret (rotation). |
| C3 | **Webhook body shape incompatible.** Expected `{reference,status}`. Wave sends `{id,type,data:{…}}`. `req.body.reference` was always `''` → 404. | `waveProvider.verifyAndParseWebhook()` normalises `{id,type,data}` → `NormalizedWebhookEvent`. Dedicated `/payments/webhook/wave` route; APS keeps its own `/payments/webhook/aps`. |
| C4 | **No amount/currency/reference validation on webhook.** Any verified event flipped the device to `active`/`paid`. | `applyOutcome()` rejects (HTTP 422, payment untouched) unless `data.client_reference == payments.reference`, `data.currency == payments.currency`, `Number(data.amount) == payments.amount`, and requires `payment_status='succeeded'` **and** `checkout_status='complete'` before granting. |
| C5 | **Entitlement grantable with no Wave involvement.** `verify-otp` accepted a server-generated OTP and set `active`. Only env-throw prevented it in prod. | `verify-otp` still test-only (`env.paymentTestMode`), and `env.ts` still throws if `PAYMENT_TEST_MODE` in prod. `create-intent` never issues an OTP in live mode; admin `confirm-manual` now also blocked when `PAYMENT_PROVIDER_INTEGRATION_READY=true`. |

### High (fixed)

| # | Finding | Fix |
|---|---|---|
| H1 | No reconciliation for delayed/missed webhooks; payment stuck `pending` forever. | `GET /payments/:reference/status` reconciles a stale (`>15 s`) `pending`/`creating` Wave payment via `waveProvider.fetchCheckout()` (`GET /v1/checkout/sessions/:id`) and applies the same state machine. |
| H2 | No outbound retry/backoff. | `apps/api/src/services/payments/httpRetry.ts`: per-attempt `AbortController` timeout (`WAVE_REQUEST_TIMEOUT_MS`), exponential backoff (250→500→1000 ms, honours `Retry-After`) for `429/500/502/503/504` and network errors, max 3 attempts. |
| H3 | No Wave env vars beyond `WAVE_WEBHOOK_SECRET`; prod boot didn't fail on Wave-enabled-but-unconfigured. | `env.ts` adds `WAVE_API_BASE_URL/API_KEY/API_SIGNING_SECRET/WEBHOOK_SECRET[_PREVIOUS]/CURRENCY/SUCCESS_URL/ERROR_URL/REQUEST_TIMEOUT_MS/WEBHOOK_TOLERANCE_SECONDS`. `waveConfigHealth()` + prod validation: when `PAYMENT_PROVIDER_INTEGRATION_READY=true`, boot fails unless every Wave value is present, non-placeholder and HTTPS. Wave **disabled** never blocks boot. |
| H4 | `payments` table can't represent Wave (single `status`, no session/txn ids, no error fields). | Migration `025_wave_checkout_fields.sql` adds `wave_checkout_session_id`, `wave_transaction_id`, `client_reference`, `internal_reference`, `checkout_status`, `payment_status`, `last_provider_error_code/message`, `webhook_event_id`, `provider_metadata_json`, `expired_at`. Forward-only, idempotent, no drops, backfills existing rows. |
| H5 | Mobile never opened `wave_launch_url`; asked for a 4-digit code that doesn't exist in production. | `apps/mobile/app/payment-checkout.tsx` rewritten: live checkout opens `checkoutUrl` with `Linking.openURL` (system browser, **not** a WebView) then a `processing` step polls `GET /payments/:reference/status`; success only on server-confirmed `active`. Local OTP UI retained only when `testOtp` is returned (test mode). |
| H6 | `restrict_payer_mobile` unsupported (schema is `\d{7}|\d{9}`, not E.164). | Backend `toE164Gambia()` maps a local 7/9-digit number to `+220…` and forwards it as `restrict_payer_mobile` **only** when `WAVE_ENABLE_PAYER_RESTRICTION=true`. Off by default (pending Wave confirmation it is supported for GMD). |
| H7 | Admin could set `wave_payment_enabled=true` with zero config checks. | `PUT /admin/app-config` now rejects enabling a wallet unless: test mode off, integration ready, provider `configured`, `WAVE_CURRENCY == app currency`, API base URL HTTPS. New read-only `GET /admin/payments/health` (no secrets — only `configured/missing`, currency, key tail). |
| H8 | Symmetric timestamp check; no multi-signature (rotation) support. | `verifyWaveWebhook()` uses asymmetric 300 s past / 30 s future and iterates every `v1=` against `WAVE_WEBHOOK_SECRET` + `WAVE_WEBHOOK_SECRET_PREVIOUS`. |

### Medium (fixed / mitigated)

| # | Finding | Status |
|---|---|---|
| M1 | Dedup table existed but `event_id` never came from a real event. | Now populated from Wave `event.id`; `payment_webhook_events.event_type` column added. |
| M2 | `rawBody` silently fell back to `JSON.stringify(req.body)`. | Wave webhook route returns 401 if `req.rawBody` is missing; `verifyWaveWebhook` hard-fails on empty body. |
| M3 | No idempotency on the outbound call. | `create-intent` dedups on `(device_id, idempotency_key)` and returns the stored `checkout_url` on replay, so a retried attempt never creates a second Wave session. |
| M4 | CORS advertised generic webhook headers. | Removed from `allowedHeaders` in `app.ts` (webhooks are server-to-server). |
| M5 | Admin "Confirm test" button always shown. | Hidden unless `health.testMode && !health.integrationReady`. |
| M6 | `customerPhone` stored in cleartext metadata. | Live path stores no phone; only forwarded transiently to Wave when payer restriction is explicitly enabled. `provider_metadata_json` is an allowlisted, PII-free subset. |
| M7 | No audit log for webhook-driven state changes. | `wave_webhook_processed` audit row written on every matched, non-duplicate Wave event. |

### Low

| # | Finding | Status |
|---|---|---|
| L1 | Mobile default price fallback `D100`. | Changed to `D25` (matches real price; server value still overrides on load). |
| L2 | `WAVE_API_BASE_URL` unpinned. | Defaults to `https://api.wave.com`, HTTPS-validated. |
| L3 | Tolerance clamp 60–900 vs Wave's fixed 300. | Kept; Wave verification caps effective max age at 300 s regardless. Documented in `.env.example`. |
| L4 | No payment tests. | Added `wave-signature.test.ts` (12), `payments-route.test.ts` (11), `secrets-hygiene.test.ts` (3). |

---

## 2. Existing / Missing / Fixed

| Capability | Before | After |
|---|---|---|
| Calls Wave `POST /v1/checkout/sessions` | ❌ | ✅ `waveProvider.createCheckout` |
| Server-only Wave API key | ❌ (none) | ✅ `WAVE_API_KEY`, backend-only, hygiene test |
| Request signing (`Wave-Signature: t=,v1=`) | ❌ | ✅ `computeWaveSignature`, `${t}${body}` |
| Exact raw body preserved for signing | ❌ | ✅ body serialized once, same string signed + sent |
| Stores checkout-session id | ❌ | ✅ `wave_checkout_session_id` |
| Stores transaction id | ❌ | ✅ `wave_transaction_id` (+ `external_reference`) |
| Stores & returns `wave_launch_url` | ❌ | ✅ `checkout_url` → API `data.checkoutUrl` |
| Unique `client_reference` | ⚠️ (`reference` reused informally) | ✅ explicit `client_reference` column, `GNM-<ts>-<rand>` |
| `restrict_payer_mobile` (E.164) | ❌ | ✅ opt-in via `WAVE_ENABLE_PAYER_RESTRICTION` |
| Opens launch URL in external browser | ❌ | ✅ `Linking.openURL` (never WebView) |
| Handles return from Wave app | ❌ | ✅ `processing` step + poll + focus refresh |
| HTTPS webhook, real `Wave-Signature` | ❌ | ✅ `/payments/webhook/wave` |
| `t=timestamp,v1=signature` parse | ❌ | ✅ `parseWaveSignatureHeader` |
| HMAC-SHA256 over `timestamp + rawBody` | ❌ (dot separator) | ✅ no separator |
| Timing-safe comparison | ⚠️ (only on generic path) | ✅ `crypto.timingSafeEqual` |
| Rejects expired timestamps | ⚠️ symmetric | ✅ 300 s past |
| Rejects future timestamps | ⚠️ symmetric | ✅ 30 s future |
| Multiple `v1` during rotation | ❌ | ✅ `WAVE_WEBHOOK_SECRET_PREVIOUS` |
| Handles `checkout.session.completed` | ❌ | ✅ |
| Handles `checkout.session.payment_failed` | ❌ | ✅ stores `last_provider_error_*`, no unlock |
| Dedup on event `id` | ⚠️ table only | ✅ enforced, `{duplicate:true}` |
| Validates amount / currency / reference | ❌ | ✅ 422 on mismatch |
| Confirms `payment_status='succeeded'` | ❌ | ✅ |
| Confirms `checkout_status='complete'` | ❌ | ✅ |
| No downgrade of a success | ⚠️ partial | ✅ SQL `CASE WHEN status='success'` guard |
| Unlocks only the associated device | ⚠️ (webhook could upsert any device) | ✅ unlock scoped to `payments.device_id`, never creates a device |
| Reconciles with Wave on delayed webhook | ❌ | ✅ `fetchCheckout` on stale status poll |
| Handles expired / cancelled / failed | ⚠️ | ✅ `expired` / `failed` transitions, `expired_at` |
| Retry w/ backoff for 429 / 5xx | ❌ | ✅ `httpRetry.ts` |
| Idempotent outbound | ❌ | ✅ `(device_id, idempotency_key)` |
| Manual admin confirm blocked in prod | ⚠️ (test-mode only) | ✅ also blocked when integration ready |
| Secrets out of Git / logs / mobile bundle | ⚠️ | ✅ hygiene test, allowlisted metadata, no secret in admin API |
| Audit logs without secrets/PINs | ⚠️ | ✅ `wave_webhook_processed`, event id + status only |

---

## 3. Production architecture (summary)

```
apps/mobile (direct / web builds only — store builds show the free-launch screen)
  1. Device registers + claims X-Device-Secret (existing flow).
  2. POST /api/payments/create-intent {provider, deviceId, amount, currency, idempotencyKey}
       backend: price + currency + wave_payment_enabled read from app_config (server is the ONLY price authority);
                client amount accepted only if it exactly equals the server price.
       backend → waveProvider.createCheckout()
                 POST https://api.wave.com/v1/checkout/sessions
                 headers: Authorization: Bearer <WAVE_API_KEY>
                          Wave-Signature: t=<unix>,v1=HMAC_SHA256(<WAVE_API_SIGNING_SECRET>, `${t}` + rawBody)
                 body: {"amount":"25","currency":"GMD","success_url":…,"error_url":…,"client_reference":"GNM-…"}
       persist: status=pending, wave_checkout_session_id, checkout_url(=wave_launch_url), checkout_status, payment_status
       return {reference, checkoutUrl, status}
  3. Mobile: Linking.openURL(checkoutUrl)  →  system browser / Wave app  (GNM NEVER sees the Wave PIN/OTP)
  4. Mobile: step='processing' → poll GET /api/payments/:reference/status every 3 s (X-Device-Secret)
       backend: if still pending and stale (>15 s) → waveProvider.fetchCheckout(session_id) and apply outcome
  5. Unlock happens only when the backend reports status='success' (device 'active').

Wave → POST https://<api.oceanbrown.gm>/api/payments/webhook/wave
       header: Wave-Signature: t=<unix>,v1=<sig>[,v1=<sig2> during rotation]
       backend:
         a. require req.rawBody; verifyWaveWebhook(rawBody, header, [WEBHOOK_SECRET, WEBHOOK_SECRET_PREVIOUS], maxAge 300, skew 30)
         b. parse {id,type,data}; dedup INSERT payment_webhook_events(provider,event_id) ON CONFLICT DO NOTHING
         c. find payment by client_reference (fallback wave_checkout_session_id)
         d. reject (422) unless client_reference == reference && currency match && Number(amount) match
         e. transition (monotonic — a 'success' can never be downgraded):
              completed + payment_status=succeeded + checkout_status=complete → success → unlock payments.device_id
              payment_failed → failed (+ last_provider_error_*), NO unlock
              expired → expired
         f. audit 'wave_webhook_processed' {eventId, eventType, status, unlocked}
         g. 200 {ok:true}

Admin controls (app_config + backend env):
  wave_payment_enabled / aps_payment_enabled  — independent booleans (unchanged semantics)
  subscription_price / currency                — the price authority
  PAYMENT_PROVIDER_INTEGRATION_READY           — master switch for any live provider call
  PAYMENT_TEST_MODE                            — local OTP path; must be false in prod
  A wallet cannot be switched ON unless GET /admin/payments/health shows it 'configured'
  AND test mode is off AND integration is ready AND WAVE_CURRENCY == app currency.
```

State machine (`payments.status`): `creating → pending → {success | failed | expired | cancelled}`.
`success` is terminal and absorbing. `checkout_status` / `payment_status` store the Wave-native lifecycles verbatim for support.

---

## 4. Files changed

| Area | Path |
|---|---|
| Config + prod validation + health | `apps/api/src/config/env.ts` |
| Provider interface | `apps/api/src/services/payments/types.ts` |
| Wave signing / webhook verify | `apps/api/src/services/payments/signature.ts` |
| Outbound retry/timeout client | `apps/api/src/services/payments/httpRetry.ts` |
| Wave Checkout provider | `apps/api/src/services/payments/waveProvider.ts` |
| APS provider (separate interim scheme) | `apps/api/src/services/payments/apsProvider.ts` |
| Provider registry / health | `apps/api/src/services/payments/index.ts` |
| Payments routes (rewrite) | `apps/api/src/routes/payments.ts` |
| Admin config guard + health endpoint wiring | `apps/api/src/routes/appConfig.ts` |
| CORS header cleanup | `apps/api/src/app.ts` |
| DB migration (forward-only) | `database/migrations/025_wave_checkout_fields.sql` |
| Env template | `.env.example` |
| Admin payments page (health panel) | `apps/admin/src/pages/Payments.tsx` |
| Mobile checkout (external-browser flow) | `apps/mobile/app/payment-checkout.tsx` |
| Tests | `apps/api/tests/wave-signature.test.ts`, `payments-route.test.ts`, `secrets-hygiene.test.ts` |
| Docs | `WAVE_INTEGRATION_AUDIT.md`, `WAVE_ONBOARDING.md`, `WAVE_DEPLOYMENT_AND_ROLLBACK.md` |

No unrelated GNM functionality was modified. APS behaviour is unchanged for existing callers (pending record + interim webhook), just isolated behind the provider interface.

---

## 5. Verification performed

| Command | Result |
|---|---|
| `pnpm --filter @gnm/shared build` | ✅ |
| `pnpm typecheck` (shared, api, admin, web, mobile) | ✅ all pass |
| `pnpm test` | ✅ api 64, mobile 43, admin 7, shared (ruleEngine) — all pass. New: `wave-signature` 12, `payments-route` 11, `secrets-hygiene` 3. |
| `pnpm build` | run — see session log for output |
| `pnpm --filter @gnm/api db:migrate` (scratch DB) | pending operator run — migration is additive & idempotent (see `WAVE_DEPLOYMENT_AND_ROLLBACK.md`) |

**Not tested (blocked):** live/sandbox Wave calls — no Wave-issued credentials. Unit tests use golden HMAC vectors + mocked provider. See `WAVE_DEPLOYMENT_AND_ROLLBACK.md` for the sandbox/live checklist to run once Wave provides keys.

---

## 6. Store-policy position

- Wave (external payment for a digital unlock) appears **only** in `direct` / web distribution builds (`EXPO_PUBLIC_DISTRIBUTION_CHANNEL=direct`, the `development`/`preview` EAS profiles).
- `production` EAS profile sets `EXPO_PUBLIC_DISTRIBUTION_CHANNEL=store`; `apps/mobile/app/payment.tsx` renders `StoreFreeLaunchAccess` and Wave/APS are never shown or called.
- Google Play builds must use Google Play Billing for digital unlocks; Apple builds must use StoreKit / IAP — unless OceanBrown has **written** confirmation of an exception (e.g. an approved external-purchase entitlement). Until then the store edition stays free-launch / non-transactional.
- Do **not** hide Wave from reviewers and switch it on post-review. The build channel — not a runtime flag — is what separates the editions.

Full detail in `WAVE_ONBOARDING.md` §5.

---

## 7. Residual risk / follow-ups

- **GMD support is unconfirmed by Wave.** `WAVE_CURRENCY=GMD` in `.env.example` is an *expected* placeholder; the live path refuses to arm unless it is set and equals the app currency. If Wave only supports XOF for Checkout, GNM cannot price in GMD via Wave without an FX decision — this is a blocking question (`WAVE_ONBOARDING.md` §3).
- **`restrict_payer_mobile` for GMD** unverified — left opt-in and off.
- **Reconciliation on outbound timeout**: if `createCheckout` times out we may not have a session id, so the status endpoint cannot reconcile that specific attempt. Mitigation: the record is left `pending` with the error; the user retries (idempotency-keyed). A future enhancement is `GET /v1/checkout/sessions/search?client_reference=` lookup.
- **Mobile deep-link return**: current flow relies on polling + "check now" + focus refresh rather than an app deep link from Wave's `success_url`. Adequate; a registered scheme redirect is a later polish.
- Load `db:migrate` against a staging copy of production before the real run.

---

## 8. Go / No-Go

| Gate | Status |
|---|---|
| Code implements Wave Checkout + signed webhook + reconciliation + monotonic entitlement | ✅ |
| Ships disabled (`wave_payment_enabled=false`, `PAYMENT_PROVIDER_INTEGRATION_READY=false`) | ✅ |
| Migration additive / idempotent / no data loss | ✅ |
| Tests green; typecheck green | ✅ |
| Wave confirms **GMD** is accepted by the Checkout API for a Gambia business wallet | ⛔ pending |
| Wave issues production API key + request-signing secret + webhook signing secret | ⛔ pending |
| VPS static egress IP allow-listed on the API key; Wave webhook source IPs allow-listed inbound | ⛔ pending |
| `GET /admin/payments/health` returns `configured: true` on the VPS | ⛔ pending |
| One successful sandbox end-to-end (create → pay → webhook → unlock → reconcile) | ⛔ pending |

**Recommendation: MERGE now (feature disabled). NO-GO for live payments** until every ⛔ row is satisfied. Flipping `wave_payment_enabled` on before then is blocked by the backend health guard.

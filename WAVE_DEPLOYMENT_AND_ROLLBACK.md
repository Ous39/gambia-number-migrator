# GNM — Wave Deployment, Testing & Rollback

Companion to `WAVE_INTEGRATION_AUDIT.md` and `WAVE_ONBOARDING.md`.
Order of operations: **migrate → deploy code (Wave still disabled) → configure secrets → sandbox test → arm → enable wallet → live test → monitor.**

---

## 1. Environment variables (VPS `.env.production` only)

```env
PAYMENT_TEST_MODE=false
PAYMENT_PROVIDER_INTEGRATION_READY=false     # keep false until sandbox test passes

WAVE_API_BASE_URL=https://api.wave.com
WAVE_API_KEY=                                 # wave_sn_prod_… from Wave portal
WAVE_API_SIGNING_SECRET=                      # wave_sn_AKS_… shown once at key creation
WAVE_WEBHOOK_SECRET=                          # shown once at webhook registration
WAVE_WEBHOOK_SECRET_PREVIOUS=                 # only during rotation
WAVE_CURRENCY=GMD                             # only once Wave confirms GMD; must equal app_config.currency
WAVE_SUCCESS_URL=https://gnm.oceanbrown.gm/payment/success
WAVE_ERROR_URL=https://gnm.oceanbrown.gm/payment/error
WAVE_REQUEST_TIMEOUT_MS=10000
WAVE_WEBHOOK_TOLERANCE_SECONDS=300
WAVE_ENABLE_PAYER_RESTRICTION=false           # only if Wave confirms restrict_payer_mobile for GMD
```

Rules:
- These live **only** in `.env.production` on the VPS (git-ignored). Never in Expo env, mobile source, CI logs, screenshots or docs.
- With `PAYMENT_PROVIDER_INTEGRATION_READY=true`, the API **refuses to boot** unless every Wave value above is present, non-placeholder and HTTPS (`apps/api/src/config/env.ts` → `waveConfigHealth()`).
- With it `false`, Wave being unconfigured never blocks boot — the rest of the API runs normally.

---

## 2. Database migration

Migration: `database/migrations/025_wave_checkout_fields.sql` — forward-only, idempotent, **no drops, no deletes**, backfills `internal_reference` / `client_reference` from `reference`.

```bash
# 1. Back up production first
pg_dump "$DATABASE_URL" -Fc -f gnm_pre_025_$(date +%Y%m%d).dump

# 2. Dry-run against a restored copy
createdb gnm_migrate_test
pg_restore -d gnm_migrate_test gnm_pre_025_*.dump
DATABASE_URL=postgres://…/gnm_migrate_test pnpm --filter @gnm/api db:migrate
DATABASE_URL=postgres://…/gnm_migrate_test pnpm --filter @gnm/api db:verify-migrations

# 3. Apply to production (the API container also runs this on start:
#    "pnpm --filter @gnm/api db:migrate && pnpm --filter @gnm/api start")
pnpm --filter @gnm/api db:migrate
```

Re-running is safe: `schema_migrations` records `025_wave_checkout_fields.sql`; every statement is
`IF NOT EXISTS` / `DROP CONSTRAINT IF EXISTS` / guarded.

---

## 3. Production deployment checklist

- [ ] `git pull` the release; `pnpm install --frozen-lockfile`
- [ ] `pnpm --filter @gnm/shared build && pnpm typecheck && pnpm test` — all green
- [ ] Back up DB (§2.1); run migration `025` (§2)
- [ ] Deploy API/Admin/Web containers (`docker compose -f docker-compose.production.yml up -d --build`)
- [ ] Confirm API boots with `PAYMENT_PROVIDER_INTEGRATION_READY=false` and Wave blank → **no boot error**
- [ ] `curl https://api.oceanbrown.gm/api/health` → 200
- [ ] Admin → Payments → **Provider configuration health**: Wave shows `Missing: WAVE_API_KEY, …` (expected while disabled)
- [ ] **Nginx / firewall:** allow inbound POST to `/api/payments/webhook/wave` from the 15 Wave source IPs (`WAVE_ONBOARDING.md` §1); everything else may stay as-is
- [ ] Register the webhook in the Wave portal → `https://api.oceanbrown.gm/api/payments/webhook/wave`, **Signing Secret** strategy, events `checkout.session.completed` + `checkout.session.payment_failed`
- [ ] Add the VPS **static egress IP** to the API key's IP allow-list in the Wave portal
- [ ] Put real values in `.env.production`: `WAVE_API_KEY`, `WAVE_API_SIGNING_SECRET`, `WAVE_WEBHOOK_SECRET`, `WAVE_CURRENCY=GMD` (only if Wave confirmed), success/error URLs
- [ ] Set `PAYMENT_PROVIDER_INTEGRATION_READY=true`; restart API; confirm it **boots** (fails loudly if any Wave var is missing/placeholder)
- [ ] Admin → Payments health: Wave now `Configured: true`, currency `GMD`, key tail shown
- [ ] Run the **sandbox/live test** (§4)
- [ ] Only then: Admin → App configuration → enable **Wave**. The backend rejects this with a reason if health is not green.
- [ ] Verify a real D25 payment end-to-end on a direct/preview build (not a store build)
- [ ] Monitor `audit_logs` for `wave_webhook_processed`, and `payments` for stuck `pending`

---

## 4. Sandbox / live testing checklist

Run once Wave answers "sandbox?" (`WAVE_ONBOARDING.md` §3 Q3). If no sandbox, use the smallest live amount Wave allows and refund.

**Create checkout**
- [ ] `POST /api/payments/create-intent` (with a valid `X-Device-Secret`) returns `201` with `data.checkoutUrl` (a `wave_launch_url`) and `data.status = "pending"`
- [ ] `payments` row: `wave_checkout_session_id` set, `checkout_status = "open"`, `client_reference = reference`
- [ ] Sending `amount: 1` (≠ server price) → `400`; sending an unknown `provider` → `400`; Wave disabled in `app_config` → `403`

**Signed request**
- [ ] Outbound request carries `Authorization: Bearer …` and `Wave-Signature: t=…,v1=…`; Wave accepts it (no `signature`/`ip-not-allowed` error)

**Pay + webhook**
- [ ] Open `checkoutUrl` on a phone, pay with a test/real Wave account
- [ ] Wave POSTs `checkout.session.completed` to the webhook; API returns `200 {ok:true}`
- [ ] `payments.status = "success"`, `payment_status = "succeeded"`, `checkout_status = "complete"`, `wave_transaction_id` set, `paid_at` set
- [ ] `devices.status = "active"`, `access_source = "paid"` for **that device only**
- [ ] `audit_logs` has `wave_webhook_processed` with the event id (no secrets/PINs)
- [ ] Re-POST the same event body → `200 {duplicate:true}`, no second unlock

**Signature negatives** (curl, see below)
- [ ] Wrong `v1` → `401`; timestamp > 5 min old → `401`; body altered after signing → `401`
- [ ] Tampered `amount` in a correctly-signed body → `422`, payment untouched

**Failure + reconciliation**
- [ ] Trigger `checkout.session.payment_failed` (insufficient funds) → `payments.status = "failed"`, `last_provider_error_code/message` set, device **not** unlocked
- [ ] Let a session expire (30 min) → status poll reflects `expired`, `expired_at` set
- [ ] Delay/withhold the webhook: after ~15 s call `GET /api/payments/:reference/status` → backend calls `GET /v1/checkout/sessions/:id` and reconciles to the true state

**Mobile**
- [ ] Preview/direct build: Pay → system browser (not a WebView) opens `checkoutUrl`; app shows "Approve the payment in Wave"; after paying, polling flips to the success screen
- [ ] Store build (`EXPO_PUBLIC_DISTRIBUTION_CHANNEL=store`): payment screen shows free-launch only; no `create-intent` call in the network log
- [ ] App never shows a field asking for a Wave PIN/OTP in live mode

**Curl — simulate a signed webhook locally**
```bash
BODY='{"id":"EV_test1","type":"checkout.session.completed","data":{"id":"cos-x","client_reference":"<REFERENCE>","amount":"25","currency":"GMD","payment_status":"succeeded","checkout_status":"complete","transaction_id":"T1"}}'
T=$(date +%s)
SIG=$(printf '%s%s' "$T" "$BODY" | openssl dgst -sha256 -hmac "$WAVE_WEBHOOK_SECRET" -r | cut -d' ' -f1)
curl -sS -X POST https://api.oceanbrown.gm/api/payments/webhook/wave \
  -H 'Content-Type: application/json' -H "Wave-Signature: t=$T,v1=$SIG" --data "$BODY"
# expect: 200 {"ok":true,"matched":true,"status":"success",...}
```

**Do not** claim live payments work until a real end-to-end transaction (create → pay → webhook → unlock → reconcile) has succeeded against Wave-issued credentials.

---

## 5. Rollback

Rollback is layered — use the least invasive that resolves the issue.

| Situation | Action | Effect |
|---|---|---|
| Payments misbehaving, want them off **now** | Admin → App configuration → **disable Wave** (`wave_payment_enabled=false`). No deploy. | Mobile stops offering Wave; `create-intent` returns `403`. Existing paid devices keep access. |
| Need to stop **all** live provider calls | Set `PAYMENT_PROVIDER_INTEGRATION_READY=false` in `.env.production`; restart API. | `create-intent` in production returns `503`; no outbound Wave calls. Webhook still verifies + records (safe). |
| Bad code release | Redeploy the previous API image tag. Migration `025` is additive — **leave it in place** (new columns are simply unused by old code). | Full revert of behaviour; no schema rollback needed. |
| Need to fully remove schema (rare) | Only if truly required: `ALTER TABLE payments DROP COLUMN …` for the 025 columns and restore the pre-025 `ck_payments_status`. Prefer restoring `gnm_pre_025_*.dump` to a fresh DB. | Destructive — avoid; the columns are harmless when unused. |
| Webhook secret compromised | Portal: duplicate webhook (new secret) → set `WAVE_WEBHOOK_SECRET_PREVIOUS`=old, `WAVE_WEBHOOK_SECRET`=new → verify both accepted → delete old webhook → clear `_PREVIOUS`. | Zero-downtime rotation. |
| Suspect a wrong device was unlocked | Query: `SELECT p.reference, p.device_id, p.status, d.status, d.access_source FROM payments p JOIN devices d ON d.id=p.device_id WHERE p.status='success' ORDER BY p.paid_at DESC;` Cross-check each `wave_transaction_id` in the Wave portal. Manually correct `devices` for any mismatch and note it. | The webhook only ever touches `payments.device_id`, so a mismatch implies a data issue, not a logic path. |

Post-rollback: confirm `GET /api/health` is 200, Admin loads, and non-payment flows (registration, trial, migration rules) are unaffected — the payments module is isolated and its failure must not take the API down.

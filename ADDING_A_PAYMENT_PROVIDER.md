# Adding / completing a payment provider (APS or a new one)

GNM's payment layer is provider-agnostic. Wave and APS are just two implementations of one
interface, and the route/DB/admin/mobile code never contains provider-specific wire formats.
Adding a real APS integration — or a third provider — means writing **one file** and touching a
small, well-defined set of call sites. Nothing about Wave changes.

---

## 1. The contract

`apps/api/src/services/payments/types.ts` — `interface PaymentProvider`:

| Member | Responsibility |
|---|---|
| `id` | `'wave' \| 'aps'` (extend the `ProviderId` union for a new one) |
| `enabledConfigKey` | the `app_config` boolean the admin toggles, e.g. `'aps_payment_enabled'` |
| `health()` | returns `{ configured, missing[], currency, apiKeyTail, testMode, integrationReady }` — **never a secret**. Used by prod boot validation, `GET /admin/payments/health`, and the enable-guard |
| `createCheckout(input)` | call the provider's "create hosted payment" API; return a `CheckoutResult` (`providerSessionId`, `checkoutUrl`, `checkoutStatus`, `paymentStatus`, …). Sign the request; reuse the **exact** serialized body you signed |
| `fetchCheckout(providerSessionId)` | GET the session for reconciliation; return a `CheckoutResult` |
| `verifyAndParseWebhook(rawBody, headers)` | verify the provider's signature over the **raw body**; return a `NormalizedWebhookEvent` or `null` |

Everything downstream (`applyOutcome()` in `routes/payments.ts`) works purely off `CheckoutResult`
/ `NormalizedWebhookEvent`, so the state machine, amount/currency/reference validation, dedup,
monotonic "no downgrade", device-scoped unlock, audit logging and reconciliation are **shared** and
identical for every provider.

Reusable helpers already in `apps/api/src/services/payments/`:
- `httpRetry.ts` → `requestWithRetry()` — per-attempt `AbortController` timeout + exponential
  backoff for `429`/`5xx`/network errors. Use for all outbound calls.
- `signature.ts` — Wave's `t=,v1=` HMAC scheme. **Only** reuse this if the new provider genuinely
  uses the same construction; otherwise write the provider's own verify function next to its file.
- `ProviderError` — throw with `{ status, code, retryable }`; the route maps it to an HTTP response
  and records `last_provider_error_code/message` without unlocking anything.

---

## 2. Steps to complete APS (real integration)

Current state: `apps/api/src/services/payments/apsProvider.ts` is a **working stub** — it produces a
`pending` payment with no redirect URL and verifies an interim `X-Webhook-*` scheme. It is already
registered, isolated from Wave, and disabled by default (`aps_payment_enabled=false`). To make it
real you need APS's API documentation, then:

1. **Config / env** (`apps/api/src/config/env.ts`)
   - Add `apsApiBaseUrl`, `apsApiKey`, `apsApiSecret`, `apsWebhookSecret` (exists), `apsCurrency`,
     any `apsMerchantId`.
   - Add an `apsConfigHealth()` mirroring `waveConfigHealth()`.
   - In the `NODE_ENV === 'production'` block: when `PAYMENT_PROVIDER_INTEGRATION_READY` is true and
     APS is the enabled provider, require the APS vars to be present/HTTPS (copy the Wave pattern).
     APS being disabled must never block boot.

2. **`apsProvider.ts`**
   - `health()` → return `apsConfigHealth()` shaped as `ProviderHealth`.
   - `createCheckout()` → build the request body, sign it per APS's scheme, `requestWithRetry({...})`
     to APS's create endpoint, map the response to `CheckoutResult`. If APS has no hosted page,
     keep `checkoutUrl: ''` and the mobile app will show the "complete with your provider" path.
   - `fetchCheckout()` → GET APS's status endpoint → `CheckoutResult` (drop the current
     `aps_reconcile_unsupported` throw once implemented).
   - `verifyAndParseWebhook()` → verify APS's real signature header over `rawBody` with
     `crypto.timingSafeEqual`; map APS's event/status names into `NormalizedWebhookEvent`
     (`outcome: 'completed' | 'failed' | 'expired' | 'pending' | 'ignored'`, plus
     `clientReference`, `amount`, `currency`, `paymentStatus`, `checkoutStatus`,
     `providerTransactionId`, `errorCode/Message`). Keep this **entirely separate** from
     `signature.ts` unless APS uses the identical `t=,v1=` HMAC.

3. **Routes** (`apps/api/src/routes/payments.ts`)
   - `create-intent` is already provider-generic (`getProvider(provider).createCheckout(...)`) — no
     change needed.
   - The APS webhook route `/payments/webhook/aps` already exists and calls
     `getProvider('aps').verifyAndParseWebhook(...)` then the shared `applyOutcome()`. If APS needs
     extra headers exposed, add them to `lowerCaseHeaders`.
   - `:reference/status` reconciliation currently only fires for `provider === 'wave'`. Change that
     guard to `['wave','aps'].includes(payment.provider)` once `apsProvider.fetchCheckout()` works.

4. **Enable-guard** (`apps/api/src/routes/appConfig.ts`)
   - `providerEnableBlockReason()` already handles any `ProviderId`. Add APS-specific checks inside
     the `if (id === 'aps')` branch (e.g. `apsCurrency === effectiveCurrency`).

5. **DB** — the `025` columns are provider-neutral (`wave_checkout_session_id` doubles as the
   session id for any provider; `wave_transaction_id` as the txn id). If you prefer clean names,
   add a `027_provider_columns_rename.sql` that adds `provider_session_id` / `provider_transaction_id`
   as generated-or-copied columns — **forward-only, no drops**. Not required to ship.

6. **`.env.example`** — add the empty `APS_*` placeholders next to the Wave block.

7. **Admin** — `apps/admin/src/pages/Payments.tsx` already renders health for `['wave','aps']`
   generically; no change. `AppConfig.tsx` already has the APS enable toggle.

8. **Mobile** — `apps/mobile/app/payment-checkout.tsx` already handles APS: it's in the provider
   picker, and the checkout branch keys off whether the API returns a `checkoutUrl` (open browser +
   poll) or not (show "payment pending", poll). No change unless APS returns a redirect URL, which
   already works.

9. **Tests** — copy `apps/api/tests/wave-signature.test.ts` → `aps-signature.test.ts` with APS's
   golden vectors, and add APS cases to `payments-route.test.ts` (`getProvider` is already mocked
   per-id; return an `aps` fake). Add APS keys to `secrets-hygiene.test.ts`.

---

## 3. Adding a brand-new provider (e.g. "Foo Pay")

1. `types.ts` — `export type ProviderId = 'wave' | 'aps' | 'foo';`
2. New `apps/api/src/services/payments/fooProvider.ts` implementing `PaymentProvider`.
3. `index.ts` — add `foo: fooProvider` to `REGISTRY`; `allProviderHealth()` gains it automatically
   if you extend its return type.
4. `env.ts` — `foo*` vars + `fooConfigHealth()` + prod validation branch.
5. `002/019`-style migration to seed `('foo_payment_enabled','false'::jsonb)` and add `'foo'` to the
   `payment_webhook_events.provider` CHECK and any `payments.provider` CHECK.
6. `appConfig.ts` — add `'foo_payment_enabled'` to `allowedKeys` and the boolean check list;
   `providerEnableBlockReason` handles it via the generic path.
7. `routes/payments.ts` — add a `/payments/webhook/foo` route (copy the `aps` one) if Foo's webhook
   differs from Wave's; reuse `applyOutcome()`.
8. Mobile — add `'foo'` to the `Provider` type and `providerMeta` map in `payment-checkout.tsx`,
   plus a logo asset.
9. Tests + `.env.example` + `WAVE_INTEGRATION_AUDIT.md`-style note.

The invariant to preserve for every provider: **the client never sets the price, access is granted
only on a verified provider confirmation with matching amount/currency/reference, a success is never
downgraded, and only the paying device is unlocked.**

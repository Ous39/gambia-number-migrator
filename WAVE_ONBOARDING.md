# GNM ↔ Wave — Onboarding Pack

Companion to `WAVE_INTEGRATION_AUDIT.md`. Everything here is either **confirmed by current Wave
documentation** (docs.wave.com/business, /checkout, /webhook) or marked **[CONFIRM WITH WAVE]**.

---

## 1. What GNM needs from Wave

### Confirmed by Wave documentation

| Item | Detail | Where it goes in GNM |
|---|---|---|
| Wave **Business account** (Gambia) | Admin-level portal access for OceanBrown. | — |
| **Business wallet** | API keys are bound to a single business wallet; this is the settlement wallet. | — |
| **Production API key** | `Authorization: Bearer wave_sn_prod_…`. Create in Portal → Developer. Admin users only. | `WAVE_API_KEY` (VPS only) |
| **Checkout API access** on the key | Per-key API scoping — the key must be allowed to call the Checkout API. Payout is **not** required and must not be granted. | — |
| **Request-signing secret** | Enable "request signing" when creating the key; secret `wave_sn_AKS_…` shown **once**. HMAC-SHA256 over `` `${unixSeconds}` + rawBody ``, header `Wave-Signature: t=…,v1=…`. | `WAVE_API_SIGNING_SECRET` (VPS only) |
| **Webhook signing secret** | Register the webhook endpoint in Portal → Webhooks, choose **Signing Secret** strategy, secret shown **once**. Same HMAC construction as request signing. | `WAVE_WEBHOOK_SECRET` (VPS only) |
| **Webhook registration** | Endpoint: `https://api.oceanbrown.gm/api/payments/webhook/wave` (HTTPS, valid cert, responds < 5 s, returns 2xx). Subscribe to at least `checkout.session.completed` and `checkout.session.payment_failed`. | — |
| **Webhook source IPs** (inbound allow-list) | 15 `/32` addresses listed in docs.wave.com/webhook (104.155.43.220, 34.140.23.175, 34.22.138.147, 34.76.157.22, 34.78.253.137, 34.79.119.200, 35.189.207.30, 35.195.255.192, 35.205.122.113, 35.205.190.121, 35.233.61.130, 35.240.61.196, 35.240.75.65, 35.241.190.127, 35.241.219.1). | Nginx / firewall allow-list |
| **Static IP allow-listing** (outbound) | Optional per-key IP allow-list in the Portal (single IP or CIDR, min /8 IPv4). Rejected calls return `403 {"code":"ip-not-allowed"}`. | Add the VPS's static egress IP |
| **Timestamp tolerance** | Webhook/request: reject > 5 min old or > 30 s in the future. | Implemented (`WAVE_WEBHOOK_TOLERANCE_SECONDS=300`, 30 s skew) |
| **Retry policy** | Wave retries non-2xx for up to 3 days; events may duplicate / arrive out of order. | Dedup on `event.id`, monotonic state machine |
| **Secret rotation** | "Duplicate webhook" → two secrets live at once → header carries multiple `v1=`. | `WAVE_WEBHOOK_SECRET_PREVIOUS` |
| **Refunds** | `POST /v1/checkout/sessions/:id/refund` — idempotent, 200 on success. | Manual/ops for now (not automated) |
| **Session expiry** | 30 min after creation by default; `POST …/:id/expire` to force. | `expired` handling + `expired_at` |
| **Reconciliation** | `GET /v1/checkout/sessions/:id`, `?transaction_id=…`, or `/search?client_reference=…`. | `fetchCheckout()` used on stale status poll |
| **Rate limits** | Documented as "rate limited"; exact numbers not published → treat 429 as retryable. | Exponential backoff in `httpRetry.ts` |

### [CONFIRM WITH WAVE] — not settled by public docs

| Item | Why it matters |
|---|---|
| **GMD accepted by the Checkout API** for a Gambia business wallet | All public examples use **XOF**. GNM prices in **GMD (D25)**. If only XOF is supported, GNM cannot charge D25 via Wave without an FX/pricing decision. **BLOCKING.** |
| **Decimal handling for GMD** | XOF disallows decimals. Need the rule for GMD (`amount` is a string, 0–2 dp). |
| **`restrict_payer_mobile` for GMD numbers** | E.164 `+220…`; confirm it is honoured for Gambian Wave accounts. Left **off by default** in GNM. |
| **Sandbox / test environment** | Is there a sandbox base URL + test keys, or is testing done with small real amounts on production? Determines the test plan. |
| **Production approval / go-live checklist** | Any review, test transaction, or sign-off Wave requires before the key can take live money. |
| **Transaction fees & settlement** | Fee %, who bears it (payer vs merchant), settlement cadence and destination (Wave wallet vs bank), minimum payout. |
| **KYB requirements & timeline** | Exact documents and review time for a Gambian business (see §4). |
| **Dispute / chargeback process** | How a customer disputes, timeline, GNM's obligations. |
| **Rate-limit numbers** | Requests/second per key, for capacity planning. |
| **Technical contact / account manager** | Named contact + escalation path + support SLA. |
| **`aggregated_merchant_id`** | Only relevant if GNM must operate as a sub-merchant under an aggregator; confirm not required. |

---

## 2. What Wave needs from OceanBrown (onboarding checklist)

Prepare these before contacting Wave. **[CONFIRM]** = likely required for KYB but confirm the exact form.

**Business / legal**
- [ ] OceanBrown **Business Registration Certificate** (Gambia)
- [ ] **TIN certificate**
- [ ] Owner / director **government photo ID** (passport or national ID) for each beneficial owner/director **[CONFIRM: proof of address, selfie]**
- [ ] Registered **business address** + operating address
- [ ] Primary **business contact** (name, role, email, phone) and **technical contact**
- [ ] Bank / settlement account details **[CONFIRM if settlement is to a bank vs Wave wallet]**
- [ ] Existing **Wave Business wallet** identifier / phone

**Product / commercial**
- [ ] Product description: *GNM — Gambia Number Migrator. One-time "Contact Migration Pass" that unlocks bulk contact migration, duplicate cleanup, backup/restore and export for the 7→9 digit transition.*
- [ ] **Price:** D25 GMD, one-time, per device
- [ ] **Expected volume:** _____ transactions/day, _____ /month (fill in a realistic launch estimate, e.g. 50/day, 1,500/month, and a 6-month projection)
- [ ] Average ticket size: D25; refund rate expectation: low
- [ ] **Website:** https://gnm.oceanbrown.gm
- [ ] **Privacy Policy:** https://gnm.oceanbrown.gm/privacy
- [ ] **Terms & Conditions:** https://gnm.oceanbrown.gm/terms
- [ ] **Refund Policy** (publish one — see §6 template) and **customer-support** channel (email `info.oceanbrown@gmail.com`, phone/WhatsApp `+220 363 1776`)
- [ ] Screenshots / screen-recording of the payment flow (checkout screen → Wave hand-off → success)

**Technical**
- [ ] **Production API domain:** `https://api.oceanbrown.gm/api`
- [ ] **Webhook endpoint:** `https://api.oceanbrown.gm/api/payments/webhook/wave`
- [ ] **Static VPS egress IP:** `_____._____._____._____` (for the API key allow-list)
- [ ] **Success redirect:** `https://gnm.oceanbrown.gm/payment/success`
- [ ] **Error redirect:** `https://gnm.oceanbrown.gm/payment/error`
- [ ] **Security architecture note** (2–3 paragraphs): keys held only in `.env.production` on the VPS (git-ignored); API and Admin containers bound to `127.0.0.1`, single host Nginx with Let's Encrypt TLS; request signing + webhook signature verification with timing-safe comparison and replay window; entitlement granted only on a verified `checkout.session.completed` with matching amount/currency/reference; monotonic state machine; per-device secret on all payment endpoints; audit logging without secrets or PINs.
- [ ] **Customer complaint & refund process** description (who handles it, turnaround, how a refund is issued via `…/refund`).

---

## 3. Blocking questions for Wave Gambia

1. **Does the Checkout API accept `currency: "GMD"`** for a Gambia business wallet today? If not, what is the supported currency and the expected approach for a GMD-priced product?
2. For GMD, **are decimal places allowed** in `amount` (string, 0–2 dp), or integer-only like XOF?
3. Is there a **sandbox/test environment** (base URL + test credentials), or must we test with small live amounts on `https://api.wave.com`?
4. Is **`restrict_payer_mobile`** supported and enforced for Gambian (`+220`) Wave accounts on Checkout sessions?
5. What is the **production go-live process** — any review, mandatory test transaction, or sign-off before the key can take live payments?
6. **Fees & settlement:** fee percentage, payer- or merchant-borne, settlement destination (Wave wallet vs bank), settlement cadence, any minimum.
7. **KYB:** exact documents for a Gambian limited company, and typical review time.
8. **Disputes/chargebacks:** process, timelines, and GNM's obligations.
9. **Rate limits:** requests/second per API key for Checkout create + session GET.
10. Do we need an **`aggregated_merchant_id`** / to be a sub-merchant, or do we transact directly on our own wallet?
11. Confirm the **current webhook source IP list** and whether it changes; is there a notification channel for IP changes?
12. Recommended **webhook events** to subscribe to beyond `checkout.session.completed` / `checkout.session.payment_failed` (e.g. session expired)?
13. Is **request signing mandatory** once enabled on a key, and can a key without signing still call Checkout in production?
14. **Refunds:** partial refunds supported, or full only? Time limit after completion?
15. Named **technical contact / account manager** and support SLA for production incidents.

---

## 4. KYB / compliance checklist (expected)

| Category | Item | Status |
|---|---|---|
| Entity | Certificate of incorporation / business registration | ☐ |
| Entity | TIN / tax certificate | ☐ |
| Entity | Memorandum & Articles / constitution **[CONFIRM]** | ☐ |
| Entity | Proof of registered address (utility bill / lease) **[CONFIRM]** | ☐ |
| People | ID for each director & >25% beneficial owner | ☐ |
| People | Proof of address for directors **[CONFIRM]** | ☐ |
| Banking | Settlement bank statement / account confirmation **[CONFIRM]** | ☐ |
| Product | Website, Privacy Policy, T&Cs, Refund Policy all live and reachable | ☐ |
| Product | Accurate product & pricing description | ☐ |
| Risk | Expected volume, ticket size, refund/chargeback expectation | ☐ |
| Technical | Domain ownership of `oceanbrown.gm` | ☐ |
| AML | Sanctions/PEP declarations for owners **[CONFIRM]** | ☐ |

---

## 5. Store-policy separation (App Store / Google Play)

GNM's D25 payment unlocks **digital functionality**, so external payment (Wave/APS) is a store-policy concern.

| Build channel | `EXPO_PUBLIC_DISTRIBUTION_CHANNEL` | EAS profile | Payment UI |
|---|---|---|---|
| Direct APK / web | `direct` | `development`, `preview` | Wave + APS shown (when admin-enabled) |
| App Store / Google Play | `store` | `production` | **No Wave/APS.** `payment.tsx` renders `StoreFreeLaunchAccess`; no `create-intent` call is made |

Enforcement is the **build channel**, evaluated at `apps/mobile/app/payment.tsx:11`, not a runtime toggle:
```ts
if (process.env.EXPO_PUBLIC_DISTRIBUTION_CHANNEL !== 'store') return <PaymentCheckout />;
return <StoreFreeLaunchAccess />;
```

Rules:
- **Google Play:** digital goods must use Google Play Billing. Do not ship Wave in a Play build without a documented, Google-approved exception.
- **Apple App Store:** digital unlocks must use in-app purchase / StoreKit. Same — no Wave in an App Store build without a written Apple exception (e.g. an approved External Purchase Link entitlement in eligible regions).
- **Never** hide Wave from review and enable it afterwards. If OceanBrown obtains a written exception, record it here with the date and reference, and only then adjust the store build.
- The web and direct-APK channels are unaffected and may use Wave normally once live.

Current status: **no exception on file → store edition stays free-launch / non-transactional.**

---

## 6. Templates

### 6a. Refund Policy (publish at `https://gnm.oceanbrown.gm/refunds`, adjust to taste)

> **GNM Contact Migration Pass — Refund Policy.** The Pass is a one-time digital unlock of D25 (GMD).
> If your payment was charged but the Pass did not activate on your device, contact
> `info.oceanbrown@gmail.com` (or WhatsApp +220 363 1776) with your payment reference within 14 days;
> we will verify with the payment provider and either activate the Pass or refund the D25 in full.
> Because the Pass grants immediate access to digital features, refunds are otherwise granted only
> where required by law. Refunds are returned to the Wave account used for payment, normally within
> 5 business days of approval.

### 6b. Onboarding email to Wave

> **Subject:** API onboarding request — OceanBrown (GNM, The Gambia) — Checkout API
>
> Hello Wave Business team,
>
> I'm writing on behalf of **OceanBrown**, a registered business in The Gambia. We operate
> **GNM (Gambia Number Migrator)** — a mobile and web app that helps Gambians update their contacts
> for the 7‑digit → 9‑digit numbering change. We sell a single **one‑time "Contact Migration Pass"
> priced at D25 (GMD)** that unlocks bulk migration, duplicate cleanup, backup/restore and export.
>
> We would like to enable **Wave Checkout** (hosted payment sessions) as a payment option. We do
> **not** need the Payout API. Our integration is built and tested against your published Checkout,
> request‑signing and webhook specs; it is currently disabled pending your credentials and answers.
>
> **Our details**
> - Website: https://gnm.oceanbrown.gm · Privacy: https://gnm.oceanbrown.gm/privacy · Terms: https://gnm.oceanbrown.gm/terms
> - Production API: https://api.oceanbrown.gm/api
> - Webhook endpoint (HTTPS): https://api.oceanbrown.gm/api/payments/webhook/wave
> - Success/error URLs: https://gnm.oceanbrown.gm/payment/success , /payment/error
> - Static server egress IP for API‑key allow‑listing: `<VPS_PUBLIC_IP>`
> - Expected volume at launch: ~`<N>`/day, ~`<M>`/month; average ticket D25
> - Support: info.oceanbrown@gmail.com , +220 363 1776
>
> **What we need from you**
> 1. A **Business account** and **business wallet** for OceanBrown, and a **production API key scoped to the Checkout API** with **request signing enabled** (signing secret).
> 2. A **webhook signing secret** for the endpoint above, subscribed to `checkout.session.completed` and `checkout.session.payment_failed` (plus any you recommend).
> 3. Confirmation of **KYB documents** required for a Gambian company and the review timeline.
> 4. **Fees and settlement** terms (fee %, payer/merchant‑borne, settlement destination and cadence).
>
> **Blocking questions**
> 1. Does the **Checkout API accept `currency: "GMD"`** for a Gambia business wallet? If not, what do you recommend for a GMD‑priced product? Are decimals allowed for GMD amounts?
> 2. Is there a **sandbox/test environment** with test credentials, or do we test with small live amounts?
> 3. Is **`restrict_payer_mobile`** honoured for Gambian (`+220`) accounts on Checkout sessions?
> 4. What is the **production go‑live process** (any review or test transaction before the key can take live money)?
> 5. Please confirm the **current webhook source IP ranges** and how changes are communicated.
> 6. Who is our **technical contact / account manager**, and what is the production support SLA?
>
> We can share registration and TIN certificates, director ID, a demo of the payment flow, and our
> security architecture note on request. Thank you — we're keen to go live once GMD support and
> credentials are confirmed.
>
> Best regards,
> `<Name>`, OceanBrown — `<email>` · `<phone>`

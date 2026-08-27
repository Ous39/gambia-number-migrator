# Wave Business API — Onboarding Request

**From:** OceanBrown — <owner name>, <role>
**Product:** GNM — Gambia Number Migrator
**Contact:** info.oceanbrown@gmail.com · +220 363 1776 (phone / WhatsApp)
**Date:** <fill in> · **API requested:** Checkout only (not Payout)

> Fill in every `<…>` placeholder before sending. Do **not** paste any API key, signing secret,
> or webhook secret into this document.

---

## 1. About the business and product

**OceanBrown** is a business registered in The Gambia. We operate **GNM (Gambia Number Migrator)**,
a mobile and web application that helps people in The Gambia update their phone contacts for the
PURA 7‑digit → 9‑digit numbering transition (backup, preview, migrate, de‑duplicate, restore,
export).

We sell a **single one‑time digital product**: the **Contact Migration Pass**, priced at
**D25 (GMD)**, which unlocks bulk migration and the related tools on one device. There are no
subscriptions and no other paid products today.

- Website: https://gnm.oceanbrown.gm
- Privacy Policy: https://gnm.oceanbrown.gm/privacy
- Terms & Conditions: https://gnm.oceanbrown.gm/terms
- Refund Policy: https://gnm.oceanbrown.gm/refunds *(publish before go‑live — draft below)*
- Customer support: info.oceanbrown@gmail.com, +220 363 1776

**Expected volume (launch estimate):** ~`<N>` transactions/day, ~`<M>`/month; average ticket D25;
6‑month projection ~`<P>`/month. Refund/dispute rate expected to be very low (digital, low value).

---

## 2. Technical integration (built, currently disabled)

Our backend is Node.js / Express / TypeScript on PostgreSQL, deployed on a single Gambia‑reachable
VPS behind Nginx with Let's Encrypt TLS. The integration is implemented against your published
Checkout, request‑signing and webhook specifications and is switched **off** pending your
credentials and the answers in §4.

| Item | Value |
|---|---|
| Production API base | `https://api.oceanbrown.gm/api` |
| Checkout call | `POST https://api.wave.com/v1/checkout/sessions` |
| Webhook endpoint (HTTPS, valid cert, < 5 s, returns 2xx) | `https://api.oceanbrown.gm/api/payments/webhook/wave` |
| Success redirect URL | `https://gnm.oceanbrown.gm/payment/success` |
| Error redirect URL | `https://gnm.oceanbrown.gm/payment/error` |
| Static server egress IP (for API‑key IP allow‑listing) | `<VPS_PUBLIC_IP>` |
| `client_reference` format we send | `GNM-<unix-ms>-<random>` (≤ 255 chars, unique per attempt) |
| Amount format | string, e.g. `"25"` |

**Security summary.** API key, request‑signing secret and webhook signing secret are stored only
in a git‑ignored `.env.production` file on the VPS; they never reach the mobile app, client code,
CI logs or this document. Outbound requests are signed (`Wave-Signature: t=…,v1=HMAC_SHA256(secret,
timestamp + raw body)`). Inbound webhooks are verified with a timing‑safe comparison over the exact
raw body, a 5‑minute past / 30‑second future timestamp window, and support for multiple `v1`
signatures during secret rotation. Events are de‑duplicated on `event.id`. Access is granted **only**
on a verified `checkout.session.completed` where `payment_status = succeeded`, `checkout_status =
complete`, and the amount, currency and `client_reference` match our record; a completed payment can
never be downgraded, and only the paying device is unlocked. If a webhook is delayed we reconcile
via `GET /v1/checkout/sessions/:id`.

---

## 3. What we need from Wave

1. A **Wave Business account** and **business wallet** for OceanBrown.
2. A **production API key scoped to the Checkout API** (Payout not required and should not be
   granted), with **request signing enabled** — i.e. the associated signing secret.
3. A **webhook signing secret** for the endpoint in §2, subscribed to
   `checkout.session.completed` and `checkout.session.payment_failed` (plus any events you
   recommend, e.g. session expiry).
4. Addition of our **static server IP** (`<VPS_PUBLIC_IP>`) to the API key's IP allow‑list.
5. The list of **KYB documents** required for a Gambian company and the expected review time.
6. **Fees and settlement terms**: fee percentage, whether it is payer‑ or merchant‑borne,
   settlement destination (Wave wallet vs bank), settlement cadence, and any minimum.
7. The **production go‑live process** — any review, mandatory test transaction or sign‑off before
   the key can take live money.

We can provide on request: Business Registration Certificate, TIN certificate, director photo ID,
a screen recording of the payment flow, and the full security‑architecture note.

---

## 4. Blocking questions (we cannot go live until these are answered)

1. **Does the Checkout API accept `currency: "GMD"`** for a Gambia business wallet today? If not,
   what do you recommend for a GMD‑priced product, and are decimal places allowed in GMD `amount`
   values (0–2 dp) or is it integer‑only as with XOF?
2. Is there a **sandbox / test environment** (base URL + test credentials), or do we test with
   small live amounts against `https://api.wave.com` and refund?
3. Is **`restrict_payer_mobile`** (E.164, `+220…`) supported and enforced for Gambian Wave
   accounts on Checkout sessions?
4. Please confirm the **current webhook source IP ranges** and how future changes are communicated.
5. Which **webhook events** do you recommend we subscribe to for a Checkout‑only integration?
6. Once request signing is enabled on a key, is it **mandatory** for every call, and can a key
   without signing still use Checkout in production?
7. Are **partial refunds** supported via `POST /v1/checkout/sessions/:id/refund`, or full only, and
   is there a time limit after completion?
8. What are the **rate limits** (requests/second per key) for creating checkout sessions and for
   session GET/search?
9. Do we need an **`aggregated_merchant_id`** / to operate as a sub‑merchant, or do we transact
   directly on our own wallet?
10. Who is our **technical contact / account manager**, and what is the **production support SLA**
    for payment incidents?

---

## 5. Refund Policy (draft — will be published at the URL in §1)

> **GNM Contact Migration Pass — Refund Policy.** The Pass is a one‑time digital unlock of D25
> (GMD). If your payment was charged but the Pass did not activate on your device, contact
> info.oceanbrown@gmail.com or WhatsApp +220 363 1776 with your payment reference within 14 days;
> we will verify with the payment provider and either activate the Pass or refund the D25 in full.
> Because the Pass grants immediate access to digital features, refunds are otherwise granted only
> where required by law. Approved refunds are returned to the Wave account used for payment,
> normally within 5 business days.

---

## 6. Attachments to include when sending

- [ ] OceanBrown Business Registration Certificate (PDF)
- [ ] TIN certificate (PDF)
- [ ] Director / beneficial‑owner photo ID (PDF)
- [ ] Screen recording or screenshots of the payment flow (checkout → Wave hand‑off → success)
- [ ] Security‑architecture note (1 page) — available from `WAVE_ONBOARDING.md` §2

# Organisation access codes

One code unlocks the full Contact Migration Pass on a fixed number of devices.

- **Redeeming** a code is free for the recipient and works in **every** build,
  including the App Store / Google Play edition — it is a licence-key entry, not
  a purchase, so it does not trigger Apple/Google billing rules.
- **Buying** seats happens only in the **direct / web** channel and rides the
  existing `wave_payment_enabled` / `aps_payment_enabled` + `PAYMENT_PROVIDER_INTEGRATION_READY`
  gate. Nothing can be charged until Wave (or APS) is live. Until then, collect
  payment out of band and issue an **admin** code.

## Data model — migration `028_organisation_access_codes.sql`

| Table | Purpose |
|---|---|
| `access_codes` | `code`, `seats`, `redeemed_count`, `source` (`admin`\|`purchase`), `status` (`active`\|`revoked`\|`expired`), `label`, `payment_id`, `expires_at` |
| `access_code_redemptions` | one row per `(code_id, device_id)` — enforces the seat cap |

`devices.access_source` gains `'code'`, distinct from `'paid'` (individual) and
`'admin'` (manual grant). `app_config.org_pricing` is seeded with default tiers.

## API

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/access/redeem` | device secret | `{ deviceId, code }` → sets the device `active` / `access_source='code'`. Row-locked; idempotent per device; 409 when all seats are used, revoked or expired. |
| POST | `/api/admin/access-codes` | admin | `{ seats, quantity, label?, expiresAt? }` → generates codes (`source='admin'`). |
| GET | `/api/admin/access-codes` | admin | list with redemption counts + linked payment. |
| GET | `/api/admin/access-codes/:id/redemptions` | admin | which devices redeemed it. |
| POST | `/api/admin/access-codes/:id/revoke` | admin | blocks future redemptions; already-unlocked devices keep access (block them in Support Devices if needed). |

Purchases reuse the individual pipeline unchanged: `POST /payments/create-intent`
with `metadata: { kind: 'org', seats }`. The server ignores any client price and
computes the total from `org_pricing`. On a confirmed payment, `applyOutcome()`
mints **one** `access_codes` row (`source='purchase'`, idempotent on replay) and
returns it via `GET /payments/:reference/status` → `issued_code`.

## `org_pricing` shape

```json
{ "tiers": { "5": 100, "10": 190, "15": 270 },
  "custom_unit": 20, "custom_min_seats": 2, "custom_max_seats": 500 }
```

`tiers` maps an exact seat count to a fixed GMD total; any other size is
`custom_unit × seats`, clamped to `[custom_min_seats, custom_max_seats]`.
Edit it in **Admin → Access Codes → Seat pricing**.

## Admin

New **Access Codes** page (owner/admin/finance): seat-pricing editor, code
generator (5 / 10 / 15 / custom + quantity + label + expiry), a table of all
codes with per-code redemption drill-down, and revoke.

## Mobile

- **Settings → Organisation access → Enter organisation code** (`app/organisation.tsx`) —
  ships in every build; JS-only, so it can reach the approved store build via
  `eas update` with no new review.
- In the **direct / web** build the same screen also shows **Buy organisation
  seats** (seat picker → provider checkout → the issued code with a Share
  button). Hidden entirely when `EXPO_PUBLIC_DISTRIBUTION_CHANNEL=store`.

## Tests

- `apps/api/tests/access-codes.test.ts` — generate, redeem, seat cap, idempotent
  re-redeem, revoked/expired/unknown/malformed, blocked device, revoke.
- `apps/api/tests/payments-org.test.ts` — tier + custom pricing authority,
  wrong-amount rejection, buyer-already-active, webhook mints exactly one code
  and does not unlock the buyer device, duplicate webhook mints nothing.

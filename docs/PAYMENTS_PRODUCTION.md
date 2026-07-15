# Production payment integration

## Required payment split

The Contact Migration Pass unlocks digital functionality. The Play Store build must use Google Play Billing and the App Store build must use Apple In-App Purchase unless the store has explicitly approved another billing program for your app and country. The project therefore hides Wave/APS in `store` builds and preserves them for `direct` builds where permitted.

## Apple and Google store product

Create the same non-consumable product ID in both consoles:

```text
contact_migration_pass
```

The price displayed in a store build must come from the store product, not the admin GMD price. Add server-side purchase verification using Google Play Developer API and Apple App Store Server API before enabling the purchase button. Grant `active` only after the server verifies the product ID, app package/bundle, purchase state and uniqueness of the purchase token/transaction. Finish or acknowledge the transaction only after the server grants access. Implement Restore Purchases on iOS and re-query owned purchases on Android.

`expo-iap` is included as the native store-billing client. It requires an EAS development/production build and will not work in Expo Go. The current button intentionally fails closed until receipt-verification credentials and endpoints are configured.

## Wave merchant integration

Ask Wave Business for:

- an approved business/merchant account;
- production and sandbox API keys;
- the official Checkout API base URL for your market;
- allowed redirect URL and webhook URL registration;
- webhook signing specification/secret;
- settlement account, fees, refund and reconciliation instructions.

Correct flow:

1. Mobile asks this API to create a checkout session; the Wave secret stays on the server.
2. Server sends amount, currency, unique reference, success URL and error URL to Wave.
3. Mobile opens Wave's returned launch URL. Wave handles PIN/OTP/authentication—not this app.
4. Wave calls the HTTPS webhook. Server verifies the signature against the raw body, checks amount/currency/reference, handles duplicate events, then activates the device entitlement.
5. Mobile polls payment status and unlocks only after server confirmation.

Never ask for, store, log or send a customer's Wave PIN or OTP. Remove the local OTP simulation by keeping `PAYMENT_TEST_MODE=false`.

## APS integration

Obtain the APS merchant onboarding pack directly from APS. Public marketing information is not enough to safely guess their API. Ask for merchant ID, sandbox/production endpoints, authentication scheme, checkout request/response examples, webhook signature rules, status lookup, refunds, settlement and test accounts. Keep APS disabled until APS supplies and you test those official specifications.

## Go-live payment tests

- Successful, cancelled, expired and insufficient-funds transactions.
- Duplicate and out-of-order webhooks remain idempotent.
- Forged signatures and mismatched amounts are rejected.
- A paid user sees no second payment prompt.
- Reinstall/restore and support-assisted recovery work without exposing contacts.
- Refund/revocation removes the entitlement according to the published refund policy.
- Secrets appear only in server variables and are rotated after any exposure.

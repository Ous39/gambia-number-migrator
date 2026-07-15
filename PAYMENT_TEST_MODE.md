# Payment Test Mode

The mobile payment flow is currently test-only.

## Supported providers

Only these providers are available in the mobile app:

- Wave
- APS

Afrimoney, QMoney, Card, Manual, and Mock are not shown in the mobile payment UI.

## Test amount

The test amount is:

```text
D100
```

## Phone number validation

The payment phone number must be exactly:

- 7 digits, or
- 9 digits

More than 9 digits are not accepted. Extra digits are removed by the checkout input.

## Test OTP flow

1. Select Wave or APS.
2. Enter a valid 7-digit or 9-digit phone number.
3. Press `Pay D100`.
4. The app generates a 4-digit test OTP.
5. Enter the OTP.
6. Payment succeeds locally and migration tools are unlocked for testing.

## Backend behavior

The app tries to create a payment intent in the API. If the API or database is unavailable, the local test unlock still works so mobile testing is not blocked.

Real provider keys, callbacks, and reconciliation should be added later after merchant approval.

## Professional Wave/APS checkout flow

The mobile payment UI now exposes only:

- Wave
- APS

The flow is:

1. User selects Wave or APS.
2. User sees a professional D100 checkout screen.
3. User enters a Gambian payment number.
4. The field accepts only 7 digits or 9 digits.
5. Extra digits are removed after 9 digits.
6. User presses `Pay D100`.
7. App generates a 4-digit test OTP.
8. User enters the OTP.
9. App unlocks migration tools locally and creates an API payment record if the API/database is available.

No live money is charged in this version.

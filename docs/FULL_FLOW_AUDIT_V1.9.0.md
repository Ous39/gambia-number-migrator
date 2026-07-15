# Full Flow Audit — v1.9.0

## Corrected functional issues

### Dashboard after migration

The previous implementation updated the stored candidate statuses and then immediately deleted the complete scan. Returning to Dashboard therefore showed no current result and forced another scan.

Add and Replace now retain the scan, recalculate Ready/Updated/Review totals and update the Dashboard on focus. Cleanup removes only successfully cleaned pairs from the saved cleanup results. Restore still invalidates the scan because restoring contact data can legitimately make every previous result stale.

### Duplicate payment protection

The API rejects creation of a new payment intent when the device status is already `active`. Dashboard shows **Full access active**, Payment renders an active entitlement state without provider controls, and checkout independently rechecks status before creating an intent.

### Local payment testing

With `PAYMENT_TEST_MODE=true`, payment intent creation returns a four-digit development OTP. Checkout displays the OTP and includes **Use Test OTP**. Submitting that code marks the payment successful and activates the device on the server. No live Wave or APS account is required.

Production must set `PAYMENT_TEST_MODE=false` only after real provider adapters and credentials are installed.

## Screen-recording UI review

- Reduced Scan Complete artwork to prevent top clipping on compact iPhones.
- Raised Preview's migration action above the five-tab navigation.
- Added more bottom space to virtualized list screens so final rows and buttons are reachable.
- Changed the Preview floating surface from legacy navy to the current green dark surface.
- Replaced post-payment checkout controls with a clear active-access screen.
- Kept horizontal filters scrollable because seven filters cannot fit safely within 360–390 point widths.

## Verification required on physical devices

- iPhone compact height with keyboard visible on OTP.
- Android with three-button navigation and gesture navigation.
- Return to Dashboard after migrating one, ten and more than 100 contacts.
- App restart after payment and after migration.
- Local test payment duplicate attempt must return Already Unlocked.

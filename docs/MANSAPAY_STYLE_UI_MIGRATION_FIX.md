# MansaPay Style UI + Migration Fix

This build applies a full mobile UI refinement inspired by the provided MansaPay reference screens.

## Completed

- Updated the mobile design system to a cleaner blue/white MansaPay-style palette.
- Rebuilt the dashboard as a professional command-center screen with a fixed blue top header.
- Improved dashboard spacing, overview cards, quick actions, and the recommended flow card.
- Upgraded the preview screen:
  - Fixed top header.
  - Fixed search bar.
  - Fixed operator filter chips.
  - Operator selection displays only that operator's numbers.
  - The migration button stays visible above the bottom navigation.
- Added a payment test unlock flow:
  - No real money is charged.
  - Users can choose a test payment provider.
  - Pressing Enable Test unlocks migration features on the device for testing.
- Added an emergency Enable Test Subscription action from the preview subscription modal.
- Kept light, dark, and system theme modes.
- Improved bottom navigation to match a real app layout with a center migrate action.
- Added sticky top headers for standard scroll pages.

## Migration testing flow

1. Scan contacts from the dashboard.
2. Open Preview.
3. Select an operator such as QCell, Comium, or Africell.
4. Only that operator's visible phone numbers will be selectable.
5. If subscription is required, open Payment UI or press Enable Test.
6. Return to Preview and press Migrate Selected.

## Notes

Actual live payment provider integration is still intentionally disabled. This build is for final UI and migration testing before connecting Wave, APS, or any other live provider.

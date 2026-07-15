# Stitch UI Update

This build applies the Stitch design direction to the mobile app.

## Applied
- Light and dark mode theme tokens from the Stitch design system.
- Splash, onboarding, dashboard, scan result, success, history and settings screens updated toward the Stitch layout.
- Existing contact migration, backup, cleanup, payment and admin logic preserved.
- Stitch reference screenshots copied into `docs/stitch/` for future implementation checks.

## Notes
- No contact data is sent to the backend. Contacts are still processed locally on the phone.
- The API/admin still manage rules, transition settings, and payment status.

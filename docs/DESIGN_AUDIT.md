# Design Audit - Premium UI Refresh

This build applies the provided premium UI reference across the mobile app and admin panel.

## Mobile updates

- Global theme provider with `system`, `light`, and `dark` modes.
- Premium dark mode based on midnight navy, cyan, blue, and violet accents.
- Light mode with clean off-white surfaces and the same accent system.
- Redesigned screens:
  - Splash
  - Onboarding
  - Dashboard
  - Scan Complete
  - Preview Changes
  - Remove Old Duplicates
  - Backups
  - Migration History
  - Premium Unlock
  - Settings
  - Migration Complete

## Admin updates

- New responsive shell styling.
- Dark/light mode toggle in the sidebar.
- Premium dashboard hero, cards, tables, badges, buttons, and forms.

## Safety audit notes

- Contact data remains device-local.
- Backend API remains for rules, config, transition settings, payments, and audit logs.
- Migration operations still require user preview and confirmation.
- Destructive cleanup remains gated behind explicit confirmation and premium unlock.

## Verification performed in this environment

- Project ZIP was unpacked and rewritten cleanly.
- TypeScript source files were parsed by `tsc`; dependency errors are expected because `node_modules` is not included in the ZIP extraction here.
- Final ZIP integrity was verified with `unzip -t`.

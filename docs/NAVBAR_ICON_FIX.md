# Navbar and Icon Fix

This update fixes the mobile app navigation and icon rendering problems reported during Expo testing.

## Fixed navigation

- The bottom app navbar is now mounted once at the app shell level for the main app pages.
- Main tab pages now share one fixed bottom navbar:
  - Dashboard
  - Preview Changes
  - Remove Duplicates
  - Migration History
  - Settings
- Content now has bottom padding so buttons and list items do not hide behind the navbar.
- Legacy in-page navbar usage is kept as a no-op to avoid duplicate navbars.

## Fixed back button warning

Back buttons now use a safe fallback:

- If the app has a screen to return to, it goes back.
- If there is no previous screen, it returns to Dashboard.

This removes the development warning: `The action 'GO_BACK' was not handled by any navigator`.

## Fixed icons

- Added a shared `AppIcon` component.
- Replaced unreliable special text glyphs such as `⌕`, `⌫`, and `◷` with Expo Ionicons.
- Added `@expo/vector-icons` to the mobile app dependencies.

Run `pnpm install` after extracting this ZIP so the icon package is installed.

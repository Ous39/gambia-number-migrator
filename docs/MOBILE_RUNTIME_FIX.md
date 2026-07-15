# Mobile Runtime Fix

This package fixes the SDK 54 runtime issues seen in Expo Go:

- `useAppTheme is not a function`
- `Element type is invalid` in `_layout.tsx`
- Web bundling error: `Unable to resolve react-native-web/dist/index`

The fix uses `apps/mobile/src/appTheme.tsx` as the canonical theme module and updates all mobile imports to use that file directly. The old `src/theme.tsx` and `src/theme/index.tsx` remain as compatibility re-exports.

## Important Windows cleanup

Before extracting this ZIP, delete the old folder completely:

```powershell
cd "C:\Users\OUSMAN JALLOW\Documents"
Remove-Item -Recurse -Force .\gambia-number-migrator
```

Then extract this ZIP fresh. Do not merge over the old folder, because stale files can keep the same error.

## Run mobile

```powershell
cd "C:\Users\OUSMAN JALLOW\Documents\gambia-number-migrator"
pnpm install
cd apps\mobile
$env:EXPO_NO_DEPENDENCY_VALIDATION="1"
npx expo start --clear --port 8082
```

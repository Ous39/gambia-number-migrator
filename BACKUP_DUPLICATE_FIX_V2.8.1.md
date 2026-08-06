# GNM v2.8.1 Backup and Duplicate Fix

## Corrected flow

1. Backup reads the device contacts once.
2. The contact snapshot is saved locally in small verified chunks.
3. The same contact read refreshes the migration scan and cleanup preview.
4. The user can go directly to Preview without scanning again.
5. Add & Keep Old refreshes safe cleanup pairs immediately.
6. Remove Old Duplicates creates a verified local backup, rechecks the live contact, removes only the matching old number, and verifies the new number remains.

## Verification completed

- Workspace TypeScript checks passed.
- All 10 automated tests passed.
- API and Admin production builds passed.
- Android, iOS, and Web mobile exports passed.

Physical-device testing is still required before public release, including backup and restore with large Android phonebooks and interrupted operations.

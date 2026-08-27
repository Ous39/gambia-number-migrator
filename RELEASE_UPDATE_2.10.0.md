# GNM 2.10.0 — team photos, editable profiles, real-app hero preview

## What's new

- **Admin can now edit team members**, not just create and hide them. The Website Content → Team form loads an existing member's details (including their photo) into the form for editing, with a dedicated "Update team member" action, alongside the existing Add/Hide flow.
- **Real photo uploads for team members.** A new `POST /api/admin/uploads/team-photo` endpoint (multer, PNG/JPEG/WEBP/GIF up to 3MB, server-generated filenames — never the client-supplied name) stores photos on a persistent Docker volume (`gnm_uploads`, mounted at `/app/uploads`) and serves them publicly at `/uploads/<file>`. No third-party image host required. Rate-limited to 20 uploads/minute per client to prevent abuse.
- **Team profile pages.** Each team card on the homepage now has a "Read more →" link that opens `/team/:id` — a full profile page with the member's photo, role, an optional longer biography (falls back to the short bio if not set), and an optional outbound "View portfolio" link. Gracefully shows "Profile not found" instead of crashing if the id doesn't resolve.
- **The hero phone mockup now cycles through three real app screens** — Dashboard, Preview changes (with sample Ready / Already-updated rows matching the app's actual candidate statuses), and Migration complete (with Updated/Skipped/Failed counts) — auto-advancing every ~4 seconds with dot controls to jump directly to a screen. This replaces the single static mockup so the homepage genuinely previews the app's real flow instead of one frozen frame.

## Database

New migration `024_team_profiles.sql` adds `photo_url`, `long_bio` and `portfolio_url` to `website_team_members` (all nullable — existing rows are unaffected).

## Verification performed

```
pnpm install                      ✅ (added multer + @types/multer)
pnpm --filter @gnm/api typecheck  ✅
pnpm --filter @gnm/admin typecheck ✅
pnpm --filter @gnm/web typecheck  ✅
pnpm --filter @gnm/api test       ✅ 30/30 passed (10 in the website/RBAC suite, including the new
                                       upload-permission and team-update-route checks)
```

The website was loaded in a real browser: the hero mockup was confirmed cycling through Dashboard → Preview changes → Migration complete with the correct sample data and working tab controls, and `/team/:id` was confirmed to render its "Profile not found" state gracefully with no console errors when the id doesn't match (expected here since no database was available in this environment — see below).

## Requires database access to fully verify

The photo-upload round trip (Admin uploads a file → team card shows the photo → profile page shows it enlarged) and the full team-member edit flow could not be exercised end-to-end in this environment because Docker's PostgreSQL engine was not running here. The code was verified by type-checking, the automated RBAC/route test suite, and manual review of the request/response contract on both sides (Admin's `uploadTeamPhoto()` and the API's `POST /admin/uploads/team-photo`, matching field names and response shape). Run the local test sequence in `LOCAL_TESTING.md` step 12 with Docker running to confirm the live round trip before relying on it in production.

# GNM 2.9.0 — public website added

## What's new

- **`apps/web`**: a new public marketing website at `gnm.oceanbrown.gm` — home (with an interactive number-format checker), how-it-works, safety, FAQ, team, a contact form, and privacy/terms/support pages. It runs on port `5174` locally and deploys the same way as Admin: a Vite production build served by Nginx (`Dockerfile.web`, `deploy/nginx-web.conf`, wired into `docker-compose.production.yml` and the host reverse-proxy example).
- **Real content management, no third-party dependency.** An earlier prototype of this site (delivered separately as `GNM-Public-Website.zip`) was built entirely on OpenAI's "ChatGPT Sites" hosting — Cloudflare Workers + D1, with admin access gated only by "Sign in with ChatGPT" tied to one hardcoded personal Gmail address. That could not run on your own VPS. This rebuild uses your existing PostgreSQL, your existing Express API, and your existing Admin Portal's username/password + JWT authentication — no dependency on any third party's hosting product, and no single-account admin login.
- **Linked to the same live configuration the app uses.** The website's Contact and Privacy pages read `support_email` from the same `app_config` the mobile app's Settings screen reads, so updating the official support address in Admin → App Config updates both surfaces at once.
- **New Admin sections**: **Website Content** (announcements, FAQs, team roster) and **Enquiries** (the public contact form's inbox), both audit-logged like every other admin action.
- **New "Communications" role**, filling a gap from the previous audit where the product brief named this role but no such role existed. It can manage website content and enquiries but nothing else (no payments, no migration rules, no device management) — enforced server-side in `requireAdminAreaAccess`, mirrored in the Admin sidebar's navigation filter.
- **New database migration** `023_public_website_content.sql`: `website_announcements`, `website_faqs`, `website_team_members`, `website_inquiries`, plus a `CHECK` constraint on `admins.role` that now includes `communications`.
- **New API routes**: public `GET /api/public-content` and `POST /api/inquiries` (rate-limited to 6/minute to deter spam), admin `GET/POST/PATCH` under `/api/admin/website-content/*` and `/api/admin/inquiries/*`.

## Verification performed

```
pnpm install                      ✅
pnpm typecheck                    ✅ (shared, api, admin, mobile, web)
pnpm test                         ✅ 78/78 passed (17 shared, 26 api, 22 mobile, 7 admin, 6 web)
pnpm build                        ✅ (shared, api, admin, web production builds)
```

The website was also loaded in a real browser during development (`pnpm --filter @gnm/web dev`) and every route — `/`, `/privacy`, `/terms`, `/support`, `/contact` — was confirmed to render its correct title and content, including graceful fallback copy when the API is unreachable (no crash, no blank page).

## Configuration

Add to `.env` (already present with safe empty defaults in `.env.example`):

```
VITE_PLAY_STORE_URL=
VITE_APP_STORE_URL=
```

Both are optional. Leave them empty and the download section shows honest "Coming soon" placeholders instead of dead links; set them once the store listings are live and the download buttons become real links automatically. `CORS_ORIGIN` now includes the website's local port (`5174`) by default — update it to include `https://gnm.oceanbrown.gm` in production.

## Known limitation

The site is a client-rendered single-page app (Vite + React Router), not server-rendered. Page titles and meta tags update correctly per route (verified), but a crawler that doesn't execute JavaScript will only see the homepage's static `<head>` tags. For a five-page marketing site this is a reasonable tradeoff for operational simplicity — it deploys with the exact same Docker/Nginx pattern as Admin, with no separate rendering server to run. If search-engine indexing of the inner pages becomes a priority, revisit with a static-prerendering step at build time.

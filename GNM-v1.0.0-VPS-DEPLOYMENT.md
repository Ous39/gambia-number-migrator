# GNM v1.0.0 — Contabo VPS Deployment

Target: Ubuntu 24.04, PostgreSQL 16 (via Docker), Docker Compose, host-level Nginx + Let's Encrypt.
Project path: `/opt/gnm/app`

This guide gives exact commands. It does not claim any of them were executed against a real VPS from this environment — there is no live VPS reachable here. Run them from the actual server.

## 1. One-time server preparation

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl gnupg nginx certbot python3-certbot-nginx

# Docker Engine + Compose plugin
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# log out/in (or `newgrp docker`) for the group change to take effect

sudo mkdir -p /opt/gnm/app
sudo chown $USER:$USER /opt/gnm/app
```

## 2. Get the source onto the server

```bash
cd /opt/gnm/app
# either:
git clone <your-private-repo-url> .
# or upload GNM-v1.0.0-PLAY-STORE-APP-STORE-VPS-READY-FULL-SOURCE.zip and:
unzip GNM-v1.0.0-PLAY-STORE-APP-STORE-VPS-READY-FULL-SOURCE.zip -d /opt/gnm/app
```

## 3. Provision `.env` (never commit this file, never overwrite an existing live one)

```bash
cp .env.example .env
nano .env
```

Set, at minimum:

```text
NODE_ENV=production
POSTGRES_PASSWORD=<generate: openssl rand -base64 32>
JWT_SECRET=<generate: openssl rand -base64 48>
CORS_ORIGIN=https://admin.oceanbrown.gm,https://gnm.oceanbrown.gm
ADMIN_BASE_URL=https://admin.oceanbrown.gm
VITE_API_BASE_URL=https://api.oceanbrown.gm/api
VITE_PLAY_STORE_URL=<Google Play listing URL, once published>
VITE_APP_STORE_URL=<App Store listing URL, once published>
PAYMENT_TEST_MODE=false
PAYMENT_PROVIDER_INTEGRATION_READY=false
ADMIN_INITIAL_PASSWORD=<only for a genuinely fresh database — remove after first boot>
```

Leave Wave/APS webhook secrets empty until a signed provider agreement and verified production credentials exist. **If a `.env` already exists on this server from a prior deploy, do not overwrite it — merge new keys in by hand.**

## 4. Host-level Nginx (the only public entry point)

The Docker services bind to `127.0.0.1` only (verified in `docker-compose.production.yml` — no service publishes a port to `0.0.0.0`). Host Nginx is what the public domains actually hit.

```bash
sudo cp deploy/nginx-host-reverse-proxy.example.conf /etc/nginx/sites-available/gnm.conf
sudo nano /etc/nginx/sites-available/gnm.conf   # confirm the three server_names match:
#   api.oceanbrown.gm    -> proxy_pass http://127.0.0.1:8089
#   admin.oceanbrown.gm  -> proxy_pass http://127.0.0.1:5173
#   gnm.oceanbrown.gm    -> proxy_pass http://127.0.0.1:5174
sudo ln -s /etc/nginx/sites-available/gnm.conf /etc/nginx/sites-enabled/gnm.conf
sudo nginx -t
sudo systemctl reload nginx

sudo certbot --nginx -d api.oceanbrown.gm -d admin.oceanbrown.gm -d gnm.oceanbrown.gm
```

## 5. Build and start

```bash
cd /opt/gnm/app
pnpm install --frozen-lockfile
pnpm --filter @gnm/shared build

docker compose -f docker-compose.production.yml build
docker compose -f docker-compose.production.yml up -d
docker compose -f docker-compose.production.yml ps
```

The `api` container's `CMD` runs `pnpm --filter @gnm/api db:migrate` automatically before starting the server — migrations apply on every container start, and are safe to re-run (the runner tracks applied migrations in `schema_migrations` and skips them; see `GNM-v1.0.0-FINAL-AUDIT.md` §10). **Do not run `pnpm --filter @gnm/api db:seed` on an existing database** — it is for a genuinely fresh install only.

## 6. Verify

```bash
curl -s https://api.oceanbrown.gm/api/health
curl -sI https://admin.oceanbrown.gm | head -1
curl -sI https://gnm.oceanbrown.gm | head -1
curl -sI https://gnm.oceanbrown.gm/privacy | head -1
curl -sI https://gnm.oceanbrown.gm/data-deletion | head -1
docker compose -f docker-compose.production.yml logs -f api
```

Confirm in the database (or via the Admin portal) that:
- `schema_migrations` includes migrations through `024_team_profiles.sql`
- `free_access_mode` is set to your intended launch value (`all` for store review, `first_n`/`off` afterward)
- `wave_payment_enabled` / `aps_payment_enabled` reflect a genuinely tested, signed provider arrangement — not `true` by default

## 7. Backup

Run before every deploy, and on a schedule (cron/systemd timer):

```bash
# Database
docker compose -f docker-compose.production.yml exec -T postgres \
  pg_dump -U gnm_user gambia_number_migrator | gzip > /opt/gnm/backups/gnm_db_$(date +%Y%m%d_%H%M%S).sql.gz

# Uploaded files (team photos etc.)
docker run --rm -v gnm_uploads:/data -v /opt/gnm/backups:/backup alpine \
  tar czf /backup/gnm_uploads_$(date +%Y%m%d_%H%M%S).tar.gz -C /data .
```

Verify a backup is actually restorable before trusting it — restore it into a scratch database, don't just check the file exists:

```bash
gunzip -c /opt/gnm/backups/gnm_db_<timestamp>.sql.gz | \
  docker compose -f docker-compose.production.yml exec -T postgres psql -U gnm_user -d postgres -c "CREATE DATABASE gnm_restore_test;" && \
  docker compose -f docker-compose.production.yml exec -T postgres psql -U gnm_user -d gnm_restore_test < <(gunzip -c /opt/gnm/backups/gnm_db_<timestamp>.sql.gz)
```

## 8. Deploy an update (existing production server)

```bash
cd /opt/gnm/app
# 1. Backup first (§7) — always.
# 2. Pull the new release.
git pull   # or unzip the new source release over this directory
# 3. Rebuild and restart.
pnpm install --frozen-lockfile
docker compose -f docker-compose.production.yml build
docker compose -f docker-compose.production.yml up -d
# 4. Verify (§6).
```

## 9. Rollback

Never edit an already-applied migration file. If a deploy goes wrong:

```bash
# Stop the new containers.
docker compose -f docker-compose.production.yml down

# Restore the previous source release (git: checkout the previous tag/commit; zip: re-unzip the prior release).
git checkout <previous-good-tag>

# Rebuild the previous version's images and start it.
docker compose -f docker-compose.production.yml build
docker compose -f docker-compose.production.yml up -d

# If the database itself needs restoring (rare — only if a migration corrupted data):
docker compose -f docker-compose.production.yml exec -T postgres \
  psql -U gnm_user -d gambia_number_migrator < <(gunzip -c /opt/gnm/backups/gnm_db_<last-good-timestamp>.sql.gz)
```

Preserve the failing container logs and the migration filename that failed before rolling back, for diagnosis.

## 10. What was not verified from this environment

No Docker daemon, no reachable Postgres, and no live VPS were available when this document was written — the compose file, Dockerfiles, and Nginx config were verified by careful reading, not by actually running `docker compose up` end-to-end. Run `docker compose -f docker-compose.production.yml config` as your first real step on the actual server to catch any environment-specific `.env` issue before `build`/`up`.

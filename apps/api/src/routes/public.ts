import { Router } from 'express';
import { query } from '../db/pool';
import { isDbUnavailable } from '../utils/fallbacks';

// Read-only, unauthenticated endpoints that power the public website (gnm.oceanbrown.gm):
// a live readiness/status feed, the published updates list + single post, and an RSS feed.
// All responses are cache-friendly and contain no admin or device data.

export const publicRouter = Router();

const SITE_URL = (process.env.PUBLIC_SITE_URL || 'https://gnm.oceanbrown.gm').replace(/\/$/, '');

function slugify(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

function announcementSlug(row: any) {
  return row.slug || `${slugify(row.title) || 'update'}-${String(row.id).slice(0, 8)}`;
}

async function configMap(keys: string[]) {
  const rows = (await query(
    `SELECT config_key, config_value FROM app_config WHERE config_key = ANY($1::text[])`,
    [keys]
  )).rows;
  return Object.fromEntries(rows.map((r) => [r.config_key, r.config_value])) as Record<string, unknown>;
}

publicRouter.get('/public/status', async (_req, res, next) => {
  try {
    const config = await configMap([
      'subscription_price', 'currency', 'free_access_mode', 'free_access_user_limit',
      'maintenance_mode', 'minimum_app_version', 'wave_payment_enabled', 'aps_payment_enabled',
      'announcement_message', 'play_store_url', 'app_store_url',
      'countdown_enabled', 'countdown_target', 'countdown_label'
    ]);

    const [transition, rules, promo] = await Promise.all([
      query('SELECT * FROM transition_settings ORDER BY updated_at DESC LIMIT 1').catch(() => ({ rows: [] as any[] })),
      query(
        `SELECT version_number, published_at, (SELECT COUNT(*)::int FROM migration_rules WHERE status='active') AS active_rule_count
         FROM rules_versions WHERE status='published' ORDER BY version_number DESC LIMIT 1`
      ).catch(() => ({ rows: [] as any[] })),
      query("SELECT COUNT(*)::int AS c FROM devices WHERE access_source='campaign'").catch(() => ({ rows: [{ c: 0 }] }))
    ]);

    const t = transition.rows[0] || {};
    const freeMode = String(config.free_access_mode || 'off');
    const freeLimit = Number(config.free_access_user_limit || 0);
    const promoUsed = Number(promo.rows[0]?.c || 0);

    res.set('Cache-Control', 'public, max-age=60');
    res.json({
      data: {
        generatedAt: new Date().toISOString(),
        service: {
          maintenance: config.maintenance_mode === true,
          minimumAppVersion: config.minimum_app_version ? String(config.minimum_app_version).replace(/^"|"$/g, '') : null
        },
        pricing: {
          amount: Number(config.subscription_price ?? 25),
          currency: String(config.currency || 'GMD').replace(/^"|"$/g, ''),
          freeLaunch: freeMode === 'all',
          freeMode,
          promotionalPlacesRemaining: freeMode === 'first_n' ? Math.max(0, freeLimit - promoUsed) : null
        },
        payments: {
          wave: config.wave_payment_enabled === true,
          aps: config.aps_payment_enabled === true
        },
        stores: {
          android: config.play_store_url ? String(config.play_store_url).replace(/^"|"$/g, '') || null : null,
          ios: config.app_store_url ? String(config.app_store_url).replace(/^"|"$/g, '') || null : null
        },
        countdown: {
          enabled: config.countdown_enabled === true,
          target: config.countdown_target ? String(config.countdown_target).replace(/^"|"$/g, '') || null : null,
          label: config.countdown_label ? String(config.countdown_label).replace(/^"|"$/g, '') || null : null
        },
        rules: {
          publishedVersion: rules.rows[0]?.version_number ?? null,
          publishedAt: rules.rows[0]?.published_at ?? null,
          activeRuleCount: rules.rows[0]?.active_rule_count ?? null
        },
        transition: {
          startDate: t.transition_start_date ?? null,
          endDate: t.transition_end_date ?? null,
          showNotice: t.show_transition_notice ?? null,
          bannerMessage: t.transition_banner_message ?? null
        },
        announcement: config.announcement_message ? String(config.announcement_message).replace(/^"|"$/g, '') : null
      }
    });
  } catch (e) {
    if (isDbUnavailable(e)) {
      return res.json({ data: { generatedAt: new Date().toISOString(), degraded: true }, warning: 'Live status is temporarily unavailable.' });
    }
    next(e);
  }
});

publicRouter.get('/public/updates', async (_req, res, next) => {
  try {
    const rows = (await query(
      `SELECT * FROM website_announcements WHERE status='published'
       ORDER BY COALESCE(published_at, created_at) DESC LIMIT 50`
    )).rows;
    res.set('Cache-Control', 'public, max-age=120');
    res.json({
      data: rows.map((row) => ({
        slug: announcementSlug(row),
        title: row.title,
        summary: row.summary || String(row.body || '').replace(/\s+/g, ' ').slice(0, 180),
        body: row.body,
        publishedAt: row.published_at || row.created_at
      }))
    });
  } catch (e) {
    if (isDbUnavailable(e)) return res.json({ data: [] });
    next(e);
  }
});

publicRouter.get('/public/updates.xml', async (_req, res, next) => {
  try {
    const rows = (await query(
      `SELECT * FROM website_announcements WHERE status='published'
       ORDER BY COALESCE(published_at, created_at) DESC LIMIT 30`
    )).rows;
    const esc = (s: string) => String(s || '').replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c] as string));
    const items = rows.map((row) => {
      const link = `${SITE_URL}/updates/${announcementSlug(row)}`;
      const date = new Date(row.published_at || row.created_at).toUTCString();
      return `<item><title>${esc(row.title)}</title><link>${esc(link)}</link><guid isPermaLink="true">${esc(link)}</guid><pubDate>${date}</pubDate><description>${esc(row.summary || String(row.body).slice(0, 400))}</description></item>`;
    }).join('');
    res.set('Content-Type', 'application/rss+xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=600');
    res.send(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>GNM — Updates</title><link>${SITE_URL}/updates</link><description>Readiness updates for the Gambia Number Migrator.</description>${items}</channel></rss>`);
  } catch (e) {
    if (isDbUnavailable(e)) { res.set('Content-Type', 'application/rss+xml'); return res.send('<?xml version="1.0"?><rss version="2.0"><channel><title>GNM — Updates</title></channel></rss>'); }
    next(e);
  }
});

publicRouter.get('/public/updates/:slug', async (req, res, next) => {
  try {
    const slug = String(req.params.slug || '');
    const idPart = slug.split('-').pop() || '';
    const rows = (await query(
      `SELECT * FROM website_announcements
       WHERE status='published' AND (slug = $1 OR ($2 <> '' AND id::text LIKE $2 || '%'))
       ORDER BY COALESCE(published_at, created_at) DESC LIMIT 1`,
      [slug, idPart.length >= 4 ? idPart : '']
    )).rows;
    if (!rows.length) return res.status(404).json({ message: 'Update not found' });
    const row = rows[0];
    res.set('Cache-Control', 'public, max-age=300');
    res.json({
      data: {
        slug: announcementSlug(row),
        title: row.title,
        summary: row.summary || null,
        body: row.body,
        publishedAt: row.published_at || row.created_at
      }
    });
  } catch (e) { next(e); }
});

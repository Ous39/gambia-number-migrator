import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool';
import { requireAdmin } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { audit } from '../services/auditService';

export const websiteContentRouter = Router();

function mapAnnouncement(row: any) {
  return { id: row.id, title: row.title, body: row.body, summary: row.summary || null, slug: row.slug || null, status: row.status, publishedAt: row.published_at || null, createdAt: row.created_at, updatedAt: row.updated_at };
}

function slugify(value: string) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80);
}
function mapFaq(row: any) {
  return { id: row.id, question: row.question, answer: row.answer, sortOrder: row.sort_order, active: row.active };
}
function mapTeamMember(row: any) {
  return { id: row.id, name: row.name, role: row.role, bio: row.bio, initials: row.initials, sortOrder: row.sort_order, active: row.active, photoUrl: row.photo_url, longBio: row.long_bio, portfolioUrl: row.portfolio_url };
}

websiteContentRouter.get('/public-content', async (_req, res, next) => {
  try {
    const [announcements, faqs, team] = await Promise.all([
      query("SELECT * FROM website_announcements WHERE status='published' ORDER BY created_at DESC LIMIT 20"),
      query('SELECT * FROM website_faqs WHERE active=TRUE ORDER BY sort_order ASC, created_at ASC'),
      query('SELECT * FROM website_team_members WHERE active=TRUE ORDER BY sort_order ASC, created_at ASC'),
    ]);
    res.set('Cache-Control', 'public, max-age=60');
    res.json({ data: { announcements: announcements.rows.map(mapAnnouncement), faqs: faqs.rows.map(mapFaq), team: team.rows.map(mapTeamMember) } });
  } catch (e) { next(e); }
});

websiteContentRouter.get('/admin/website-content', requireAdmin, async (_req, res, next) => {
  try {
    const [announcements, faqs, team] = await Promise.all([
      query('SELECT * FROM website_announcements ORDER BY created_at DESC LIMIT 200'),
      query('SELECT * FROM website_faqs ORDER BY sort_order ASC, created_at ASC'),
      query('SELECT * FROM website_team_members ORDER BY sort_order ASC, created_at ASC'),
    ]);
    res.json({ data: { announcements: announcements.rows.map(mapAnnouncement), faqs: faqs.rows.map(mapFaq), team: team.rows.map(mapTeamMember) } });
  } catch (e) { next(e); }
});

const announcementSchema = z.object({ title: z.string().trim().min(2).max(160), body: z.string().trim().min(2).max(4000), summary: z.string().trim().max(280).optional().or(z.literal('').transform(() => undefined)), status: z.enum(['draft', 'published']).default('draft') });
const faqSchema = z.object({ question: z.string().trim().min(2).max(300), answer: z.string().trim().min(2).max(2000), sortOrder: z.coerce.number().int().min(0).max(10000).default(0) });
const emptyToUndefined = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? undefined : value);
// Full external URL (portfolio link etc.).
const optionalUrl = z.preprocess(
  emptyToUndefined,
  z.string().trim().max(500).regex(/^https?:\/\//, 'Use a full http(s) URL').optional()
);
// A team photo is either an uploaded asset path (/uploads/…) or a full URL.
const optionalPhoto = z.preprocess(
  emptyToUndefined,
  z.string().trim().max(500).regex(/^(https?:\/\/|\/uploads\/)/, 'Upload a photo or paste a full http(s) URL').optional()
);
const teamMemberSchema = z.object({
  name: z.string().trim().min(2).max(120),
  role: z.string().trim().min(2).max(120),
  bio: z.string().trim().min(2).max(1000),
  initials: z.string().trim().min(1).max(4),
  sortOrder: z.coerce.number().int().min(0).max(10000).default(0),
  photoUrl: optionalPhoto,
  longBio: z.preprocess(emptyToUndefined, z.string().trim().max(4000).optional()),
  portfolioUrl: optionalUrl,
});

websiteContentRouter.post('/admin/website-content/announcements', requireAdmin, validateBody(announcementSchema), async (req, res, next) => {
  try {
    const b = req.body;
    const baseSlug = slugify(b.title) || 'update';
    const r = await query(
      `INSERT INTO website_announcements (title,body,summary,status,slug,published_at,created_by)
       VALUES ($1,$2,$3,$4,$5 || '-' || substr(gen_random_uuid()::text,1,6), CASE WHEN $4='published' THEN NOW() ELSE NULL END,$6)
       RETURNING *`,
      [b.title, b.body, b.summary || null, b.status, baseSlug, req.admin?.adminId]
    );
    await audit(req, 'website_announcement_created', 'website_announcement', r.rows[0].id, null, r.rows[0]);
    res.status(201).json({ data: mapAnnouncement(r.rows[0]) });
  } catch (e) { next(e); }
});
websiteContentRouter.patch('/admin/website-content/announcements/:id', requireAdmin, async (req, res, next) => {
  try {
    const status = z.enum(['draft', 'published']).parse(req.body?.status);
    const before = await query('SELECT * FROM website_announcements WHERE id=$1', [req.params.id]);
    if (!before.rowCount) return res.status(404).json({ message: 'Announcement not found' });
    const r = await query(
      `UPDATE website_announcements
       SET status=$2, published_at = CASE WHEN $2='published' THEN COALESCE(published_at, NOW()) ELSE published_at END, updated_at=NOW()
       WHERE id=$1 RETURNING *`,
      [req.params.id, status]
    );
    await audit(req, status === 'published' ? 'website_announcement_published' : 'website_announcement_unpublished', 'website_announcement', String(req.params.id), before.rows[0], r.rows[0]);
    res.json({ data: mapAnnouncement(r.rows[0]) });
  } catch (e) { next(e); }
});

websiteContentRouter.post('/admin/website-content/faqs', requireAdmin, validateBody(faqSchema), async (req, res, next) => {
  try {
    const b = req.body;
    const r = await query('INSERT INTO website_faqs (question,answer,sort_order) VALUES ($1,$2,$3) RETURNING *', [b.question, b.answer, b.sortOrder]);
    await audit(req, 'website_faq_created', 'website_faq', r.rows[0].id, null, r.rows[0]);
    res.status(201).json({ data: mapFaq(r.rows[0]) });
  } catch (e) { next(e); }
});
websiteContentRouter.patch('/admin/website-content/faqs/:id', requireAdmin, async (req, res, next) => {
  try {
    const active = z.boolean().parse(req.body?.active);
    const before = await query('SELECT * FROM website_faqs WHERE id=$1', [req.params.id]);
    if (!before.rowCount) return res.status(404).json({ message: 'FAQ not found' });
    const r = await query('UPDATE website_faqs SET active=$2, updated_at=NOW() WHERE id=$1 RETURNING *', [req.params.id, active]);
    await audit(req, active ? 'website_faq_enabled' : 'website_faq_disabled', 'website_faq', String(req.params.id), before.rows[0], r.rows[0]);
    res.json({ data: mapFaq(r.rows[0]) });
  } catch (e) { next(e); }
});

websiteContentRouter.post('/admin/website-content/team', requireAdmin, validateBody(teamMemberSchema), async (req, res, next) => {
  try {
    const b = req.body;
    const r = await query(
      'INSERT INTO website_team_members (name,role,bio,initials,sort_order,photo_url,long_bio,portfolio_url) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [b.name, b.role, b.bio, b.initials.toUpperCase(), b.sortOrder, b.photoUrl || null, b.longBio || null, b.portfolioUrl || null]
    );
    await audit(req, 'website_team_member_created', 'website_team_member', r.rows[0].id, null, r.rows[0]);
    res.status(201).json({ data: mapTeamMember(r.rows[0]) });
  } catch (e) { next(e); }
});
websiteContentRouter.put('/admin/website-content/team/:id', requireAdmin, validateBody(teamMemberSchema), async (req, res, next) => {
  try {
    const b = req.body;
    const before = await query('SELECT * FROM website_team_members WHERE id=$1', [req.params.id]);
    if (!before.rowCount) return res.status(404).json({ message: 'Team member not found' });
    const r = await query(
      'UPDATE website_team_members SET name=$2,role=$3,bio=$4,initials=$5,sort_order=$6,photo_url=$7,long_bio=$8,portfolio_url=$9,updated_at=NOW() WHERE id=$1 RETURNING *',
      [req.params.id, b.name, b.role, b.bio, b.initials.toUpperCase(), b.sortOrder, b.photoUrl || null, b.longBio || null, b.portfolioUrl || null]
    );
    await audit(req, 'website_team_member_updated', 'website_team_member', String(req.params.id), before.rows[0], r.rows[0]);
    res.json({ data: mapTeamMember(r.rows[0]) });
  } catch (e) { next(e); }
});
websiteContentRouter.patch('/admin/website-content/team/:id', requireAdmin, async (req, res, next) => {
  try {
    const active = z.boolean().parse(req.body?.active);
    const before = await query('SELECT * FROM website_team_members WHERE id=$1', [req.params.id]);
    if (!before.rowCount) return res.status(404).json({ message: 'Team member not found' });
    const r = await query('UPDATE website_team_members SET active=$2, updated_at=NOW() WHERE id=$1 RETURNING *', [req.params.id, active]);
    await audit(req, active ? 'website_team_member_shown' : 'website_team_member_hidden', 'website_team_member', String(req.params.id), before.rows[0], r.rows[0]);
    res.json({ data: mapTeamMember(r.rows[0]) });
  } catch (e) { next(e); }
});

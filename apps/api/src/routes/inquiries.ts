import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool';
import { requireAdmin } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { audit } from '../services/auditService';

export const inquiriesRouter = Router();

function mapInquiry(row: any) {
  return { id: row.id, name: row.name, email: row.email, category: row.category, message: row.message, status: row.status, createdAt: row.created_at };
}

const inquirySchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(160),
  category: z.enum(['general', 'technical', 'organisation', 'partnership', 'privacy']),
  message: z.string().trim().min(10).max(3000),
});

inquiriesRouter.post('/inquiries', validateBody(inquirySchema), async (req, res, next) => {
  try {
    const b = req.body;
    const ip = String(req.ip || req.socket.remoteAddress || '').replace(/^::ffff:/, '').slice(0, 64);
    const r = await query(
      'INSERT INTO website_inquiries (name,email,category,message,ip_address) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [b.name, b.email, b.category, b.message, ip]
    );
    res.status(201).json({ data: { id: r.rows[0].id } });
  } catch (e) { next(e); }
});

inquiriesRouter.get('/admin/inquiries', requireAdmin, async (_req, res, next) => {
  try {
    const rows = await query('SELECT * FROM website_inquiries ORDER BY created_at DESC LIMIT 300');
    res.json({ data: rows.rows.map(mapInquiry) });
  } catch (e) { next(e); }
});

inquiriesRouter.patch('/admin/inquiries/:id', requireAdmin, async (req, res, next) => {
  try {
    const status = z.enum(['new', 'resolved']).parse(req.body?.status);
    const before = await query('SELECT * FROM website_inquiries WHERE id=$1', [req.params.id]);
    if (!before.rowCount) return res.status(404).json({ message: 'Enquiry not found' });
    const r = await query('UPDATE website_inquiries SET status=$2, updated_at=NOW() WHERE id=$1 RETURNING *', [req.params.id, status]);
    await audit(req, status === 'resolved' ? 'inquiry_resolved' : 'inquiry_reopened', 'website_inquiry', String(req.params.id), before.rows[0], r.rows[0]);
    res.json({ data: mapInquiry(r.rows[0]) });
  } catch (e) { next(e); }
});

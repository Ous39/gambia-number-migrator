import { Router } from 'express';
import { query } from '../db/pool';
import { requireAdmin } from '../middleware/auth';
export const auditLogsRouter = Router();
auditLogsRouter.get('/admin/audit-logs', requireAdmin, async (_req, res, next) => {
  try { res.json({ data: (await query('SELECT al.*, a.username FROM audit_logs al LEFT JOIN admins a ON a.id=al.admin_id ORDER BY al.created_at DESC LIMIT 300')).rows }); } catch (e) { next(e); }
});

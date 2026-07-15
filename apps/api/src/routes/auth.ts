import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../db/pool';
import { requireAdmin, signAdminToken } from '../middleware/auth';
import { audit } from '../services/auditService';

export const authRouter = Router();
const loginSchema = z.object({ username: z.string().min(2), password: z.string().min(6) });

authRouter.post('/auth/login', async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const result = await query('SELECT * FROM admins WHERE username=$1 AND status=$2 LIMIT 1', [body.username, 'active']);
    const admin = result.rows[0];
    if (!admin || !(await bcrypt.compare(body.password, admin.password_hash))) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    req.admin = { adminId: admin.id, username: admin.username, role: admin.role };
    await audit(req, 'admin_login', 'admin', admin.id);
    res.json({ token: signAdminToken(req.admin), admin: { id: admin.id, username: admin.username, fullName: admin.full_name, role: admin.role } });
  } catch (e) { next(e); }
});

authRouter.post('/auth/logout', requireAdmin, async (req, res, next) => {
  try { await audit(req, 'admin_logout', 'admin', req.admin?.adminId); res.json({ ok: true }); } catch (e) { next(e); }
});

authRouter.get('/auth/me', requireAdmin, async (req, res) => res.json({ admin: req.admin }));

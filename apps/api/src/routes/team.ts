import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../db/pool';
import { requireAdmin, requireRoles } from '../middleware/auth';
import { audit } from '../services/auditService';

export const teamRouter = Router();
const roles = ['owner', 'admin', 'operations', 'finance', 'support', 'viewer'] as const;
const createSchema = z.object({ username: z.string().trim().min(3).max(60).regex(/^[a-zA-Z0-9._-]+$/), fullName: z.string().trim().min(2).max(100), role: z.enum(roles), password: z.string().min(12).max(200) });
const updateSchema = z.object({ fullName: z.string().trim().min(2).max(100), role: z.enum(roles), status: z.enum(['active', 'disabled']) });
const passwordSchema = z.object({ password: z.string().min(12).max(200) });
const ownerOnly = [requireAdmin, requireRoles('owner')] as const;

teamRouter.get('/admin/team', ...ownerOnly, async (_req, res, next) => {
  try { res.json({ data: (await query('SELECT id,username,full_name,role,status,created_at,updated_at FROM admins ORDER BY created_at')).rows }); } catch (e) { next(e); }
});

teamRouter.post('/admin/team', ...ownerOnly, async (req, res, next) => {
  try {
    const b = createSchema.parse(req.body); const hash = await bcrypt.hash(b.password, 12);
    const r = await query(`INSERT INTO admins (username,password_hash,full_name,role,status) VALUES ($1,$2,$3,$4,'active') RETURNING id,username,full_name,role,status,created_at`, [b.username.toLowerCase(),hash,b.fullName,b.role]);
    await audit(req,'team_account_created','admin',r.rows[0].id,null,r.rows[0]); res.status(201).json({ data:r.rows[0] });
  } catch (e:any) { if (e?.code === '23505') return res.status(409).json({ message:'Username already exists' }); next(e); }
});

teamRouter.put('/admin/team/:id', ...ownerOnly, async (req, res, next) => {
  try {
    const b=updateSchema.parse(req.body); const old=(await query('SELECT id,username,full_name,role,status FROM admins WHERE id=$1',[req.params.id])).rows[0];
    if(!old) return res.status(404).json({message:'Team account not found'});
    if(old.id===req.admin!.adminId && b.status==='disabled') return res.status(400).json({message:'You cannot disable your own account'});
    if(old.role==='owner' && (b.role!=='owner'||b.status!=='active')) { const owners=await query("SELECT COUNT(*)::int count FROM admins WHERE role='owner' AND status='active'"); if(owners.rows[0].count<=1) return res.status(400).json({message:'At least one active owner is required'}); }
    const r=await query('UPDATE admins SET full_name=$1,role=$2,status=$3,updated_at=NOW() WHERE id=$4 RETURNING id,username,full_name,role,status,created_at,updated_at',[b.fullName,b.role,b.status,req.params.id]);
    await audit(req,'team_account_updated','admin',String(req.params.id),old,r.rows[0]); res.json({data:r.rows[0]});
  } catch(e){next(e);}
});

teamRouter.put('/admin/team/:id/password', ...ownerOnly, async (req,res,next)=>{
  try { const b=passwordSchema.parse(req.body); const hash=await bcrypt.hash(b.password,12); const r=await query('UPDATE admins SET password_hash=$1,updated_at=NOW() WHERE id=$2 RETURNING id,username',[hash,req.params.id]); if(!r.rowCount)return res.status(404).json({message:'Team account not found'}); await audit(req,'team_password_reset','admin',String(req.params.id)); res.json({ok:true}); } catch(e){next(e);}
});

import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { query } from '../db/pool';

export interface AdminJwtPayload { adminId: string; username: string; role: string; }

declare global {
  namespace Express {
    interface Request { admin?: AdminJwtPayload; }
  }
}

export function signAdminToken(payload: AdminJwtPayload) {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: '12h' });
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const header = req.header('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!token) return res.status(401).json({ message: 'Authentication required' });
  try {
    const decoded = jwt.verify(token, env.jwtSecret) as AdminJwtPayload;
    const current = await query('SELECT id,username,role,status FROM admins WHERE id=$1 LIMIT 1', [decoded.adminId]);
    if (!current.rowCount || current.rows[0].status !== 'active') return res.status(401).json({ message: 'Account is inactive or no longer exists' });
    req.admin = { adminId: current.rows[0].id, username: current.rows[0].username, role: current.rows[0].role };
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

export function requireRoles(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.admin || !roles.includes(req.admin.role)) return res.status(403).json({ message: 'Your team role does not allow this action' });
    next();
  };
}

const roleAreas: Record<string, string[]> = {
  owner: ['*'], admin: ['*'],
  operations: ['/dashboard','/migration-rules','/transition-settings','/notifications','/operators','/app-config'],
  finance: ['/dashboard','/payments'], support: ['/dashboard','/support-devices','/notifications'], viewer: ['*'],
};
export function requireAdminAreaAccess(req: Request,res: Response,next: NextFunction){
  const role=req.admin?.role||''; const allowed=roleAreas[role]||[];
  if(role==='viewer'&&req.method!=='GET')return res.status(403).json({message:'Viewer accounts are read-only'});
  if(role==='admin'&&req.path.startsWith('/team'))return res.status(403).json({message:'Only the owner can manage team accounts'});
  if(allowed.includes('*')||allowed.some(area=>req.path.startsWith(area)))return next();
  return res.status(403).json({message:'Your team role does not allow access to this section'});
}

import type { Request } from 'express';
import { query } from '../db/pool';

export async function audit(req: Request, action: string, entityType: string, entityId?: string, oldValue?: unknown, newValue?: unknown) {
  await query(
    `INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, old_value_json, new_value_json, ip_address, user_agent)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [req.admin?.adminId || null, action, entityType, entityId || null, oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null, req.ip, req.header('user-agent')]
  );
}

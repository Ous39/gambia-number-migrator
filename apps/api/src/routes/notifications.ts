import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool';
import { requireAdmin } from '../middleware/auth';
import { audit } from '../services/auditService';
import { env } from '../config/env';

export const notificationsRouter = Router();
const tokenSchema = z.object({ deviceId: z.string().min(8).max(200), expoPushToken: z.string().min(10).max(300), platform: z.enum(['android', 'ios']) });
const notificationSchema = z.object({ title: z.string().trim().min(2).max(80), message: z.string().trim().min(2).max(500), target: z.enum(['all', 'android', 'ios']).default('all'), data: z.record(z.unknown()).optional().default({}) });

notificationsRouter.post('/notifications/register-token', async (req, res, next) => {
  try {
    const b = tokenSchema.parse(req.body);
    const device = await query('SELECT id,status FROM devices WHERE id=$1', [b.deviceId]);
    if (!device.rowCount) return res.status(404).json({ message: 'Register the device before enabling notifications' });
    if (device.rows[0].status === 'blocked') return res.status(403).json({ message: 'Device is blocked' });
    await query(`INSERT INTO device_push_tokens (device_id,expo_push_token,platform) VALUES ($1,$2,$3)
      ON CONFLICT (expo_push_token) DO UPDATE SET device_id=EXCLUDED.device_id,platform=EXCLUDED.platform,active=TRUE,last_seen_at=NOW()`, [b.deviceId,b.expoPushToken,b.platform]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

notificationsRouter.get('/notifications', async (req, res, next) => {
  try {
    const deviceId = String(req.query.deviceId || '');
    if (deviceId.length < 8) return res.status(400).json({ message: 'Valid deviceId is required' });
    const device = await query('SELECT platform,status FROM devices WHERE id=$1', [deviceId]);
    if (!device.rowCount) return res.status(404).json({ message: 'Device not found' });
    if (device.rows[0].status === 'blocked') return res.status(403).json({ message: 'Device is blocked' });
    const rows = await query(`SELECT id,title,message,target,data_json,created_at,sent_at FROM notifications WHERE status IN ('sent','partial') AND target IN ('all',$1) ORDER BY sent_at DESC LIMIT 100`, [device.rows[0].platform]);
    res.json({ data: rows.rows });
  } catch (e) { next(e); }
});

notificationsRouter.get('/admin/notifications', requireAdmin, async (_req, res, next) => {
  try { res.json({ data: (await query('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 200')).rows }); } catch (e) { next(e); }
});

notificationsRouter.post('/admin/notifications', requireAdmin, async (req, res, next) => {
  try {
    const b = notificationSchema.parse(req.body);
    const created = await query(`INSERT INTO notifications (title,message,target,data_json,status,created_by) VALUES ($1,$2,$3,$4,'sending',$5) RETURNING *`, [b.title,b.message,b.target,JSON.stringify(b.data),req.admin!.adminId]);
    const notification = created.rows[0];
    const tokens = await query(`SELECT id,expo_push_token FROM device_push_tokens WHERE active=TRUE AND ($1='all' OR platform=$1)`, [b.target]);
    let sent = 0, failed = 0;
    for (let i = 0; i < tokens.rows.length; i += 100) {
      const tokenBatch = tokens.rows.slice(i, i + 100);
      const batch = tokenBatch.map((row) => ({
        to: row.expo_push_token,
        sound: 'default',
        priority: 'high',
        channelId: 'general',
        interruptionLevel: 'active',
        badge: 1,
        title: b.title,
        body: b.message,
        data: { ...b.data, notificationId: notification.id },
      }));
      if (!batch.length) continue;
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
        if (env.expoAccessToken) headers.Authorization = `Bearer ${env.expoAccessToken}`;
        const response = await fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers, body: JSON.stringify(batch) });
        if (!response.ok) throw new Error(`Expo push returned ${response.status}`);
        const result: any = await response.json(); const tickets = Array.isArray(result?.data) ? result.data : [];
        const ok = tickets.filter((ticket: any) => ticket.status === 'ok').length; sent += ok; failed += batch.length - ok;
        const invalidTokenIds = tickets.flatMap((ticket: any, index: number) => ticket?.details?.error === 'DeviceNotRegistered' ? [tokenBatch[index]?.id] : []).filter(Boolean);
        if (invalidTokenIds.length) await query('UPDATE device_push_tokens SET active=FALSE WHERE id = ANY($1::uuid[])', [invalidTokenIds]);
      } catch { failed += batch.length; }
    }
    const status = tokens.rows.length === 0 ? 'no_devices' : failed === 0 ? 'sent' : sent > 0 ? 'partial' : 'failed';
    const updated = await query(`UPDATE notifications SET status=$2,sent_count=$3,failed_count=$4,sent_at=NOW() WHERE id=$1 RETURNING *`, [notification.id,status,sent,failed]);
    await audit(req, 'notification_sent', 'notification', notification.id, null, updated.rows[0]);
    res.status(201).json({ data: { ...updated.rows[0], eligible_device_count: tokens.rows.length } });
  } catch (e) { next(e); }
});

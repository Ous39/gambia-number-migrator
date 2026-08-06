import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool';
import { requireAdmin } from '../middleware/auth';
import { audit } from '../services/auditService';
import { env } from '../config/env';

export const notificationsRouter = Router();
const tokenSchema = z.object({ deviceId: z.string().min(8).max(200), expoPushToken: z.string().regex(/^(Exponent|Expo)PushToken\[[^\]]+\]$/, 'Invalid Expo push token'), platform: z.enum(['android', 'ios']) });
const preferenceSchema = z.object({ deviceId: z.string().min(8).max(200), enabled: z.boolean() });
const notificationSchema = z.object({ title: z.string().trim().min(2).max(80), message: z.string().trim().min(2).max(500), target: z.enum(['all', 'android', 'ios']).default('all'), audience: z.enum(['all', 'trial', 'subscribed']).default('all'), data: z.record(z.unknown()).optional().default({}) });

notificationsRouter.post('/notifications/register-token', async (req, res, next) => {
  try {
    const b = tokenSchema.parse(req.body);
    const device = await query('SELECT id,status FROM devices WHERE id=$1', [b.deviceId]);
    if (!device.rowCount) return res.status(404).json({ message: 'Register the device before enabling notifications' });
    if (device.rows[0].status === 'blocked') return res.status(403).json({ message: 'Device is blocked' });
    await query('UPDATE device_push_tokens SET active=FALSE WHERE device_id=$1 AND platform=$2 AND expo_push_token<>$3', [b.deviceId,b.platform,b.expoPushToken]);
    await query(`INSERT INTO device_push_tokens (device_id,expo_push_token,platform) VALUES ($1,$2,$3)
      ON CONFLICT (expo_push_token) DO UPDATE SET device_id=EXCLUDED.device_id,platform=EXCLUDED.platform,active=TRUE,last_seen_at=NOW()`, [b.deviceId,b.expoPushToken,b.platform]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

notificationsRouter.post('/notifications/preferences', async (req, res, next) => {
  try {
    const b = preferenceSchema.parse(req.body);
    const device = await query('SELECT id,status FROM devices WHERE id=$1', [b.deviceId]);
    if (!device.rowCount) return res.status(404).json({ message: 'Device not found' });
    if (device.rows[0].status === 'blocked') return res.status(403).json({ message: 'Device is blocked' });
    if (!b.enabled) await query('UPDATE device_push_tokens SET active=FALSE,last_seen_at=NOW() WHERE device_id=$1', [b.deviceId]);
    res.json({ data: { enabled: b.enabled } });
  } catch (e) { next(e); }
});

notificationsRouter.get('/notifications', async (req, res, next) => {
  try {
    const deviceId = String(req.query.deviceId || '');
    if (deviceId.length < 8) return res.status(400).json({ message: 'Valid deviceId is required' });
    const device = await query('SELECT platform,status FROM devices WHERE id=$1', [deviceId]);
    if (!device.rowCount) return res.status(404).json({ message: 'Device not found' });
    if (device.rows[0].status === 'blocked') return res.status(403).json({ message: 'Device is blocked' });
    const rows = await query(`SELECT id,title,message,target,audience,data_json,created_at,sent_at FROM notifications WHERE enabled=TRUE AND status IN ('sent','partial') AND target IN ('all',$1) AND (audience='all' OR (audience='trial' AND $2='trial') OR (audience='subscribed' AND $2='active')) ORDER BY sent_at DESC LIMIT 100`, [device.rows[0].platform,device.rows[0].status]);
    res.json({ data: rows.rows });
  } catch (e) { next(e); }
});

notificationsRouter.get('/admin/notifications', requireAdmin, async (_req, res, next) => {
  try { res.json({ data: (await query('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 200')).rows }); } catch (e) { next(e); }
});

notificationsRouter.post('/admin/notifications', requireAdmin, async (req, res, next) => {
  try {
    const b = notificationSchema.parse(req.body);
    const created = await query(`INSERT INTO notifications (title,message,target,audience,data_json,status,created_by) VALUES ($1,$2,$3,$4,$5,'sending',$6) RETURNING *`, [b.title,b.message,b.target,b.audience,JSON.stringify(b.data),req.admin!.adminId]);
    const notification = created.rows[0];
    const tokens = await query(`SELECT t.id,t.expo_push_token FROM device_push_tokens t JOIN devices d ON d.id=t.device_id WHERE t.active=TRUE AND d.status<>'blocked' AND ($1='all' OR t.platform=$1) AND ($2='all' OR ($2='trial' AND d.status='trial') OR ($2='subscribed' AND d.status='active'))`, [b.target,b.audience]);
    let sent = 0, failed = 0; const errors: string[] = [];
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
        tickets.forEach((ticket: any) => { if (ticket?.status === 'error' && errors.length < 5) errors.push(String(ticket?.details?.error || ticket?.message || 'Push rejected')); });
        const invalidTokenIds = tickets.flatMap((ticket: any, index: number) => ticket?.details?.error === 'DeviceNotRegistered' ? [tokenBatch[index]?.id] : []).filter(Boolean);
        if (invalidTokenIds.length) await query('UPDATE device_push_tokens SET active=FALSE WHERE id = ANY($1::uuid[])', [invalidTokenIds]);
      } catch (error: any) { failed += batch.length; if (errors.length < 5) errors.push(error?.message || 'Push request failed'); }
    }
    const status = tokens.rows.length === 0 ? 'no_devices' : failed === 0 ? 'sent' : sent > 0 ? 'partial' : 'failed';
    const updated = await query(`UPDATE notifications SET status=$2,sent_count=$3,failed_count=$4,sent_at=NOW() WHERE id=$1 RETURNING *`, [notification.id,status,sent,failed]);
    await audit(req, 'notification_sent', 'notification', notification.id, null, updated.rows[0]);
    res.status(201).json({ data: { ...updated.rows[0], eligible_device_count: tokens.rows.length, errors } });
  } catch (e) { next(e); }
});

notificationsRouter.patch('/admin/notifications/:id/enabled', requireAdmin, async (req, res, next) => {
  try {
    const notificationId = String(req.params.id);
    const { enabled } = z.object({ enabled: z.boolean() }).parse(req.body);
    const before = await query('SELECT * FROM notifications WHERE id=$1', [notificationId]);
    if (!before.rowCount) return res.status(404).json({ message: 'Notification not found' });
    const updated = await query('UPDATE notifications SET enabled=$2 WHERE id=$1 RETURNING *', [notificationId,enabled]);
    await audit(req, enabled ? 'notification_enabled' : 'notification_disabled', 'notification', notificationId, before.rows[0], updated.rows[0]);
    res.json({ data: updated.rows[0] });
  } catch (e) { next(e); }
});

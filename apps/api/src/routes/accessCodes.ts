import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../db/pool';
import { requireAdmin } from '../middleware/auth';
import { requireDeviceSecret } from '../middleware/deviceSecret';
import { audit } from '../services/auditService';

export const accessCodesRouter = Router();

// Crockford base32 without the ambiguous I, L, O, U.
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** GNM-XXXX-XXXX — 8 random Crockford chars, ~40 bits, uniqueness enforced by the DB. */
export function generateAccessCode(): string {
  const bytes = crypto.randomBytes(8);
  let body = '';
  for (let i = 0; i < 8; i += 1) body += CROCKFORD[bytes[i] % 32];
  return `GNM-${body.slice(0, 4)}-${body.slice(4, 8)}`;
}

/** Forgiving parse of user-typed input: upper-case, strip noise, fix look-alikes. */
export function normalizeAccessCode(raw: string): string | null {
  const cleaned = String(raw || '')
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
    .replace(/U/g, 'V');
  const body = cleaned.startsWith('GNM') ? cleaned.slice(3) : cleaned;
  if (body.length !== 8) return null;
  if (![...body].every((ch) => CROCKFORD.includes(ch))) return null;
  return `GNM-${body.slice(0, 4)}-${body.slice(4, 8)}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function publicCode(row: any) {
  return {
    id: row.id,
    code: row.code,
    seats: row.seats,
    redeemedCount: row.redeemed_count,
    seatsRemaining: Math.max(0, row.seats - row.redeemed_count),
    source: row.source,
    status: row.status,
    label: row.label,
    paymentReference: row.payment_reference || null,
    paymentAmount: row.payment_amount != null ? Number(row.payment_amount) : null,
    paymentCurrency: row.payment_currency || null,
    expiresAt: row.expires_at,
    createdAt: row.created_at
  };
}

/** Set a device to active/code unless it is blocked. Never creates a device. */
async function unlockByCode(client: import('pg').PoolClient, deviceId: string) {
  await client.query(
    `UPDATE devices SET
       status = CASE WHEN status = 'blocked' THEN status ELSE 'active' END,
       access_source = CASE WHEN status = 'blocked' THEN access_source ELSE 'code' END,
       subscribed_at = COALESCE(subscribed_at, NOW()),
       updated_at = NOW()
     WHERE id = $1`,
    [deviceId]
  );
}

// --- Device: redeem a code ---------------------------------------------------
const redeemSchema = z.object({
  deviceId: z.string().min(8).max(200),
  code: z.string().min(6).max(40)
});

accessCodesRouter.post('/access/redeem', requireDeviceSecret, async (req, res, next) => {
  try {
    const b = redeemSchema.parse(req.body);
    const code = normalizeAccessCode(b.code);
    if (!code) return res.status(400).json({ message: 'That code does not look right. Check for typos and try again.' });

    const result = await withTransaction(async (client) => {
      const found = await client.query('SELECT * FROM access_codes WHERE code=$1 FOR UPDATE', [code]);
      if (!found.rowCount) return { ok: false as const, status: 404, message: 'This organisation code was not found.' };
      const ac = found.rows[0];

      const device = await client.query('SELECT id,status FROM devices WHERE id=$1 LIMIT 1', [b.deviceId]);
      if (!device.rowCount) return { ok: false as const, status: 404, message: 'Device not registered.' };
      if (device.rows[0].status === 'blocked') return { ok: false as const, status: 403, message: 'This device is blocked. Contact support.' };

      // Already redeemed on this device -> idempotent success, no extra seat used.
      const already = await client.query('SELECT 1 FROM access_code_redemptions WHERE code_id=$1 AND device_id=$2', [ac.id, b.deviceId]);
      if (already.rowCount) {
        await unlockByCode(client, b.deviceId);
        return { ok: true as const, seatsRemaining: Math.max(0, ac.seats - ac.redeemed_count), alreadyRedeemed: true };
      }

      if (ac.status === 'revoked') return { ok: false as const, status: 409, message: 'This code has been cancelled by the issuer.' };
      if (ac.status !== 'active') return { ok: false as const, status: 409, message: 'This code is no longer valid.' };
      if (ac.expires_at && new Date(ac.expires_at).getTime() < Date.now()) {
        await client.query("UPDATE access_codes SET status='expired', updated_at=NOW() WHERE id=$1", [ac.id]);
        return { ok: false as const, status: 409, message: 'This code has expired.' };
      }
      if (ac.redeemed_count >= ac.seats) {
        return { ok: false as const, status: 409, message: 'All device slots for this code have already been used.' };
      }

      await client.query('INSERT INTO access_code_redemptions (code_id, device_id) VALUES ($1,$2)', [ac.id, b.deviceId]);
      await client.query('UPDATE access_codes SET redeemed_count = redeemed_count + 1, updated_at = NOW() WHERE id=$1', [ac.id]);
      await unlockByCode(client, b.deviceId);
      await client.query(
        `INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, new_value_json)
         VALUES (NULL,'access_code_redeemed','access_code',$1,$2)`,
        [ac.id, JSON.stringify({ code, deviceId: b.deviceId, seat: ac.redeemed_count + 1, seats: ac.seats })]
      );
      return { ok: true as const, seatsRemaining: Math.max(0, ac.seats - (ac.redeemed_count + 1)), alreadyRedeemed: false };
    });

    if (!result.ok) return res.status(result.status).json({ message: result.message });
    return res.json({ data: { status: 'active', seatsRemaining: result.seatsRemaining, alreadyRedeemed: result.alreadyRedeemed } });
  } catch (e) { next(e); }
});

// --- Admin: generate / list / inspect / revoke -----------------------------
const generateSchema = z.object({
  seats: z.coerce.number().int().min(1).max(100000),
  quantity: z.coerce.number().int().min(1).max(200).default(1),
  label: z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), z.string().trim().max(160).optional()),
  expiresAt: z.string().datetime().optional()
});

accessCodesRouter.post('/admin/access-codes', requireAdmin, async (req, res, next) => {
  try {
    const b = generateSchema.parse(req.body);
    const created: any[] = [];
    await withTransaction(async (client) => {
      for (let i = 0; i < b.quantity; i += 1) {
        let row: any = null;
        for (let attempt = 0; attempt < 5 && !row; attempt += 1) {
          const r = await client.query(
            `INSERT INTO access_codes (code, seats, source, status, label, created_by, expires_at)
             VALUES ($1,$2,'admin','active',$3,$4,$5)
             ON CONFLICT (code) DO NOTHING RETURNING *`,
            [generateAccessCode(), b.seats, b.label || null, req.admin?.username || 'admin', b.expiresAt || null]
          );
          if (r.rowCount) row = r.rows[0];
        }
        if (!row) throw Object.assign(new Error('Could not allocate a unique code. Please retry.'), { status: 500 });
        created.push(row);
      }
    });
    await audit(req, 'access_codes_generated', 'access_code', undefined, undefined, {
      quantity: b.quantity, seats: b.seats, label: b.label || null, codes: created.map((c) => c.code)
    });
    res.status(201).json({ data: created.map(publicCode) });
  } catch (e) { next(e); }
});

accessCodesRouter.get('/admin/access-codes', requireAdmin, async (_req, res, next) => {
  try {
    const rows = (await query(
      `SELECT ac.*,
              p.reference AS payment_reference,
              p.amount    AS payment_amount,
              p.currency  AS payment_currency
       FROM access_codes ac
       LEFT JOIN payments p ON p.id = ac.payment_id
       ORDER BY ac.created_at DESC
       LIMIT 500`
    )).rows;
    res.json({ data: rows.map(publicCode) });
  } catch (e) { next(e); }
});

accessCodesRouter.get('/admin/access-codes/:id/redemptions', requireAdmin, async (req, res, next) => {
  try {
    if (!UUID_RE.test(String(req.params.id))) return res.status(404).json({ message: 'Code not found.' });
    const rows = (await query(
      `SELECT acr.device_id, acr.redeemed_at, d.status AS device_status, d.access_source AS device_access_source
       FROM access_code_redemptions acr
       LEFT JOIN devices d ON d.id = acr.device_id
       WHERE acr.code_id = $1
       ORDER BY acr.redeemed_at DESC`,
      [req.params.id]
    )).rows;
    res.json({ data: rows });
  } catch (e) { next(e); }
});

accessCodesRouter.post('/admin/access-codes/:id/revoke', requireAdmin, async (req, res, next) => {
  try {
    if (!UUID_RE.test(String(req.params.id))) return res.status(404).json({ message: 'Code not found.' });
    const r = await query(
      "UPDATE access_codes SET status='revoked', updated_at=NOW() WHERE id=$1 AND status<>'revoked' RETURNING *",
      [req.params.id]
    );
    if (!r.rowCount) return res.status(404).json({ message: 'Code not found or already revoked.' });
    const activeDevices = Number((await query(
      `SELECT COUNT(*)::int AS n
       FROM access_code_redemptions acr
       JOIN devices d ON d.id = acr.device_id
       WHERE acr.code_id = $1 AND d.status = 'active' AND d.access_source = 'code'`,
      [req.params.id]
    )).rows[0]?.n || 0);
    await audit(req, 'access_code_revoked', 'access_code', String(req.params.id), null, { activeDevicesStillUnlocked: activeDevices });
    res.json({ data: { ...publicCode(r.rows[0]), activeDevicesStillUnlocked: activeDevices } });
  } catch (e) { next(e); }
});

import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { query } from '../db/pool';

function hashSecret(secret: string) {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

function secretsMatch(supplied: string, storedHash: string) {
  const suppliedHash = Buffer.from(hashSecret(supplied), 'hex');
  const expectedHash = Buffer.from(storedHash, 'hex');
  return suppliedHash.length === expectedHash.length && crypto.timingSafeEqual(suppliedHash, expectedHash);
}

function returnMigratedSecret(res: Response, deviceSecret: string) {
  const json = res.json.bind(res);
  res.json = ((body: unknown) => json({ ...(body as Record<string, unknown>), deviceSecret })) as Response['json'];
}

export async function requireDeviceSecret(req: Request, res: Response, next: NextFunction) {
  try {
    const deviceId = String(req.params.fingerprint || req.body?.deviceId || req.query?.deviceId || '');
    if (!deviceId) return res.status(400).json({ message: 'Device ID is required' });
    const found = await query('SELECT id,device_secret_hash FROM devices WHERE id=$1 LIMIT 1', [deviceId]);
    if (!found.rowCount) return res.status(404).json({ message: 'Device not registered' });

    const supplied = String(req.header('x-device-secret') || '');
    const storedHash = found.rows[0].device_secret_hash as string | null;
    if (storedHash) {
      if (!supplied || !secretsMatch(supplied, storedHash)) return res.status(401).json({ message: 'Invalid or missing device secret' });
      return next();
    }

    // Transitional soft migration: legacy devices claim a secret on their first protected request and receive it once if the client had none.
    const migratedSecret = supplied || crypto.randomBytes(32).toString('hex');
    const updated = await query(
      'UPDATE devices SET device_secret_hash=$2,updated_at=NOW() WHERE id=$1 AND device_secret_hash IS NULL RETURNING id',
      [deviceId, hashSecret(migratedSecret)]
    );
    if (!updated.rowCount) return res.status(409).json({ message: 'Device security was updated. Please retry.' });
    if (!supplied) returnMigratedSecret(res, migratedSecret);
    return next();
  } catch (error) {
    next(error);
  }
}

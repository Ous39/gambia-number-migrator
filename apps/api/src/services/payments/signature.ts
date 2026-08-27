import crypto from 'node:crypto';

// Wave request signing + webhook verification.
// Ref: https://docs.wave.com/business#enabling-request-signing and
//      https://docs.wave.com/webhook
//
// Both directions use the SAME construction:
//   signature = HMAC_SHA256(secret, `${unixSeconds}` + rawBody)
//   header    = `Wave-Signature: t=<unixSeconds>,v1=<hex signature>`
// The webhook header MAY carry several `v1=` values during secret rotation.

export interface ParsedWaveSignature {
  timestamp: number;
  signatures: string[];
}

export function parseWaveSignatureHeader(header: string | undefined | null): ParsedWaveSignature | null {
  if (!header) return null;
  let timestamp = NaN;
  const signatures: string[] = [];
  for (const part of header.split(',')) {
    const [rawKey, ...rest] = part.split('=');
    const key = rawKey?.trim();
    const value = rest.join('=').trim();
    if (!key || !value) continue;
    if (key === 't') timestamp = Number(value);
    else if (key === 'v1') signatures.push(value.toLowerCase());
  }
  if (!Number.isFinite(timestamp) || signatures.length === 0) return null;
  return { timestamp, signatures };
}

export function computeWaveSignature(secret: string, timestamp: number | string, rawBody: Buffer | string): string {
  const body = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;
  return crypto.createHmac('sha256', secret).update(`${timestamp}${body}`).digest('hex');
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let bufA: Buffer;
  let bufB: Buffer;
  try {
    bufA = Buffer.from(a, 'hex');
    bufB = Buffer.from(b, 'hex');
  } catch {
    return false;
  }
  return bufA.length === bufB.length && bufA.length > 0 && crypto.timingSafeEqual(bufA, bufB);
}

export interface VerifyWaveOptions {
  /** All secrets to try (current first, then previous for rotation). */
  secrets: string[];
  /** How old (seconds) a timestamp may be. Wave's fixed rule is 300. */
  maxAgeSeconds: number;
  /** How far in the future (seconds) a timestamp may be. Wave's fixed rule is 30. */
  maxSkewSeconds?: number;
  /** Injectable for deterministic tests. */
  nowSeconds?: number;
}

export type WaveVerifyResult =
  | { ok: true; timestamp: number }
  | { ok: false; reason: 'missing_body' | 'bad_header' | 'expired' | 'future' | 'no_secret' | 'signature_mismatch' };

export function verifyWaveWebhook(
  rawBody: Buffer | undefined,
  header: string | undefined,
  opts: VerifyWaveOptions
): WaveVerifyResult {
  if (!rawBody || rawBody.length === 0) return { ok: false, reason: 'missing_body' };
  const parsed = parseWaveSignatureHeader(header);
  if (!parsed) return { ok: false, reason: 'bad_header' };

  const secrets = opts.secrets.filter((value) => typeof value === 'string' && value.length > 0);
  if (secrets.length === 0) return { ok: false, reason: 'no_secret' };

  const now = opts.nowSeconds ?? Math.floor(Date.now() / 1000);
  const skew = opts.maxSkewSeconds ?? 30;
  if (now - parsed.timestamp > opts.maxAgeSeconds) return { ok: false, reason: 'expired' };
  if (parsed.timestamp - now > skew) return { ok: false, reason: 'future' };

  for (const secret of secrets) {
    const expected = computeWaveSignature(secret, parsed.timestamp, rawBody);
    for (const supplied of parsed.signatures) {
      if (timingSafeEqualHex(supplied, expected)) return { ok: true, timestamp: parsed.timestamp };
    }
  }
  return { ok: false, reason: 'signature_mismatch' };
}

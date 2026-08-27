import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  computeWaveSignature,
  parseWaveSignatureHeader,
  verifyWaveWebhook
} from '../src/services/payments/signature';

const SECRET = 'wave_sn_test_secret_value';
const BODY = Buffer.from(JSON.stringify({ id: 'EV_1', type: 'checkout.session.completed', data: { id: 'cos-1', amount: '25', currency: 'GMD' } }));

function header(ts: number, sigs: string[]) {
  return `t=${ts},${sigs.map((s) => `v1=${s}`).join(',')}`;
}

describe('Wave signature construction', () => {
  it('signs `${timestamp}` + raw body with HMAC-SHA256 (no separator)', () => {
    const ts = 1700000000;
    const expected = crypto.createHmac('sha256', SECRET).update(`${ts}${BODY.toString('utf8')}`).digest('hex');
    expect(computeWaveSignature(SECRET, ts, BODY)).toBe(expected);
  });

  it('parses a multi-signature header (rotation)', () => {
    const parsed = parseWaveSignatureHeader('t=123,v1=aaaa,v1=bbbb');
    expect(parsed).toEqual({ timestamp: 123, signatures: ['aaaa', 'bbbb'] });
  });

  it('rejects a header with no v1', () => {
    expect(parseWaveSignatureHeader('t=123')).toBeNull();
  });
});

describe('verifyWaveWebhook', () => {
  const now = 1700000000;
  const good = computeWaveSignature(SECRET, now, BODY);

  it('accepts a valid single signature', () => {
    const r = verifyWaveWebhook(BODY, header(now, [good]), { secrets: [SECRET], maxAgeSeconds: 300, nowSeconds: now });
    expect(r).toEqual({ ok: true, timestamp: now });
  });

  it('rejects an invalid signature', () => {
    const r = verifyWaveWebhook(BODY, header(now, ['deadbeef']), { secrets: [SECRET], maxAgeSeconds: 300, nowSeconds: now });
    expect(r).toEqual({ ok: false, reason: 'signature_mismatch' });
  });

  it('rejects a tampered body', () => {
    const tampered = Buffer.from(BODY.toString('utf8').replace('25', '2500'));
    const r = verifyWaveWebhook(tampered, header(now, [good]), { secrets: [SECRET], maxAgeSeconds: 300, nowSeconds: now });
    expect(r).toEqual({ ok: false, reason: 'signature_mismatch' });
  });

  it('rejects an expired timestamp (older than maxAge)', () => {
    const r = verifyWaveWebhook(BODY, header(now - 400, [computeWaveSignature(SECRET, now - 400, BODY)]), { secrets: [SECRET], maxAgeSeconds: 300, nowSeconds: now });
    expect(r).toEqual({ ok: false, reason: 'expired' });
  });

  it('rejects a future timestamp beyond the skew window', () => {
    const r = verifyWaveWebhook(BODY, header(now + 120, [computeWaveSignature(SECRET, now + 120, BODY)]), { secrets: [SECRET], maxAgeSeconds: 300, maxSkewSeconds: 30, nowSeconds: now });
    expect(r).toEqual({ ok: false, reason: 'future' });
  });

  it('accepts either signature during secret rotation', () => {
    const oldSecret = 'old_secret';
    const newSecret = 'new_secret';
    const oldSig = computeWaveSignature(oldSecret, now, BODY);
    const newSig = computeWaveSignature(newSecret, now, BODY);
    const withBoth = header(now, [oldSig, newSig]);
    expect(verifyWaveWebhook(BODY, withBoth, { secrets: [newSecret, oldSecret], maxAgeSeconds: 300, nowSeconds: now }).ok).toBe(true);
    // Only the previous secret still configured, header carries only the new sig:
    expect(verifyWaveWebhook(BODY, header(now, [newSig]), { secrets: [newSecret, oldSecret], maxAgeSeconds: 300, nowSeconds: now }).ok).toBe(true);
  });

  it('rejects a missing raw body', () => {
    expect(verifyWaveWebhook(undefined, header(now, [good]), { secrets: [SECRET], maxAgeSeconds: 300, nowSeconds: now })).toEqual({ ok: false, reason: 'missing_body' });
  });

  it('rejects when no secret is configured', () => {
    expect(verifyWaveWebhook(BODY, header(now, [good]), { secrets: [], maxAgeSeconds: 300, nowSeconds: now })).toEqual({ ok: false, reason: 'no_secret' });
  });

  it('rejects a malformed header', () => {
    expect(verifyWaveWebhook(BODY, 'garbage', { secrets: [SECRET], maxAgeSeconds: 300, nowSeconds: now })).toEqual({ ok: false, reason: 'bad_header' });
  });
});

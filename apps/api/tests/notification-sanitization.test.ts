import { describe, expect, it } from 'vitest';
import { notificationSchema, sanitizeNotificationText } from '../src/routes/notifications';

describe('sanitizeNotificationText', () => {
  it('strips HTML/script tags but keeps the surrounding text', () => {
    expect(sanitizeNotificationText('Update <script>alert(1)</script> available')).toBe('Update alert(1) available');
  });

  it('strips an img onerror payload down to plain text', () => {
    expect(sanitizeNotificationText('<img src=x onerror=alert(1)>Free launch is live')).toBe('Free launch is live');
  });

  it('collapses embedded newlines and tabs into single spaces', () => {
    expect(sanitizeNotificationText('Line one\nLine two\tLine three')).toBe('Line one Line two Line three');
  });

  it('collapses repeated spaces', () => {
    expect(sanitizeNotificationText('Too    many     spaces')).toBe('Too many spaces');
  });

  it('leaves ordinary announcement text untouched', () => {
    expect(sanitizeNotificationText('GNM is free during the launch campaign.')).toBe('GNM is free during the launch campaign.');
  });
});

describe('notificationSchema', () => {
  it('rejects a title that becomes too short once markup is stripped', () => {
    expect(() => notificationSchema.parse({ title: '<b></b>', message: 'A valid message body.' })).toThrow();
  });

  it('accepts and sanitizes a legitimate admin announcement', () => {
    const result = notificationSchema.parse({ title: 'Free launch active', message: 'Full migration, backup, restore and safe cleanup are available during the launch campaign.' });
    expect(result.title).toBe('Free launch active');
    expect(result.target).toBe('all');
    expect(result.audience).toBe('all');
  });

  it('rejects an over-length message before sanitization runs', () => {
    expect(() => notificationSchema.parse({ title: 'Title', message: 'x'.repeat(501) })).toThrow();
  });
});

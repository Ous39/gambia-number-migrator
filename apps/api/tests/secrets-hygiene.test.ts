import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(__dirname, '../../..');

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.git', '.expo', 'uploads'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx|js|jsx|json|md|sql|ya?ml|env\.example)$/.test(entry.name) || entry.name === '.env.example') acc.push(full);
  }
  return acc;
}

describe('secret hygiene', () => {
  it('.env.example ships no populated Wave secret values', () => {
    const text = fs.readFileSync(path.join(repoRoot, '.env.example'), 'utf8');
    for (const key of ['WAVE_API_KEY', 'WAVE_API_SIGNING_SECRET', 'WAVE_WEBHOOK_SECRET', 'WAVE_WEBHOOK_SECRET_PREVIOUS']) {
      const line = text.split('\n').find((l) => l.trim().startsWith(`${key}=`)) || '';
      expect(line.trim(), `${key} must be empty in .env.example`).toBe(`${key}=`);
    }
  });

  it('no real-looking Wave credential literals are committed', () => {
    const offenders: string[] = [];
    for (const file of walk(repoRoot)) {
      if (file.endsWith('secrets-hygiene.test.ts')) continue;
      const text = fs.readFileSync(file, 'utf8');
      // A populated key/secret has a long alphanumeric tail. Documentation
      // placeholders use an ellipsis ("wave_sn_prod_…") and are fine.
      if (/wave_sn_(prod|test|live|AKS)_[A-Za-z0-9]{12,}/.test(text)) {
        offenders.push(path.relative(repoRoot, file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the mobile bundle never references server-only Wave env vars', () => {
    const mobileDir = path.join(repoRoot, 'apps', 'mobile');
    const offenders: string[] = [];
    for (const file of walk(mobileDir)) {
      const text = fs.readFileSync(file, 'utf8');
      if (/WAVE_API_KEY|WAVE_API_SIGNING_SECRET|WAVE_WEBHOOK_SECRET/.test(text)) offenders.push(path.relative(repoRoot, file));
    }
    expect(offenders).toEqual([]);
  });
});

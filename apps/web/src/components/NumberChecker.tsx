import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { normalizeLocal, formatLocal, previewMigration, type PublicRulesPayload } from '../lib/numbers';

export function localDigitsFromInput(value: string): string {
  return normalizeLocal(value).localDigits;
}
export function isValidGambianLength(localDigits: string): boolean {
  return localDigits.length === 7 || localDigits.length === 9;
}

type Outcome =
  | { kind: 'idle' }
  | { kind: 'empty' }
  | { kind: 'invalid' }
  | { kind: 'new'; local: string }
  | { kind: 'old-matched'; local: string; migrated: string; operator?: string }
  | { kind: 'old-unmatched'; local: string };

export function NumberChecker() {
  const initial = (() => { try { return new URLSearchParams(window.location.search).get('n') || ''; } catch { return ''; } })();
  const [value, setValue] = useState(initial);
  const [checked, setChecked] = useState(Boolean(initial));
  const [rules, setRules] = useState<PublicRulesPayload | null>(null);

  useEffect(() => {
    let active = true;
    api<{ data: PublicRulesPayload }>('/migration-rules')
      .then((r) => { if (active) setRules(r.data); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const outcome: Outcome = useMemo(() => {
    if (!checked) return { kind: 'idle' };
    const norm = normalizeLocal(value);
    if (!norm.digits) return { kind: 'empty' };
    if (norm.type === 'invalid') return { kind: 'invalid' };
    if (norm.type === 'new_9_digit') return { kind: 'new', local: norm.localDigits };
    const preview = previewMigration(norm.localDigits, rules);
    if (preview) {
      return { kind: 'old-matched', local: norm.localDigits, migrated: preview.migrated, operator: preview.operator };
    }
    return { kind: 'old-unmatched', local: norm.localDigits };
  }, [checked, value, rules]);

  const resultClass =
    outcome.kind === 'old-matched' || outcome.kind === 'new' ? 'valid'
    : outcome.kind === 'invalid' || outcome.kind === 'empty' ? 'invalid'
    : 'idle';

  const shareUrl = useMemo(() => {
    const local = localDigitsFromInput(value);
    if (!isValidGambianLength(local)) return '';
    try { return `${window.location.origin}/?n=${local}#checker`; } catch { return ''; }
  }, [value]);

  return (
    <div className="checker" id="checker">
      <div className="checker-head">
        <span className="badge"><span className="dot live" /> Interactive demo</span>
        <span>No contacts are changed</span>
      </div>
      <label htmlFor="number-check" style={{ display: 'block', marginTop: 14, fontWeight: 700, fontSize: '.9rem' }}>Enter a Gambian phone number</label>
      <div className="field">
        <span className="prefix">🇬🇲 +220</span>
        <input
          id="number-check"
          inputMode="numeric"
          placeholder="e.g. 363 1776"
          value={value}
          onChange={(e) => { setValue(e.target.value); setChecked(false); }}
          onKeyDown={(e) => { if (e.key === 'Enter') setChecked(true); }}
        />
        <button className="btn" onClick={() => setChecked(true)}>Check</button>
      </div>

      <div className={`result ${resultClass}`} aria-live="polite">
        {outcome.kind === 'idle' && <><span className="icon">◈</span><p><b>Check a number's readiness</b><small>Try a 7-digit or 9-digit Gambian number.</small></p></>}
        {outcome.kind === 'empty' && <><span className="icon">!</span><p><b>Enter a number first</b><small>Only the format and rule match are checked here.</small></p></>}
        {outcome.kind === 'invalid' && <><span className="icon">!</span><p><b>Check the length</b><small>Gambian mobile numbers have 7 or 9 digits, excluding +220.</small></p></>}
        {outcome.kind === 'new' && <><span className="icon">✓</span><p><b>Already a 9-digit number</b><small>+220 {formatLocal(outcome.local)} is in the new format. No change needed.</small></p></>}
        {outcome.kind === 'old-unmatched' && <><span className="icon">!</span><p><b>7-digit number — needs the app</b><small>No published rule preview is available for this number here. The GNM app runs the full official check.</small></p></>}
        {outcome.kind === 'old-matched' && (
          <div>
            <b>{outcome.operator ? `${outcome.operator} · ready to migrate` : 'Ready to migrate'}</b>
            <div className="before-after">
              <span className="from">+220 {formatLocal(outcome.local)}</span>
              <span aria-hidden="true">→</span>
              <span className="to">+220 {formatLocal(outcome.migrated)}</span>
            </div>
            <small>Preview from the current published rules. The app confirms eligibility and shows this before any change.</small>
          </div>
        )}
      </div>

      {(outcome.kind === 'old-matched' || outcome.kind === 'new') && (
        <div className="checker-tools">
          {shareUrl && <button onClick={() => { navigator.clipboard?.writeText(shareUrl); }}>Copy shareable link</button>}
          <button onClick={() => window.print()}>Print result</button>
        </div>
      )}

      <p className="form-hint" style={{ marginTop: 14 }}>
        Format and published-rule preview only. Official eligibility is confirmed securely inside the GNM app.
      </p>
    </div>
  );
}

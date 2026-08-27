import { useState } from 'react';

export type NumberFormatStatus = 'idle' | 'empty' | 'valid' | 'invalid';

export function localDigitsFromInput(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits.startsWith('220') ? digits.slice(3) : digits;
}

export function isValidGambianLength(localDigits: string): boolean {
  return localDigits.length === 7 || localDigits.length === 9;
}

export function NumberChecker() {
  const [value, setValue] = useState('');
  const [checked, setChecked] = useState(false);
  const digits = value.replace(/\D/g, '');
  const local = localDigitsFromInput(value);
  const valid = isValidGambianLength(local);
  const status: NumberFormatStatus = !checked ? 'idle' : !digits ? 'empty' : valid ? 'valid' : 'invalid';

  return (
    <div className="checker-card">
      <div className="checker-head"><div><span className="live-dot" /> INTERACTIVE DEMO</div><span>No contacts are changed</span></div>
      <label htmlFor="number-check">Enter a Gambian phone number</label>
      <div className="number-field">
        <span>🇬🇲 +220</span>
        <input id="number-check" inputMode="numeric" placeholder="e.g. 363 1776" value={value} onChange={(e) => { setValue(e.target.value); setChecked(false); }} />
        <button onClick={() => setChecked(true)}>Check number</button>
      </div>
      <div className={`check-result ${status}`} aria-live="polite">
        {status === 'idle' && <><span>◈</span><p><b>See if the format is ready</b><small>Try a 7-digit or 9-digit Gambian number.</small></p></>}
        {status === 'empty' && <><span>!</span><p><b>Enter a number first</b><small>Only the format is checked in this public demo.</small></p></>}
        {status === 'valid' && <><span>✓</span><p><b>{local.length === 7 ? '7-digit number detected' : '9-digit number detected'}</b><small>The GNM app will verify eligibility and preview the exact update before making changes.</small></p></>}
        {status === 'invalid' && <><span>!</span><p><b>Check the number length</b><small>Gambian mobile numbers should contain 7 or 9 digits, excluding +220.</small></p></>}
      </div>
      <p className="checker-note">This tool checks format only. Official eligibility is confirmed securely inside the GNM app using the approved numbering rules.</p>
    </div>
  );
}

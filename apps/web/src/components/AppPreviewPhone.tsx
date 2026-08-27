import { useEffect, useState } from 'react';

const SCREENS = ['scan', 'preview', 'done'] as const;
type ScreenName = typeof SCREENS[number];

function Scan() {
  return (
    <>
      <span className="badge ok" style={{ fontSize: '.6rem' }}>Ready to migrate</span>
      <h3 style={{ marginTop: 10, fontSize: '1.05rem', lineHeight: 1.2 }}>Your contacts, ready for 9 digits.</h3>
      <p style={{ fontSize: '.72rem', marginTop: 6 }}>Eligible Gambian numbers found and ready to update safely.</p>
      <div className="phone-row"><span className="num">247</span><div style={{ flex: 1 }}><b style={{ fontSize: '.72rem' }}>Contacts scanned</b><br /><small style={{ fontSize: '.62rem', color: 'var(--ink-faint)' }}>86 numbers ready</small></div><span style={{ color: 'var(--accent)' }}>✓</span></div>
      <div className="phone-cta">Review &amp; migrate →</div>
    </>
  );
}

const rows = [
  { name: 'Awa Touray', from: '363 1776', to: '83 363 1776' },
  { name: 'Lamin Ceesay', from: '', to: '87 123 4567' },
  { name: 'Fatou Jallow', from: '345 1567', to: '87 345 1567' },
];
function Preview() {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.7rem', fontWeight: 800 }}><span>Preview changes</span><span style={{ color: 'var(--ink-faint)' }}>3 contacts</span></div>
      {rows.map((r) => (
        <div className="phone-row" key={r.name} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 3 }}>
          <b style={{ fontSize: '.7rem' }}>{r.name}</b>
          <span style={{ fontSize: '.62rem' }}>{r.from && <span className="old">{r.from} </span>}<span className="new">{r.to}</span></span>
        </div>
      ))}
      <div className="phone-cta">2 selected · Migrate now</div>
    </>
  );
}
function Done() {
  return (
    <div style={{ textAlign: 'center', padding: '14px 0' }}>
      <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--accent-soft)', color: 'var(--accent)', display: 'grid', placeItems: 'center', margin: '0 auto 10px', fontWeight: 900, fontSize: 22 }}>✓</div>
      <b style={{ fontSize: '.95rem' }}>Migration complete</b>
      <p style={{ fontSize: '.68rem', marginTop: 4 }}>86 numbers updated safely</p>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 18, marginTop: 12, fontSize: '.62rem' }}>
        <div><b style={{ fontSize: '1rem' }}>86</b><br />Updated</div>
        <div><b style={{ fontSize: '1rem' }}>2</b><br />Skipped</div>
        <div><b style={{ fontSize: '1rem' }}>0</b><br />Failed</div>
      </div>
    </div>
  );
}

const R: Record<ScreenName, () => JSX.Element> = { scan: Scan, preview: Preview, done: Done };

export function AppPreviewPhone() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % SCREENS.length), 4200);
    return () => clearInterval(t);
  }, []);
  const Screen = R[SCREENS[i]];
  return (
    <div aria-label="GNM app preview">
      <div className="phone">
        <div className="phone-notch" />
        <div className="phone-app-head">
          <img className="brand-logo" src="/logo.png" alt="" width={28} height={28} />
          <div><b>Gambia Number Migrator</b><br /><small>Welcome</small></div>
        </div>
        <div className="phone-screen" key={SCREENS[i]}><Screen /></div>
      </div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 14 }} role="tablist" aria-label="App screen">
        {SCREENS.map((s, idx) => (
          <button key={s} type="button" role="tab" aria-selected={idx === i} aria-label={s} onClick={() => setI(idx)}
            style={{ width: idx === i ? 18 : 7, height: 7, borderRadius: 5, border: 0, cursor: 'pointer', background: idx === i ? 'var(--brand)' : 'var(--line-strong)', transition: '.2s' }} />
        ))}
      </div>
    </div>
  );
}

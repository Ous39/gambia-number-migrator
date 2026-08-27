import { useEffect, useState } from 'react';
import { Arrow } from './Icons';

const SCREENS = ['dashboard', 'preview', 'complete'] as const;
type ScreenName = typeof SCREENS[number];

const screenLabel: Record<ScreenName, string> = {
  dashboard: 'Dashboard',
  preview: 'Preview changes',
  complete: 'Migration complete',
};

function DashboardScreen() {
  return (
    <>
      <span className="status-pill">READY TO MIGRATE</span>
      <h2>Your contacts,<br />ready for <em>9 digits.</em></h2>
      <p>We found eligible Gambian numbers that can be safely updated.</p>
      <div className="scan-card"><div className="scan-num">247</div><div><b>Contacts scanned</b><small>86 numbers ready to update</small></div><span>✓</span></div>
      <div className="phone-button">Review &amp; migrate <Arrow /></div>
      <div className="secure-note">◈ Your contacts stay on your device</div>
    </>
  );
}

const previewRows = [
  { name: 'Awa Touray', from: '363 1776', to: '83 363 1776', status: 'Ready', tone: 'ready' },
  { name: 'Lamin Ceesay', from: '', to: '87 123 4567', status: 'Already updated', tone: 'done' },
  { name: 'Fatou Jallow', from: '345 1567', to: '87 345 1567', status: 'Ready', tone: 'ready' },
];

function PreviewScreen() {
  return (
    <div className="phone-preview-list">
      <div className="phone-preview-head"><b>Preview changes</b><span>3 contacts</span></div>
      {previewRows.map((row) => (
        <div className="preview-row" key={row.name}>
          <div className="preview-row-name">{row.name}</div>
          <div className="preview-row-numbers">{row.from ? <><span className="old">{row.from}</span> <Arrow /> <span className="new">{row.to}</span></> : <span className="new">{row.to}</span>}</div>
          <span className={`preview-pill ${row.tone}`}>{row.status}</span>
        </div>
      ))}
      <div className="phone-button small">2 selected · Migrate now</div>
    </div>
  );
}

function CompleteScreen() {
  return (
    <div className="phone-complete">
      <div className="phone-complete-check">✓</div>
      <b>Migration complete</b>
      <p>86 numbers updated safely</p>
      <div className="phone-complete-stats">
        <div><b>86</b><span>Updated</span></div>
        <div><b>2</b><span>Skipped</span></div>
        <div><b>0</b><span>Failed</span></div>
      </div>
      <div className="phone-button small">Done</div>
    </div>
  );
}

const renderers: Record<ScreenName, () => JSX.Element> = {
  dashboard: DashboardScreen,
  preview: PreviewScreen,
  complete: CompleteScreen,
};

export function AppPreviewPhone() {
  const [index, setIndex] = useState(0);
  const screen = SCREENS[index];

  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % SCREENS.length), 4200);
    return () => clearInterval(timer);
  }, []);

  const Screen = renderers[screen];

  return (
    <div className="phone-stage" aria-label="GNM app preview, cycling through the dashboard, preview and completion screens">
      <div className="orbit orbit-one" /><div className="orbit orbit-two" />
      <div className="float-card card-backup"><span className="mini-icon">✓</span><div><b>Backup complete</b><small>Your contacts are safe</small></div></div>
      <div className="phone">
        <div className="phone-top"><span>9:41</span><i /></div>
        <div className="app-head"><div className="app-logo">G</div><div><small>Welcome to</small><b>Gambia Number Migrator</b></div><button aria-label="Notifications">◉</button></div>
        <div className={`phone-body phone-body-${screen}`} key={screen}>
          <Screen />
        </div>
      </div>
      <div className="float-card card-updated"><span className="mini-icon blue">86</span><div><b>Numbers ready</b><small>Preview before updating</small></div></div>
      <div className="phone-dots" role="tablist" aria-label="App screen">
        {SCREENS.map((s, i) => (
          <button key={s} type="button" role="tab" aria-selected={i === index} aria-label={screenLabel[s]} className={i === index ? 'active' : ''} onClick={() => setIndex(i)} />
        ))}
      </div>
    </div>
  );
}

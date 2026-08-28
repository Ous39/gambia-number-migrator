import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Seo } from '../components/Seo';
import { NumberChecker } from '../components/NumberChecker';
import { PublicContent } from '../components/PublicContent';
import { AppPreviewPhone } from '../components/AppPreviewPhone';
import { Page } from '../components/SiteShell';
import { getAppConfig } from '../api/client';

const ENV_PLAY = import.meta.env.VITE_PLAY_STORE_URL as string | undefined;
const ENV_APP = import.meta.env.VITE_APP_STORE_URL as string | undefined;

function StoreButton({ url, platform, badge }: { url?: string | null; platform: string; badge: string }) {
  const img = <img className="store-badge" src={badge} alt={url ? `Download GNM on ${platform}` : ''} width={190} height={56} />;
  return url
    ? <a className="store-link" href={url} target="_blank" rel="noreferrer" aria-label={`Download GNM on ${platform}`}>{img}</a>
    : <span className="store-link is-soon" role="img" aria-label={`${platform} — coming soon`}>{img}<em>Coming soon</em></span>;
}

/** Store links are set by an administrator in App configuration; env vars are a fallback. */
function useStoreLinks() {
  const [links, setLinks] = useState<{ play: string | null; app: string | null }>({ play: ENV_PLAY || null, app: ENV_APP || null });
  useEffect(() => {
    let active = true;
    getAppConfig().then((c) => {
      if (!active) return;
      setLinks({
        play: (String(c.play_store_url || '') || ENV_PLAY || '') || null,
        app: (String(c.app_store_url || '') || ENV_APP || '') || null,
      });
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  return links;
}

const STEPS = [
  ['01', '⌕', 'Scan your contacts', 'GNM checks your contact list on-device and identifies eligible Gambian numbers.'],
  ['02', '☷', 'Review the changes', 'See exactly which numbers will change. Select all, choose some, or keep the old number.'],
  ['03', '✓', 'Back up & migrate', 'Create a safe backup, confirm once, and let GNM update only your selected contacts.'],
];
const SAFETY = [
  ['Automatic backup', 'Create a restorable copy before any contact is updated.'],
  ['Clear preview', 'Know exactly what will change before it happens.'],
  ['Selective migration', 'Choose the contacts you want to update — nothing more.'],
  ['No contact selling', 'Your contact data is never sold or used for advertising.'],
];
const FAQ = [
  ['What is the Gambia Number Migrator?', 'GNM is a mobile app that helps people, businesses and institutions update eligible Gambian contacts from the 7-digit format to the new 9-digit numbering format.'],
  ['Will GNM change all my contacts?', 'No. GNM only identifies eligible Gambian numbers, and you review and choose every change before it is applied.'],
  ['Can I restore my old contacts?', 'Yes. Create a backup before migration so you can restore your original contact information if needed.'],
  ['Is GNM on Android and iPhone?', 'GNM is being prepared for both. Official store links appear on this site and the status page when each release is available.'],
  ['Does GNM need internet?', 'Checking official rules and account access needs internet. Contact scanning and review happen securely in the app.'],
];

export default function Home() {
  const store = useStoreLinks();
  return (
    <Page>
      <Seo title="Gambia Number Migrator | Update contacts safely" description="GNM helps individuals, businesses and institutions safely update eligible Gambian contacts from 7 digits to the new 9-digit format." />

      <section className="hero">
        <div className="container hero-grid">
          <div>
            <span className="eyebrow">Built in The Gambia, for The Gambia</span>
            <h1>Update eligible Gambian contacts safely.<br /><em>Keep every connection.</em></h1>
            <p className="lead">GNM safely updates eligible Gambian phone numbers from 7 digits to the new 9-digit format — without editing contacts one by one.</p>
            <div className="hero-cta">
              <a className="btn" href="#download">Download GNM</a>
              <a className="link-arrow" href="#how">See how it works</a>
            </div>
            <div className="trust-row">
              <span><span className="tick">✓</span> Backup before changes</span>
              <span><span className="tick">✓</span> Preview everything</span>
              <span><span className="tick">✓</span> You stay in control</span>
            </div>
          </div>
          <AppPreviewPhone />
        </div>
      </section>

      <section className="section-sm">
        <div className="container proof">
          <div><b>Simple</b><span>Built for everyone</span></div>
          <div><b>Safe</b><span>Backup before migration</span></div>
          <div><b>Fast</b><span>Update in minutes</span></div>
          <div><b>Local</b><span>Made by OceanBrown</span></div>
        </div>
      </section>

      <section className="section section-tint" id="checker">
        <div className="container hero-grid">
          <div>
            <span className="eyebrow">Number readiness checker</span>
            <h2>Check a number. Understand the next step.</h2>
            <p className="lead">A safe public demo: check the format and, where a published rule matches, preview the new 9-digit number. The app runs the full official check.</p>
            <div className="stack" style={{ marginTop: 20 }}>
              <span><span className="tick">✓</span> No contact permission needed</span>
              <span><span className="tick">✓</span> Nothing is saved</span>
              <span><span className="tick">✓</span> Instant format + rule result</span>
            </div>
          </div>
          <NumberChecker />
        </div>
      </section>

      <section className="section" id="how">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">How it works</span>
            <h2>From 7 digits to 9. Three simple steps.</h2>
            <p>No technical knowledge needed. GNM guides you clearly from start to finish.</p>
          </div>
          <div className="tri">
            {STEPS.map(([no, ic, title, body]) => (
              <article className="card" key={no}>
                <span className="step-no">{no}</span>
                <div className="step-ic">{ic}</div>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-tint" id="safety">
        <div className="container hero-grid">
          <div className="card pad-lg">
            <span className="badge ok">Built around your safety</span>
            <h3 style={{ marginTop: 12 }}>Your contacts belong to you.</h3>
            <p>Nothing changes until you review and confirm it. GNM keeps you in control at every step.</p>
          </div>
          <ul className="stack" style={{ listStyle: 'none', padding: 0 }}>
            {SAFETY.map(([t, d]) => (
              <li key={t} style={{ display: 'flex', gap: 12 }}>
                <span className="tick">✓</span>
                <span><b>{t}</b><br /><span className="muted">{d}</span></span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section" id="updates">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">Public readiness centre</span>
            <h2>Everything you need, in one trusted place.</h2>
            <p>Follow GNM's release journey and get your phone ready before the national migration.</p>
          </div>
          <div className="tri">
            <Link className="card" to="/status">
              <div className="step-ic">◉</div>
              <h3>Live status</h3>
              <p>Current app readiness, published rule version, pricing and campaign — updated in real time.</p>
              <span className="link-arrow">Open status</span>
            </Link>
            <Link className="card" to="/updates">
              <div className="step-ic">✎</div>
              <h3>Updates feed</h3>
              <p>Official announcements about the migration and each GNM release, with an RSS feed.</p>
              <span className="link-arrow">Read updates</span>
            </Link>
            <Link className="card" to="/organisations">
              <div className="step-ic">☖</div>
              <h3>For organisations</h3>
              <p>Businesses and institutions can plan a larger migration and request dedicated support.</p>
              <span className="link-arrow">Plan a migration</span>
            </Link>
          </div>
        </div>
      </section>

      <PublicContent />

      <section className="section section-tint" id="faq">
        <div className="container hero-grid">
          <div>
            <span className="eyebrow">Questions, answered</span>
            <h2>Good to know.</h2>
            <p>Still need help? <Link className="link-arrow" to="/contact">Contact support</Link></p>
          </div>
          <div className="stack">
            {FAQ.map(([q, a], i) => (
              <details className="card" key={q} open={i === 0}>
                <summary style={{ cursor: 'pointer', fontWeight: 700 }}>{q}</summary>
                <p style={{ marginTop: 10 }}>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="download">
        <div className="container">
          <div className="download-cta">
            <div>
              <span className="eyebrow" style={{ color: '#8fb6ff' }}>Be ready for the new numbering plan</span>
              <h2 style={{ marginTop: 12 }}>Keep your contacts. Move forward.</h2>
              <p>Download GNM and update eligible contacts safely, quickly and confidently.</p>
            </div>
            <div className="store-btns">
              <StoreButton url={store.play} platform="Google Play" badge="/badges/google-play.svg" />
              <StoreButton url={store.app} platform="App Store" badge="/badges/app-store.svg" />
            </div>
            <p style={{ fontSize: '.8rem', marginTop: 12, opacity: .82 }}>
              {store.play || store.app ? 'Tap a badge to install GNM.' : 'Official store links are published here as soon as the app is live.'}
            </p>
          </div>
        </div>
      </section>
    </Page>
  );
}

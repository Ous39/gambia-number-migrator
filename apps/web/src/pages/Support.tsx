import { Link } from 'react-router-dom';
import { Seo } from '../components/Seo';
import { Page } from '../components/SiteShell';

const TOPICS: Array<[string, string, string]> = [
  ['01', 'Scanning contacts', 'Allow contact permission when prompted. GNM checks eligible numbers and shows a preview; it does not change contacts during scanning.'],
  ['02', 'Backup and restore', 'Create a backup before migration. Keep the app open while it runs and confirm completion before continuing.'],
  ['03', 'Migration preview', 'Review every selected contact. Use Select all, Clear or individual selections, and choose whether to replace or keep the old number.'],
  ['04', 'Duplicates', 'GNM can identify repeated numbers, but contacts with different names or formatting may still need manual review.'],
  ['05', 'Payments and access', 'Use only the payment options shown inside the official app. Never send a PIN or OTP to a support agent.'],
  ['06', 'Notifications', 'Enable notifications in your device settings for important service and migration updates. You can disable them at any time.'],
];
const STEPS: Array<[string, string]> = [
  ['Check permissions', 'Confirm contacts and notifications are allowed in your device settings.'],
  ['Check your connection', 'Account, rule and payment services need an active internet connection.'],
  ['Restart safely', 'Close and reopen GNM. Do not uninstall before confirming your backup is available.'],
  ['Report the issue', 'Share your device type, OS, app version and error message — never private contacts.'],
];

export default function Support() {
  return (
    <Page>
      <Seo title="Help & support | Gambia Number Migrator" description="Get help with GNM contact scanning, backups, migration, restore, payments and account access." />
      <section className="section">
        <div className="container">
          <span className="eyebrow">GNM help centre</span>
          <h1 style={{ marginTop: 14 }}>Help at every step.</h1>
          <p className="lead">Clear guidance for scanning, backups, migration and account access. If the answer isn't here, contact the GNM team safely.</p>
          <div className="hero-cta">
            <Link className="btn" to="/contact">Contact support</Link>
            <a className="link-arrow" href="/#how">See how GNM works</a>
          </div>

          <div className="tri" style={{ marginTop: 40 }}>
            {TOPICS.map(([n, t, d]) => (
              <article className="card" key={n}>
                <span className="step-no">{n}</span>
                <h3 style={{ marginTop: 8 }}>{t}</h3>
                <p>{d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-tint">
        <div className="container hero-grid">
          <div>
            <span className="eyebrow">Quick troubleshooting</span>
            <h2>If something isn't working</h2>
          </div>
          <ol className="stack" style={{ paddingLeft: 20 }}>
            {STEPS.map(([t, d]) => (
              <li key={t}><b>{t}</b><br /><span className="muted">{d}</span></li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="callout warn">
            <span className="tick" style={{ background: '#fdf1dc', color: 'var(--warn)' }}>!</span>
            <p><b>Protect yourself from fraud.</b> GNM and OceanBrown will never ask for your OTP, payment PIN, account password or full contact backup by email, phone or social media.</p>
          </div>
        </div>
      </section>
    </Page>
  );
}

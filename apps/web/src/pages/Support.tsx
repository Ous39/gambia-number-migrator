import { Link } from 'react-router-dom';
import { Seo } from '../components/Seo';
import { SiteHeader, SiteFooter } from '../components/SiteShell';

const topics: Array<[string, string, string]> = [
  ['01', 'Scanning contacts', 'Allow contact permission when prompted. GNM checks eligible numbers and presents a preview; it does not update contacts during scanning.'],
  ['02', 'Backup and restore', 'Create a backup before migration. Keep the app open while the backup runs and verify completion before continuing.'],
  ['03', 'Migration preview', 'Review every selected contact. Use Select all, Clear or individual selections, and choose whether to replace or keep the old number.'],
  ['04', 'Duplicates', 'GNM can identify repeated numbers, but contacts with different names or formatting may still require manual review.'],
  ['05', 'Payments and access', 'Use only the payment options shown inside the official app. Never send a PIN or OTP to a support agent.'],
  ['06', 'Notifications', 'Enable notifications in your device settings to receive important service and migration updates. You can disable them at any time.'],
];

export default function Support() {
  return (
    <main className="legal-page support-page">
      <Seo title="Help & Support | Gambia Number Migrator" description="Get help with GNM contact scanning, backups, migration, restore, payments and account access." />
      <SiteHeader />
      <div className="support-hero container">
        <span className="kicker">GNM HELP CENTRE</span><h1>Help at every step.</h1>
        <p>Find clear guidance for scanning, backups, migration and account access. If the answer is not here, contact the GNM team safely.</p>
        <div className="support-actions"><Link className="button" to="/contact">Contact support →</Link><a className="text-link blue-link" href="/#how">See how GNM works</a></div>
        <div className="support-topics">{topics.map(([n, t, d]) => <article key={n}><span>{n}</span><h2>{t}</h2><p>{d}</p></article>)}</div>
        <section className="troubleshoot">
          <div><span className="kicker">QUICK TROUBLESHOOTING</span><h2>If something is not working</h2></div>
          <ol>
            <li><b>Check permissions</b><span>Confirm contacts and notifications are allowed in your device settings.</span></li>
            <li><b>Check your connection</b><span>Some account, rule and payment services require an active internet connection.</span></li>
            <li><b>Restart safely</b><span>Close and reopen GNM. Do not uninstall the app before confirming your backup is available.</span></li>
            <li><b>Report the issue</b><span>Share your device type, operating system, app version and error message—never private contacts.</span></li>
          </ol>
        </section>
        <div className="safety-alert"><b>Protect yourself from fraud</b><p>GNM and OceanBrown will never ask for your OTP, payment PIN, account password or full contact backup by email, telephone or social media.</p></div>
      </div>
      <SiteFooter />
    </main>
  );
}

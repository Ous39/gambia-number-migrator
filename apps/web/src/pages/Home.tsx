import { Link } from 'react-router-dom';
import { Seo } from '../components/Seo';
import { NumberChecker } from '../components/NumberChecker';
import { PublicContent } from '../components/PublicContent';
import { AppPreviewPhone } from '../components/AppPreviewPhone';
import { Arrow, Check } from '../components/Icons';

const PLAY_STORE_URL = import.meta.env.VITE_PLAY_STORE_URL as string | undefined;
const APP_STORE_URL = import.meta.env.VITE_APP_STORE_URL as string | undefined;

function StoreButton({ url, icon, platform }: { url?: string; icon: string; platform: string }) {
  const content = <><span>{icon}</span><div><small>{url ? 'DOWNLOAD ON' : 'COMING SOON ON'}</small><b>{platform}</b></div></>;
  return url
    ? <a className="store linked" href={url} target="_blank" rel="noreferrer">{content}</a>
    : <div className="store">{content}</div>;
}

export default function Home() {
  return (
    <main id="main-content">
      <Seo title="Gambia Number Migrator | Update Contacts Safely" description="GNM helps individuals, businesses and institutions safely update eligible Gambian contacts from 7 digits to the new 9-digit format." />
      <div className="notice"><div className="container"><span>🇬🇲</span><b>Supporting The Gambia's transition to the new 9-digit numbering plan</b><a href="#updates">View readiness updates →</a></div></div>
      <header className="nav-wrap"><nav className="nav container" aria-label="Main navigation">
        <a className="brand" href="#top"><span className="brand-mark">G</span><span><b>GNM</b><small>Gambia Number Migrator</small></span></a>
        <div className="nav-links"><a href="#checker">Number checker</a><a href="#how">How it works</a><a href="#safety">Safety</a><a href="#updates">Updates</a><Link to="/support">Support</Link><Link to="/contact">Contact</Link></div>
        <a className="button button-small" href="#download">Get the app</a>
      </nav></header>

      <section className="hero" id="top"><div className="hero-glow" /><div className="container hero-grid">
        <div className="hero-copy"><div className="eyebrow"><span /> Built in The Gambia, for The Gambia</div>
          <h1>Update every contact.<br /><em>Keep every connection.</em></h1>
          <p className="lead">GNM helps you safely update eligible Gambian phone numbers from 7 digits to the new 9-digit format—without editing contacts one by one.</p>
          <div className="hero-actions"><a className="button" href="#download">Download GNM <Arrow /></a><a className="text-link" href="#how">See how it works <span>↓</span></a></div>
          <div className="trust-row"><span><Check /> Backup before changes</span><span><Check /> Preview everything</span><span><Check /> You stay in control</span></div>
        </div>
        <AppPreviewPhone />
      </div></section>

      <section className="proof-strip"><div className="container proof-grid"><div><b>Simple</b><span>Built for everyone</span></div><div><b>Safe</b><span>Backup before migration</span></div><div><b>Fast</b><span>Update in minutes</span></div><div><b>Local</b><span>Made by OceanBrown</span></div></div></section>

      <section className="section checker-section" id="checker"><div className="container checker-grid"><div>
        <span className="kicker">NUMBER READINESS CHECKER</span><h2>Check a number.<br /><em>Understand the next step.</em></h2><p className="section-copy">Use this safe public demo to check whether a number has a 7-digit or 9-digit format. The mobile app performs the complete official eligibility check.</p>
        <div className="mini-features"><span><Check /> No contact permission needed</span><span><Check /> Nothing is saved</span><span><Check /> Instant format result</span></div>
      </div><NumberChecker /></div></section>

      <section className="section" id="how"><div className="container"><div className="section-heading"><span className="kicker">HOW IT WORKS</span><h2>From 7 digits to 9.<br /><em>Three simple steps.</em></h2><p>No technical knowledge needed. GNM guides you clearly from start to finish.</p></div>
        <div className="steps"><article><span className="step-no">01</span><div className="step-icon">⌕</div><h3>Scan your contacts</h3><p>GNM checks your contact list and identifies eligible Gambian phone numbers.</p></article>
          <article><span className="step-no">02</span><div className="step-icon">☷</div><h3>Review the changes</h3><p>See exactly which numbers will change. Select all, choose some, or keep the old number.</p></article>
          <article><span className="step-no">03</span><div className="step-icon">✓</div><h3>Backup &amp; migrate</h3><p>Create a safe backup, confirm once, and let GNM update your selected contacts.</p></article></div></div></section>

      <section className="section safety" id="safety"><div className="container safety-grid"><div className="safety-visual"><div className="shield">✓</div><div className="privacy-card"><span>◈</span><div><b>Privacy first</b><small>Your contact data stays protected</small></div></div></div>
        <div><span className="kicker light">BUILT AROUND YOUR SAFETY</span><h2>Your contacts belong<br />to <em>you.</em></h2><p>GNM is designed to put you in control at every step. Nothing changes until you review and confirm it.</p>
          <ul className="safety-list"><li><Check /><div><b>Automatic backup</b><span>Create a restorable copy before updating contacts.</span></div></li><li><Check /><div><b>Clear preview</b><span>Know exactly what will change before it happens.</span></div></li><li><Check /><div><b>Selective migration</b><span>Choose the contacts you want to update.</span></div></li><li><Check /><div><b>No contact selling</b><span>Your contact information is never sold or used for advertising.</span></div></li></ul></div>
      </div></section>

      <section className="section advanced" id="updates"><div className="container">
        <div className="section-heading"><span className="kicker">PUBLIC READINESS CENTRE</span><h2>Everything you need<br /><em>in one trusted place.</em></h2><p>Follow GNM's release journey and prepare your phone before the national migration.</p></div>
        <div className="readiness-grid">
          <article className="release-card"><div className="release-top"><span className="release-badge">IN DEVELOPMENT</span><span>Updated 25 Aug 2026</span></div><h3>Mobile app readiness</h3><div className="progress"><i /></div><div className="progress-label"><b>Production preparation</b><span>Advanced testing</span></div><ul><li><Check /> Android and iOS experience</li><li><Check /> Contact backup and restore</li><li><Check /> Migration preview and selection</li><li><span className="pending">•</span> Official store publication</li></ul></article>
          <article className="info-card"><span className="card-label">FOR INDIVIDUALS</span><h3>Prepare your phone</h3><p>Keep your device updated, review old contacts and make sure you have enough storage for a secure backup.</p><a href="#download">Get release notification <Arrow /></a></article>
          <article className="info-card business"><span className="card-label">FOR ORGANISATIONS</span><h3>Plan bulk migration</h3><p>Businesses and institutions can prepare contact lists and request support for larger migration needs.</p><Link to="/contact">Request organisation support <Arrow /></Link></article>
        </div>
        <div className="trust-banner"><div><span>OB</span><p><small>DEVELOPED AND MAINTAINED BY</small><b>OceanBrown</b></p></div><p>A registered youth-led Gambian technology company building practical digital solutions for people, businesses and institutions.</p><a href="https://oceanbrown.gm">Visit OceanBrown ↗</a></div>
      </div></section>

      <PublicContent />
      <section className="section" id="faq"><div className="container faq-grid"><div className="faq-intro"><span className="kicker">QUESTIONS, ANSWERED</span><h2>Good to<br /><em>know.</em></h2><p>Still need help? Our support team is ready to guide you.</p><Link className="text-link blue-link" to="/contact">Contact support <Arrow /></Link></div>
        <div className="faqs"><details open><summary>What is the Gambia Number Migrator?<span>+</span></summary><p>GNM is a mobile app that helps people, businesses and institutions update eligible Gambian contacts from the existing 7-digit format to the new 9-digit numbering format.</p></details>
          <details><summary>Will GNM change all my contacts?<span>+</span></summary><p>No. GNM only identifies eligible Gambian numbers. You can review every proposed change and choose which contacts to update.</p></details>
          <details><summary>Can I restore my old contacts?<span>+</span></summary><p>Yes. Create a backup before migration so you can restore your original contact information if needed.</p></details>
          <details><summary>Is GNM available for Android and iPhone?<span>+</span></summary><p>GNM is being prepared for both Android and iOS. Official download links will appear here when each store release is available.</p></details>
          <details><summary>Does GNM need internet access?<span>+</span></summary><p>Some services, such as checking official migration rules and account access, may require internet. Contact scanning and review are handled securely through the app.</p></details></div></div></section>

      <section className="download" id="download"><div className="container download-inner"><div><span className="kicker light">BE READY FOR THE NEW NUMBERING PLAN</span><h2>Keep your contacts.<br /><em>Move forward.</em></h2><p>Download GNM and update eligible contacts safely, quickly and confidently.</p></div>
        <div className="store-area">
          <StoreButton url={PLAY_STORE_URL} icon="▶" platform="Google Play" />
          <StoreButton url={APP_STORE_URL} icon="●" platform="App Store" />
          <p>Official release links will be published here.</p>
        </div></div></section>

      <footer><div className="container footer-top"><div className="brand footer-brand"><span className="brand-mark">G</span><span><b>GNM</b><small>Gambia Number Migrator</small></span></div><p>A locally developed mobile application supporting The Gambia's transition to the new national telephone numbering plan.</p><div className="footer-links"><a href="#checker">Checker</a><a href="#how">How it works</a><a href="#safety">Safety</a><a href="#updates">Updates</a><a href="#faq">FAQs</a><Link to="/contact">Support</Link></div></div>
        <div className="container legal-row"><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/support">Help &amp; support</Link><Link to="/contact">Contact</Link></div>
        <div className="container footer-bottom"><span>© 2026 OceanBrown. All rights reserved.</span><span>Built with care in The Gambia 🇬🇲</span></div></footer>
    </main>
  );
}

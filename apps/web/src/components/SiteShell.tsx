import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function SiteHeader() {
  return (
    <>
      <div className="notice"><div className="container"><span>🇬🇲</span><b>Supporting The Gambia's transition to the new 9-digit numbering plan</b><a href="/#updates">View readiness updates →</a></div></div>
      <header className="nav-wrap"><nav className="nav container" aria-label="Main navigation">
        <Link className="brand" to="/" aria-label="GNM home"><span className="brand-mark">G</span><span><b>GNM</b><small>Gambia Number Migrator</small></span></Link>
        <div className="nav-links"><a href="/#how">How it works</a><a href="/#safety">Safety</a><Link to="/support">Support</Link><Link to="/contact">Contact</Link></div>
        <a className="button button-small" href="/#download">Get the app</a>
      </nav></header>
    </>
  );
}

export function SiteFooter() {
  return (
    <footer>
      <div className="container footer-top">
        <div className="brand footer-brand"><span className="brand-mark">G</span><span><b>GNM</b><small>Gambia Number Migrator</small></span></div>
        <p>A locally developed mobile application supporting The Gambia's transition to the new national telephone numbering plan.</p>
        <div className="footer-links"><a href="/#how">How it works</a><Link to="/support">Support</Link><Link to="/contact">Contact</Link><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/data-deletion">Data deletion</Link></div>
      </div>
      <div className="container legal-row"><span>Official GNM website</span><a href="https://oceanbrown.gm">An OceanBrown product ↗</a></div>
      <div className="container footer-bottom"><span>© 2026 OceanBrown. All rights reserved.</span><span>Built with care in The Gambia 🇬🇲</span></div>
    </footer>
  );
}

export function InfoPage({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children: ReactNode }) {
  return (
    <main className="legal-page">
      <SiteHeader />
      <article className="legal-doc container"><span className="kicker">{eyebrow}</span><h1>{title}</h1><p className="legal-lead">{intro}</p>{children}</article>
      <SiteFooter />
    </main>
  );
}

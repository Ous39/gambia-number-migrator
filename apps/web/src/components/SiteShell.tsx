import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';

const NAV = [
  { to: '/#how', label: 'How it works', hash: true },
  { to: '/status', label: 'Status' },
  { to: '/updates', label: 'Updates' },
  { to: '/organisations', label: 'Organisations' },
  { to: '/support', label: 'Support' },
];

function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark' | null>(() => {
    try { return (localStorage.getItem('gnm-theme') as 'light' | 'dark' | null) || null; } catch { return null; }
  });
  useEffect(() => {
    const root = document.documentElement;
    if (theme) root.setAttribute('data-theme', theme);
    else root.removeAttribute('data-theme');
    try { theme ? localStorage.setItem('gnm-theme', theme) : localStorage.removeItem('gnm-theme'); } catch { /* private mode */ }
  }, [theme]);
  const prefersDark = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const isDark = theme ? theme === 'dark' : prefersDark;
  return { isDark, toggle: () => setTheme(isDark ? 'light' : 'dark') };
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { isDark, toggle } = useTheme();
  return (
    <>
      <div className="banner">
        <div className="container">
          <span aria-hidden="true">🇬🇲</span>
          <b>Supporting The Gambia's move to the 9-digit numbering plan</b>
          <Link to="/status">Live readiness →</Link>
        </div>
      </div>
      <header className={`topbar ${open ? 'nav-menu-open' : ''}`}>
        <div className="container topbar-inner">
          <Link className="brand" to="/" aria-label="GNM home" onClick={() => setOpen(false)}>
            <span className="brand-mark">G</span>
            <span><b>GNM</b><small>Gambia Number Migrator</small></span>
          </Link>
          <nav className="nav-links" aria-label="Primary">
            {NAV.map((item) => item.hash
              ? <a key={item.to} href={item.to} onClick={() => setOpen(false)}>{item.label}</a>
              : <NavLink key={item.to} to={item.to} onClick={() => setOpen(false)}>{item.label}</NavLink>)}
          </nav>
          <div className="nav-actions">
            <button className="theme-toggle" onClick={toggle} aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>{isDark ? '☀' : '☾'}</button>
            <a className="btn small" href="/#download">Get the app</a>
            <button className="nav-toggle" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}><span /></button>
          </div>
        </div>
      </header>
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="site">
      <div className="container">
        <div className="footer-grid">
          <div>
            <Link className="brand" to="/"><span className="brand-mark">G</span><span><b>GNM</b><small>Gambia Number Migrator</small></span></Link>
            <p className="muted" style={{ marginTop: 12, maxWidth: '30ch' }}>A locally built app supporting The Gambia's national telephone numbering transition.</p>
          </div>
          <div>
            <h4>Product</h4>
            <a href="/#how">How it works</a>
            <a href="/#checker">Number checker</a>
            <Link to="/status">Live status</Link>
            <Link to="/updates">Updates</Link>
          </div>
          <div>
            <h4>Get help</h4>
            <Link to="/support">Help centre</Link>
            <Link to="/contact">Contact</Link>
            <Link to="/organisations">Organisations</Link>
            <a href="/api/public/updates.xml">RSS feed</a>
          </div>
          <div>
            <h4>Legal</h4>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/data-deletion">Data deletion</Link>
            <a href="https://oceanbrown.gm" target="_blank" rel="noreferrer">OceanBrown ↗</a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} OceanBrown. All rights reserved.</span>
          <span>Built with care in The Gambia 🇬🇲</span>
        </div>
      </div>
    </footer>
  );
}

/** Standard page frame: header, main, footer. */
export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <SiteHeader />
      <main id="main" className={className}>{children}</main>
      <SiteFooter />
    </>
  );
}

/** Long-form document page (legal, policy). */
export function InfoPage({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children: ReactNode }) {
  return (
    <Page>
      <article className="container section doc prose">
        <span className="eyebrow">{eyebrow}</span>
        <h1 style={{ marginTop: 14 }}>{title}</h1>
        <p className="legal-lead">{intro}</p>
        {children}
      </article>
    </Page>
  );
}

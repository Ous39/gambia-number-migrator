import { Link } from 'react-router-dom';
import { Seo } from '../components/Seo';
import { Page } from '../components/SiteShell';

export default function NotFound() {
  return (
    <Page>
      <Seo title="Page not found | Gambia Number Migrator" description="This page could not be found." />
      <section className="section">
        <div className="container doc" style={{ textAlign: 'center' }}>
          <span className="eyebrow" style={{ justifyContent: 'center' }}>404</span>
          <h1 style={{ marginTop: 12 }}>This page doesn’t exist.</h1>
          <p className="lead" style={{ marginTop: 14, marginInline: 'auto' }}>
            The link may be out of date. Try the homepage, or check the live status page.
          </p>
          <div className="hero-cta" style={{ justifyContent: 'center', marginTop: 24 }}>
            <Link className="btn" to="/">Go to homepage</Link>
            <Link className="link-arrow" to="/status">Live status</Link>
          </div>
        </div>
      </section>
    </Page>
  );
}

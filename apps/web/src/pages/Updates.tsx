import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Seo } from '../components/Seo';
import { Page } from '../components/SiteShell';
import { getUpdates, type UpdateEntry } from '../api/client';

function fmt(value: string) {
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
}

export default function Updates() {
  const [items, setItems] = useState<UpdateEntry[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getUpdates()
      .then((d) => { if (active) setItems(d); })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : 'Could not load updates.'); });
    return () => { active = false; };
  }, []);

  return (
    <Page>
      <Seo title="Updates | Gambia Number Migrator" description="Official announcements about the Gambia numbering migration and each GNM release." />
      <section className="section">
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <span className="eyebrow">Readiness updates</span>
              <h1 style={{ marginTop: 14 }}>Updates</h1>
              <p className="lead">Official announcements about the migration and each GNM release.</p>
            </div>
            <a className="btn ghost small" href="/api/public/updates.xml">RSS feed</a>
          </div>

          {error && <div className="callout warn" style={{ marginTop: 24 }}><p>{error}</p></div>}
          {items && items.length === 0 && <div className="card" style={{ marginTop: 24 }}><p>No updates have been published yet. Check back soon.</p></div>}
          {!items && !error && <p className="muted" style={{ marginTop: 24 }}>Loading updates…</p>}

          {items && items.length > 0 && (
            <div className="updates-list" style={{ marginTop: 28 }}>
              {items.map((u) => (
                <Link className="update-item" to={`/updates/${u.slug}`} key={u.slug}>
                  <time>{fmt(u.publishedAt)}</time>
                  <h3>{u.title}</h3>
                  <p>{u.summary}</p>
                  <span className="link-arrow">Read update</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </Page>
  );
}

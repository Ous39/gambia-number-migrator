import { useEffect, useState } from 'react';
import { Seo } from '../components/Seo';
import { Page } from '../components/SiteShell';
import { getStatus, type PublicStatus } from '../api/client';

function fmtDate(value: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
}

export default function Status() {
  const [status, setStatus] = useState<PublicStatus | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = () => getStatus()
      .then((s) => { if (active) { setStatus(s); setError(''); } })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : 'Could not load status.'); })
      .finally(() => { if (active) setLoading(false); });
    load();
    const t = setInterval(load, 60_000);
    return () => { active = false; clearInterval(t); };
  }, []);

  const cards = status && !status.degraded ? [
    {
      k: 'Service', v: status.service.maintenance ? 'Maintenance' : 'Operational',
      s: status.service.minimumAppVersion ? `Minimum app version ${status.service.minimumAppVersion}` : 'All systems normal',
      badge: status.service.maintenance ? 'warn' : 'ok',
    },
    {
      k: 'Migration rules', v: status.rules.publishedVersion ? `v${status.rules.publishedVersion}` : 'Not published',
      s: status.rules.activeRuleCount != null ? `${status.rules.activeRuleCount} active rules · published ${fmtDate(status.rules.publishedAt)}` : 'Awaiting first publication',
      badge: status.rules.publishedVersion ? 'ok' : 'off',
    },
    {
      k: 'Access & pricing',
      v: status.pricing.freeLaunch ? 'Free launch' : `D${status.pricing.amount} ${status.pricing.currency}`,
      s: status.pricing.freeMode === 'first_n' && status.pricing.promotionalPlacesRemaining != null
        ? `${status.pricing.promotionalPlacesRemaining} free places remaining`
        : status.pricing.freeLaunch ? 'No payment required during the launch campaign' : 'One-time Contact Migration Pass',
      badge: status.pricing.freeLaunch || status.pricing.freeMode !== 'off' ? 'ok' : 'default',
    },
    {
      k: 'Payment options',
      v: [status.payments.wave && 'Wave', status.payments.aps && 'APS'].filter(Boolean).join(' · ') || 'None enabled',
      s: (status.payments.wave || status.payments.aps) ? 'Shown only in the direct download build' : 'Payments are not currently required',
      badge: (status.payments.wave || status.payments.aps) ? 'ok' : 'off',
    },
    {
      k: 'Transition window',
      v: status.transition.startDate ? `${fmtDate(status.transition.startDate)} → ${fmtDate(status.transition.endDate)}` : 'To be confirmed',
      s: status.transition.bannerMessage || 'Official parallel-running dates for the numbering change',
      badge: 'default',
    },
  ] : [];

  return (
    <Page>
      <Seo title="Live status | Gambia Number Migrator" description="Live readiness for GNM: service state, published migration-rule version, access and pricing, payment options and the official transition window." />
      <section className="section">
        <div className="container">
          <span className="eyebrow"><span className="dot live" /> Live readiness</span>
          <h1 style={{ marginTop: 14 }}>GNM status</h1>
          <p className="lead">A real-time view of where GNM is in its release journey and what applies to you today. Refreshes every minute.</p>

          {loading && !status && <p className="muted" style={{ marginTop: 24 }}>Loading live status…</p>}
          {error && !status && <div className="callout warn" style={{ marginTop: 24 }}><p>{error} The GNM app remains the source of truth for eligibility.</p></div>}
          {status?.degraded && <div className="callout warn" style={{ marginTop: 24 }}><p>Live status is temporarily unavailable. Please check back shortly.</p></div>}

          {status && !status.degraded && (
            <>
              {status.announcement && (
                <div className="callout ok" style={{ marginTop: 24 }}>
                  <span className="tick">i</span>
                  <p><b>Now:</b> {status.announcement}</p>
                </div>
              )}
              <div className="status-grid" style={{ marginTop: 24 }}>
                {cards.map((c) => (
                  <div className="status-card" key={c.k}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="k">{c.k}</span>
                      <span className={`badge ${c.badge === 'default' ? '' : c.badge}`}>{c.badge === 'ok' ? 'OK' : c.badge === 'warn' ? 'Notice' : c.badge === 'off' ? 'Off' : 'Info'}</span>
                    </div>
                    <div className="v">{c.v}</div>
                    <div className="s">{c.s}</div>
                  </div>
                ))}
              </div>
              <p className="status-note">Last updated {new Date(status.generatedAt).toLocaleTimeString('en-GB')}. This page is informational; final eligibility is always confirmed inside the GNM app using the approved numbering rules.</p>
            </>
          )}
        </div>
      </section>
    </Page>
  );
}

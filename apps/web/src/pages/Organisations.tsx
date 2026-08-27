import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { Seo } from '../components/Seo';
import { Page } from '../components/SiteShell';
import { submitInquiry } from '../api/client';

type State = 'idle' | 'sending' | 'success' | 'error';

const BENEFITS = [
  ['Plan by list size', 'Tell us your approximate contact volume and we help you sequence the migration in safe batches.'],
  ['Staff guidance', 'Clear steps for the people doing the work — backup first, review, confirm, restore if needed.'],
  ['No contact data shared', 'You never send us phone numbers or names. Everything runs on each device.'],
  ['Priority support', 'A named point of contact during your migration window.'],
];

export default function Organisations() {
  const [state, setState] = useState<State>('idle');
  const [message, setMessage] = useState('');

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState('sending');
    const f = new FormData(e.currentTarget);
    const body = [
      `Organisation: ${f.get('org')}`,
      `Contact person: ${f.get('name')}`,
      `Role: ${f.get('role') || '—'}`,
      `Approx. contacts to migrate: ${f.get('volume')}`,
      `Devices / staff involved: ${f.get('devices') || '—'}`,
      `Preferred migration window: ${f.get('window') || '—'}`,
      '',
      `Notes: ${f.get('notes') || '—'}`,
    ].join('\n');
    try {
      await submitInquiry({
        name: String(f.get('name') || ''),
        email: String(f.get('email') || ''),
        category: 'organisation',
        message: body,
      });
      setState('success');
      setMessage('Thank you. Your organisation request has been received and will appear in the GNM admin dashboard for review.');
      e.currentTarget.reset();
    } catch (err) {
      setState('error');
      setMessage(err instanceof Error ? err.message : 'Please try again.');
    }
  }

  return (
    <Page>
      <Seo title="Organisations | Gambia Number Migrator" description="Businesses and institutions can plan a larger contact migration and request dedicated GNM support. No contact data is ever shared." />

      <section className="hero">
        <div className="container">
          <span className="eyebrow">For businesses & institutions</span>
          <h1 style={{ marginTop: 14 }}>Plan a larger migration<br />with confidence.</h1>
          <p className="lead">GNM works the same on every phone — on-device, backup-first, reviewed before any change. For teams with many contacts to update, tell us about your needs and we'll help you plan it.</p>
          <div className="hero-cta">
            <a className="btn" href="#request">Request support</a>
            <Link className="link-arrow" to="/status">Check readiness first</Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="tri">
            {BENEFITS.map(([t, d]) => (
              <article className="card" key={t}>
                <div className="step-ic">✓</div>
                <h3>{t}</h3>
                <p>{d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-tint" id="request">
        <div className="container hero-grid">
          <div>
            <span className="eyebrow">Send a request</span>
            <h2>Tell us about your organisation.</h2>
            <p className="lead">We only need enough to help you plan. Do not include any phone numbers or contact names.</p>
            <div className="callout ok" style={{ marginTop: 20 }}>
              <span className="tick">✓</span>
              <p>Your request appears securely in the GNM administration dashboard. Never send an OTP, PIN, password or contact export.</p>
            </div>
          </div>
          <form className="form card pad-lg" onSubmit={submit}>
            <div className="form-row-2">
              <label>Organisation name *<input name="org" required minLength={2} maxLength={140} /></label>
              <label>Approx. contacts to migrate *<input name="volume" required maxLength={40} placeholder="e.g. 2,500" /></label>
            </div>
            <div className="form-row-2">
              <label>Your name *<input name="name" required minLength={2} maxLength={100} autoComplete="name" /></label>
              <label>Your role<input name="role" maxLength={100} /></label>
            </div>
            <div className="form-row-2">
              <label>Email address *<input name="email" type="email" required maxLength={160} autoComplete="email" /></label>
              <label>Devices / staff involved<input name="devices" maxLength={60} placeholder="e.g. 15 phones" /></label>
            </div>
            <label>Preferred migration window<input name="window" maxLength={80} placeholder="e.g. first two weeks of the transition" /></label>
            <label>Anything else we should know<textarea name="notes" maxLength={2000} rows={4} /></label>
            <button className="btn" disabled={state === 'sending'}>{state === 'sending' ? 'Sending…' : 'Send request →'}</button>
            {message && <p className={`form-status ${state}`} aria-live="polite">{message}</p>}
            <small className="form-hint">Fields marked * are required. No contact data.</small>
          </form>
        </div>
      </section>
    </Page>
  );
}

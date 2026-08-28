import { Seo } from '../components/Seo';
import { Page } from '../components/SiteShell';

/** Landing page for provider redirects (Wave success_url / error_url). */
export default function PaymentResult({ variant }: { variant: 'success' | 'error' }) {
  const ok = variant === 'success';
  return (
    <Page>
      <Seo
        title={ok ? 'Payment received | GNM' : 'Payment not completed | GNM'}
        description={ok ? 'Your GNM payment was received.' : 'Your GNM payment did not complete.'}
        noindex
      />
      <section className="section">
        <div className="container doc">
          <span className="eyebrow">{ok ? 'Payment received' : 'Payment not completed'}</span>
          <h1 style={{ marginTop: 12 }}>{ok ? 'Thank you — payment received.' : 'That payment didn’t go through.'}</h1>
          <p className="lead" style={{ marginTop: 14 }}>
            {ok
              ? 'You can return to the GNM app now. Your access unlocks automatically once the payment is confirmed — this usually takes under a minute. If it hasn’t unlocked after a few minutes, reopen the app and pull to refresh.'
              : 'No charge was made, or the payment was cancelled. Return to the GNM app and try again, or choose a different payment option.'}
          </p>
          <div className="callout" style={{ marginTop: 20 }}>
            <span className="tick">i</span>
            <p>Keep your payment reference. If you need help, contact GNM support with that reference — never share your payment PIN or OTP.</p>
          </div>
          <div className="hero-cta" style={{ marginTop: 24 }}>
            <a className="btn" href="gnm://">Open the GNM app</a>
            <a className="link-arrow" href="/support">Get help</a>
          </div>
        </div>
      </section>
    </Page>
  );
}

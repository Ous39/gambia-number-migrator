import { Seo } from '../components/Seo';
import { Page } from '../components/SiteShell';
import { ContactForm } from '../components/ContactForm';
import { useSupportConfig } from '../hooks/useSupportConfig';

export default function Contact() {
  const { supportEmail } = useSupportConfig();
  const routes: Array<[string, string, string, string]> = [
    ['01', 'General & technical support', 'Include your device type, OS, GNM app version and a short description of the issue.', 'GNM%20Support%20Request'],
    ['02', 'Business & institution support', 'Tell us the organisation name and approximate number of contacts. Do not attach contact data.', 'GNM%20Organisation%20Migration'],
    ['03', 'Partnerships & media', 'Regulator, operator, technology, distribution, funding, media and community enquiries.', 'GNM%20Partnership%20Enquiry'],
  ];
  return (
    <Page>
      <Seo title="Contact GNM | Gambia Number Migrator" description="Contact the GNM support and partnership team for technical help, business migration, media and partnership enquiries." />
      <section className="section">
        <div className="container hero-grid">
          <div>
            <span className="eyebrow">Contact GNM</span>
            <h1 style={{ marginTop: 14 }}>We're here to help.</h1>
            <p className="lead">App support, organisation planning, or a partnership — choose the right route below, or send a message directly.</p>
            <div className="callout ok" style={{ marginTop: 20 }}>
              <span className="tick">✓</span>
              <p>Never include an OTP, PIN, password or full contact backup in your message.</p>
            </div>
          </div>
          <div className="stack">
            {routes.map(([n, title, body, subj]) => (
              <div className="card" key={n}>
                <span className="step-no">{n}</span>
                <h3 style={{ marginTop: 6 }}>{title}</h3>
                <p>{body}</p>
                <a className="link-arrow" href={`mailto:${supportEmail}?subject=${subj}`}>{supportEmail}</a>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-tint">
        <div className="container hero-grid">
          <div>
            <span className="eyebrow">Send us a message</span>
            <h2>Contact the GNM team directly.</h2>
            <p className="lead">Your enquiry appears securely in the GNM administration dashboard for review.</p>
          </div>
          <ContactForm />
        </div>
      </section>
    </Page>
  );
}

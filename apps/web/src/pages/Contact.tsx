import { Seo } from '../components/Seo';
import { SiteHeader, SiteFooter } from '../components/SiteShell';
import { ContactForm } from '../components/ContactForm';
import { useSupportConfig } from '../hooks/useSupportConfig';

export default function Contact() {
  const { supportEmail } = useSupportConfig();
  return (
    <main className="legal-page">
      <Seo title="Contact GNM | Gambia Number Migrator" description="Contact the GNM support and partnership team for technical help, business migration, media and partnership enquiries." />
      <SiteHeader />
      <div className="contact-hero container">
        <div>
          <span className="kicker">CONTACT GNM</span><h1>We're here to help.</h1>
          <p>Whether you need app support, want to prepare an organisation, or would like to partner with GNM, choose the right contact route below.</p>
          <div className="response-note"><span>✓</span><p><b>Clear and safe support</b><small>Never include an OTP, PIN, password or full contact backup in your message.</small></p></div>
        </div>
        <div className="contact-panel">
          <div className="contact-item"><span>01</span><div><small>GENERAL &amp; TECHNICAL SUPPORT</small><h2>App help and problem reports</h2><p>Include your device type, operating system, GNM app version and a short description of the issue.</p><a href={`mailto:${supportEmail}?subject=GNM%20Support%20Request`}>{supportEmail} →</a></div></div>
          <div className="contact-item"><span>02</span><div><small>BUSINESS &amp; INSTITUTION SUPPORT</small><h2>Plan a larger migration</h2><p>Tell us the organisation name, approximate number of contacts and the support you need. Do not attach contact data.</p><a href={`mailto:${supportEmail}?subject=GNM%20Organisation%20Migration`}>Request organisation support →</a></div></div>
          <div className="contact-item"><span>03</span><div><small>PARTNERSHIPS &amp; MEDIA</small><h2>Work with the GNM team</h2><p>For regulator, operator, technology, distribution, funding, media and community partnership enquiries.</p><a href={`mailto:${supportEmail}?subject=GNM%20Partnership%20Enquiry`}>Send a partnership enquiry →</a></div></div>
        </div>
      </div>
      <section className="contact-form-section container">
        <div><span className="kicker">SEND US A MESSAGE</span><h2>Contact the GNM team directly.</h2><p>Your enquiry will appear securely in the GNM administration dashboard for review.</p></div>
        <ContactForm />
      </section>
      <section className="contact-faq container">
        <div><span className="kicker">BEFORE YOU CONTACT US</span><h2>Help us help you faster.</h2></div>
        <div>
          <p><b>For technical issues</b><span>Include what you expected, what happened and any error message. You may attach a screenshot only after hiding phone numbers and private information.</span></p>
          <p><b>Expected response</b><span>We aim to acknowledge genuine enquiries as soon as possible. Response times may be longer during the national migration period.</span></p>
          <p><b>Official communications</b><span>Trust only messages published on this website or sent from an official OceanBrown address.</span></p>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}

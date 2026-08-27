import { Seo } from '../components/Seo';
import { InfoPage } from '../components/SiteShell';
import { useSupportConfig } from '../hooks/useSupportConfig';

export default function Terms() {
  const { supportEmail } = useSupportConfig();
  return (
    <>
      <Seo title="Terms of Use | Gambia Number Migrator" description="Read the terms governing use of the GNM mobile application and public website." />
      <InfoPage eyebrow="TERMS OF USE" title="Simple rules for safe migration." intro="These terms govern access to the GNM website and mobile application. By using GNM, you agree to use it responsibly and review all proposed contact changes.">
        <div className="legal-meta">Effective date: 16 August 2026 · Version 1.0</div>
        <section><h2>1. About the service</h2><p>GNM is a contact-migration assistant provided by OceanBrown. It helps identify eligible Gambian telephone numbers, preview proposed changes, create backups and update selected contacts according to published migration rules. GNM is not a telecommunications operator and does not provide network service.</p></section>
        <section><h2>2. Eligibility and authority</h2><p>You must be legally able to accept these terms and authorised to manage the device, contacts, account or organisational data you use with GNM. Organisations are responsible for ensuring their staff have appropriate authority.</p></section>
        <section><h2>3. Your responsibility before migration</h2><p>You must review the proposed changes, create or verify an appropriate backup and confirm that selected numbers should be updated. Automated detection may not identify every special, international, duplicated or incorrectly saved number.</p></section>
        <section><h2>4. Accounts and security</h2><p>You are responsible for protecting your device, login method and account. Do not share an OTP, passcode, password or payment PIN. Notify support if you believe your account or device access has been compromised.</p></section>
        <section><h2>5. Trials, subscriptions and payments</h2><p>GNM may offer free, trial or paid access. Prices, feature limits and payment terms will be displayed before confirmation. Payments may be processed by approved third-party providers. Unless required by law or expressly stated, completed digital-service payments may be non-refundable after access is activated.</p></section>
        <section><h2>6. Acceptable use</h2><p>You must not access contacts without authority, misuse personal information, reverse engineer protected parts of the service, bypass feature limits, interfere with security, introduce harmful code, impersonate another person or use GNM for unlawful activity.</p></section>
        <section><h2>7. Official rules and service changes</h2><p>Supported numbering ranges and migration rules may change following official updates. OceanBrown may improve, suspend or remove features to maintain security, accuracy, compliance or service reliability. Important changes will be communicated through appropriate GNM channels.</p></section>
        <section><h2>8. Availability and warranties</h2><p>GNM is provided with reasonable care but uninterrupted or error-free operation cannot be guaranteed. Device restrictions, outdated software, damaged contacts, insufficient storage, network availability and third-party services may affect performance.</p></section>
        <section><h2>9. Limitation and recovery</h2><p>To the extent permitted by applicable law, OceanBrown is not responsible for loss caused by unauthorised use, failure to review changes, ignored warnings, unavailable backups or circumstances beyond reasonable control. This does not exclude rights or liability that cannot legally be excluded.</p></section>
        <section><h2>10. Intellectual property</h2><p>GNM branding, software, website content, interface and related materials belong to OceanBrown or its licensors. These terms grant a limited, revocable and non-transferable right to use the service for its intended purpose.</p></section>
        <section><h2>11. Governing terms and contact</h2><p>These terms are intended to operate under the applicable laws of The Gambia. Questions may be sent through the <a href="/contact">contact page</a> or to <a href={`mailto:${supportEmail}?subject=GNM%20Terms`}>{supportEmail}</a>.</p></section>
      </InfoPage>
    </>
  );
}

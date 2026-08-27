import { Seo } from '../components/Seo';
import { InfoPage } from '../components/SiteShell';
import { useSupportConfig } from '../hooks/useSupportConfig';

export default function Privacy() {
  const { supportEmail } = useSupportConfig();
  return (
    <>
      <Seo title="Privacy Policy | Gambia Number Migrator" description="Read how GNM handles contact permissions, backups, account information, payments and user privacy." />
      <InfoPage eyebrow="PRIVACY POLICY" title="Your contacts. Your control." intro="This policy explains what information GNM may process, why it is needed, how it is protected and the choices available to you.">
        <div className="legal-meta">Effective date: 16 August 2026 · Version 1.0</div>
        <aside className="policy-summary"><b>Privacy at a glance</b><div><span>✓ Review before changes</span><span>✓ Backup and restore</span><span>✓ No selling contact data</span><span>✓ Permission-based access</span></div></aside>
        <section><h2>1. Who we are</h2><p>Gambia Number Migrator ("GNM") is a mobile application developed and operated by OceanBrown in The Gambia. It assists individuals, businesses and institutions in updating eligible telephone numbers during the national numbering transition.</p></section>
        <section><h2>2. Information GNM may process</h2><p>Depending on the features you use, GNM may process contact names and phone numbers on your device, backup and migration records, basic account details, subscription or payment status, device and app information, diagnostic events, and support messages you choose to send.</p></section>
        <section><h2>3. Contact permission and migration</h2><p>GNM requests contact access so it can scan eligible numbers, show a proposed migration, create a backup and apply only the changes you approve. GNM does not change a contact until you confirm the migration. Permission can be withdrawn through your device settings.</p></section>
        <section><h2>4. Backups and restoration</h2><p>When you choose to create a backup, GNM prepares a recoverable record for restoration. Backup behaviour may differ by operating system and app version. You are responsible for keeping access to your device secure and reviewing restoration results.</p></section>
        <section><h2>5. Accounts, payments and notifications</h2><p>GNM may process your phone number or other account identifier to authenticate access, confirm eligibility, manage trial or subscription status and deliver service notifications. Payment providers process payment credentials under their own privacy terms; GNM should not request your payment PIN or OTP through email or support messages.</p></section>
        <section><h2>6. How information is used</h2><p>Information is used to provide scanning, preview, backup, migration and restore functions; maintain account and entitlement status; prevent abuse; improve reliability; answer support requests; and meet applicable legal or regulatory obligations.</p></section>
        <section><h2>7. Sharing and sale of data</h2><p>GNM does not sell contact data. Limited information may be shared with essential service providers only where required to operate hosting, authentication, payments, notifications, analytics or customer support, subject to appropriate safeguards and purpose limitations.</p></section>
        <section><h2>8. Security and retention</h2><p>OceanBrown applies reasonable organisational and technical safeguards to protect information. No system is completely risk-free. Information is retained only for as long as needed for the stated purpose, legal obligations, security, dispute resolution or service continuity.</p></section>
        <section><h2>9. Your choices and rights</h2><p>You may decline or withdraw device permissions, choose which contacts to migrate, restore an available backup, disable notifications through device settings, ask questions about your information, and request correction or deletion where applicable and technically possible. See the <a href="/data-deletion">data deletion page</a> for exactly what server-side data GNM retains and how to request its deletion.</p></section>
        <section><h2>10. Children and changes to this policy</h2><p>GNM is not designed to knowingly collect personal information from children without appropriate consent. This policy may be updated as the app, official numbering rules or legal requirements change. The current version and effective date will remain published here.</p></section>
        <section><h2>11. Contact us</h2><p>For privacy questions or requests, email <a href={`mailto:${supportEmail}?subject=GNM%20Privacy%20Request`}>{supportEmail}</a> or use the <a href="/contact">GNM contact page</a>. Never send an OTP, PIN, password or full contact backup.</p></section>
      </InfoPage>
    </>
  );
}

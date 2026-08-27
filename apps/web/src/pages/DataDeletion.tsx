import { Seo } from '../components/Seo';
import { InfoPage } from '../components/SiteShell';
import { useSupportConfig } from '../hooks/useSupportConfig';

export default function DataDeletion() {
  const { supportEmail } = useSupportConfig();
  const subject = encodeURIComponent('GNM Data Deletion Request');
  const body = encodeURIComponent('Device or account identifier (if known): \nWhat to delete: \n\nI understand my contacts were never uploaded to GNM and this request only affects data stored on OceanBrown\'s servers.');
  return (
    <>
      <Seo title="Data Deletion Request | Gambia Number Migrator" description="How to request deletion of the device, payment and notification data GNM stores on its servers. Contacts, names and phone numbers never leave your device." />
      <InfoPage
        eyebrow="DATA DELETION"
        title="Request deletion of your data"
        intro="GNM does not use traditional user accounts, and your contacts never leave your device. This page explains the small amount of data GNM's servers do retain, and exactly how to have it deleted."
      >
        <section>
          <h2>1. What never leaves your device</h2>
          <p>Contact names, contact phone numbers, migration previews and local backup files are processed and stored only on your phone. They are never uploaded to OceanBrown's servers, sent to analytics, or included in crash reports. There is nothing to delete on our side for this category, because we never had it.</p>
        </section>
        <section>
          <h2>2. What GNM's servers do retain</h2>
          <p>To operate scanning eligibility, the free-access campaign, paid access and service notifications, the GNM API stores a small server-side record tied to a random per-install device identifier:</p>
          <ul>
            <li>Device identifier, device model, OS name/version, app version and the IP address seen at registration</li>
            <li>Access status (trial, campaign, paid) and, if a payment was made, the payment record (provider, amount, currency, status and reference — never card, PIN or OTP)</li>
            <li>A push-notification token, if you enabled notifications</li>
            <li>Any message you send us directly (for example, via the <a href="/contact">contact page</a> or support email)</li>
          </ul>
        </section>
        <section>
          <h2>3. How to request deletion</h2>
          <p>Email <a href={`mailto:${supportEmail}?subject=${subject}&body=${body}`}>{supportEmail}</a> with the subject "Data Deletion Request". If you know it, include your device's support code (visible on the GNM Settings screen) so we can locate the correct record — this is not required, and we can also locate a record from the device identifier alone if you no longer have the app installed.</p>
          <p>We will confirm your request and delete the device record, payment record association, and push token from active systems within 30 days. Backups of the database (kept only for disaster recovery) are rotated out and fully purged within 90 days.</p>
        </section>
        <section>
          <h2>4. What we cannot delete</h2>
          <p>Where OceanBrown is legally required to retain payment or transaction records for accounting, tax or fraud-prevention purposes, that specific record may be retained for the legally mandated period even after a deletion request, with all other associated device data removed. We will tell you plainly if this applies to your request.</p>
        </section>
        <section>
          <h2>5. Uninstalling the app</h2>
          <p>Uninstalling GNM removes everything stored on your device (contacts are untouched — GNM only edits contacts you explicitly confirmed) but does not automatically delete the small server-side record described above. Use this page to request that separately.</p>
        </section>
        <section>
          <h2>6. Related policies</h2>
          <p>See the full <a href="/privacy">Privacy Policy</a> for how information is used while your access is active, and the <a href="/terms">Terms</a> for payment terms.</p>
        </section>
      </InfoPage>
    </>
  );
}

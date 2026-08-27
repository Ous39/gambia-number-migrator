import { Seo } from '../components/Seo';
import { InfoPage } from '../components/SiteShell';
import { useSupportConfig } from '../hooks/useSupportConfig';

export default function Refunds() {
  const { supportEmail } = useSupportConfig();
  return (
    <>
      <Seo title="Refund Policy | Gambia Number Migrator" description="How GNM handles refunds for the one-time Contact Migration Pass." />
      <InfoPage
        eyebrow="REFUND POLICY"
        title="Refunds for the Contact Migration Pass"
        intro="The GNM Contact Migration Pass is a one-time digital unlock of D25 (GMD). This page explains when a refund is available and how to request one."
      >
        <div className="legal-meta">Applies to paid access only. GNM is free during the launch campaign.</div>
        <section>
          <h2>1. Charged but not activated</h2>
          <p>If your payment was charged but the Pass did not activate on your device, contact <a href={`mailto:${supportEmail}?subject=GNM%20Refund%20Request`}>{supportEmail}</a> with your payment reference within <strong>14 days</strong>. We will verify with the payment provider and either activate the Pass or refund the D25 in full.</p>
        </section>
        <section>
          <h2>2. Other refund requests</h2>
          <p>Because the Pass grants immediate access to digital features, refunds are otherwise granted only where required by applicable law in The Gambia.</p>
        </section>
        <section>
          <h2>3. How refunds are paid</h2>
          <p>Approved refunds are returned to the mobile-money account used for payment, normally within 5 business days of approval. GNM never asks for your payment PIN or OTP to process a refund.</p>
        </section>
        <section>
          <h2>4. Free-launch period</h2>
          <p>While the free-access campaign is active, no payment is taken and there is nothing to refund. If you believe you were charged during a free-launch period, contact support and we will investigate.</p>
        </section>
        <section>
          <h2>5. Contact</h2>
          <p>Refund questions: <a href={`mailto:${supportEmail}?subject=GNM%20Refund%20Question`}>{supportEmail}</a>, or the <a href="/contact">contact page</a>. See also the <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.</p>
        </section>
      </InfoPage>
    </>
  );
}

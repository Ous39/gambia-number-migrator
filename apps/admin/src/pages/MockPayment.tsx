import { useParams } from 'react-router-dom';

export default function MockPayment() {
  const { reference } = useParams();
  return (
    <>
      <div className="topbar"><div className="pageTitle"><h1>Mock Payment</h1><p>Testing page for the subscription interface before live payment integration.</p></div><span className="badge">Test only</span></div>
      <div className="card heroCard"><h1>Payment reference ready</h1><p>Use the Payments page to confirm this manual/mock transaction. No real money is charged in this build.</p><div className="toolbar"><span className="badge">Reference: {reference}</span><span className="badge">Manual confirm</span></div></div>
      <div className="card"><h2>Next step</h2><p>Open Payments, find this reference, then click Confirm. The mobile device will become active for testing.</p></div>
    </>
  );
}

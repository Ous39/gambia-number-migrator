import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CreditCard, Search, ShieldAlert, WalletCards, XCircle } from 'lucide-react';
import { api } from '../api/client';

type ProviderHealth = {
  configured: boolean;
  missing: string[];
  currency: string | null;
  apiKeyTail: string | null;
  enabled: boolean;
};
type PaymentsHealth = {
  testMode: boolean;
  integrationReady: boolean;
  wave: ProviderHealth;
  aps: ProviderHealth;
};

export default function Payments() {
  const [items, setItems] = useState<any[]>([]);
  const [health, setHealth] = useState<PaymentsHealth | null>(null);
  const [msg, setMsg] = useState('');
  const [query, setQuery] = useState('');

  const load = () => api<any>('/admin/payments').then((r) => setItems(r.data));
  const loadHealth = () => api<{ data: PaymentsHealth }>('/admin/payments/health').then((r) => setHealth(r.data));

  useEffect(() => {
    load().catch((e) => setMsg(e.message));
    loadHealth().catch(() => undefined);
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return q ? items.filter((x) => `${x.reference} ${x.provider} ${x.status} ${x.device_id}`.toLowerCase().includes(q)) : items;
  }, [items, query]);

  async function confirm(id: string) {
    setMsg('');
    try {
      await api('/admin/payments/' + id + '/confirm-manual', { method: 'POST' });
      setMsg('Test payment confirmed and device access updated.');
      await load();
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  const successful = items.filter((x) => x.status === 'success').length;
  const canManualConfirm = health?.testMode === true && health?.integrationReady === false;

  return (
    <div className="adminPage">
      <div className="topbar">
        <div className="pageTitle">
          <span className="eyebrow">PAYMENT OPERATIONS</span>
          <h1>Payments</h1>
          <p>Server-verified Wave &amp; APS checkout status. Secrets are never shown here.</p>
        </div>
        <span className={`contextBadge ${health?.testMode ? 'warning' : ''}`}>
          <ShieldAlert size={17} />
          {health ? (health.testMode ? 'Test mode' : health.integrationReady ? 'Live integration armed' : 'Live disabled') : '…'}
        </span>
      </div>
      {msg && <p className="notice">{msg}</p>}

      <section className="card">
        <h2>Provider configuration health</h2>
        <p>A wallet can only be switched on in App configuration once its row below reads <b>Configured</b>.</p>
        <div className="switchGrid">
          {(['wave', 'aps'] as const).map((id) => {
            const h = health?.[id];
            return (
              <div key={id} className="switchCard" style={{ alignItems: 'flex-start' }}>
                <span>
                  <b>{id.toUpperCase()}</b>
                  <small>
                    {h
                      ? <>
                          {h.configured ? <CheckCircle2 size={14} /> : <XCircle size={14} />}{' '}
                          {h.configured ? 'Configured' : `Missing: ${h.missing.join(', ') || 'unknown'}`}
                          <br />
                          Enabled: {h.enabled ? 'yes' : 'no'}
                          {id === 'wave' && <> · Currency: {h.currency || '—'} · Key ••••{h.apiKeyTail || '----'}</>}
                        </>
                      : 'Loading…'}
                  </small>
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <div className="summaryGrid">
        <div className="summaryCard"><WalletCards size={22} /><span><small>Total intents</small><b>{items.length}</b></span></div>
        <div className="summaryCard"><CreditCard size={22} /><span><small>Successful</small><b>{successful}</b></span></div>
        <div className="summaryCard"><ShieldAlert size={22} /><span><small>Pending</small><b>{items.filter((x) => ['pending', 'creating'].includes(x.status)).length}</b></span></div>
      </div>

      {canManualConfirm && (
        <div className="notice warningNotice">
          <ShieldAlert size={20} />
          <span><b>Local testing only.</b> Manual confirmation is available because test mode is on and the live integration is disabled.</span>
        </div>
      )}

      <section className="card dataCard">
        <div className="tableToolbar">
          <div><h2>Transaction history</h2><p>Payment references and entitlement status.</p></div>
          <label className="searchBox"><Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search reference, provider or status" /></label>
        </div>
        <div className="tableWrap">
          <table>
            <thead><tr><th>Reference</th><th>Provider</th><th>Feature</th><th>Amount</th><th>Status</th><th>Created</th><th>Action</th></tr></thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td><code>{p.reference}</code></td>
                  <td><strong>{String(p.provider).toUpperCase()}</strong></td>
                  <td>{humanize(p.feature_key)}</td>
                  <td><strong>{p.amount} {p.currency}</strong></td>
                  <td><span className={`statusBadge ${p.status}`}>{p.status}</span></td>
                  <td>{new Date(p.created_at).toLocaleString()}</td>
                  <td>
                    {p.status === 'success'
                      ? <span className="completedLabel">Confirmed</span>
                      : canManualConfirm
                        ? <button className="btn compact" onClick={() => confirm(p.id)}>Confirm test</button>
                        : <span className="completedLabel">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && <div className="emptyState"><CreditCard size={28} /><b>No matching payments</b><span>New payment intents will appear here.</span></div>}
      </section>
    </div>
  );
}

function humanize(v: string) {
  return String(v || '').replace(/_/g, ' ');
}

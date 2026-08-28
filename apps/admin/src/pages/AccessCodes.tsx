import { Fragment, useEffect, useMemo, useState } from 'react';
import { Copy, KeyRound, Search, Ticket, Users, XCircle } from 'lucide-react';
import { api } from '../api/client';

type AccessCode = {
  id: string;
  code: string;
  seats: number;
  redeemedCount: number;
  seatsRemaining: number;
  source: 'admin' | 'purchase';
  status: 'active' | 'revoked' | 'expired';
  label: string | null;
  paymentReference: string | null;
  paymentAmount: number | null;
  paymentCurrency: string | null;
  expiresAt: string | null;
  createdAt: string;
};
type Redemption = { device_id: string; redeemed_at: string; device_status: string | null; device_access_source: string | null };

const SEAT_PRESETS = [5, 10, 15];

export default function AccessCodes() {
  const [items, setItems] = useState<AccessCode[]>([]);
  const [msg, setMsg] = useState('');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  const [seats, setSeats] = useState('10');
  const [quantity, setQuantity] = useState('1');
  const [label, setLabel] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [lastGenerated, setLastGenerated] = useState<AccessCode[]>([]);

  const [openId, setOpenId] = useState<string | null>(null);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);

  const [pricing, setPricing] = useState<{ tiers: Record<string, number>; custom_unit: number; custom_min_seats: number; custom_max_seats: number } | null>(null);
  const [pricingDraft, setPricingDraft] = useState('');
  const [savingPricing, setSavingPricing] = useState(false);

  const load = () => api<{ data: AccessCode[] }>('/admin/access-codes').then((r) => setItems(r.data));
  const loadPricing = () => api<{ data: Record<string, any> }>('/app-config').then((r) => {
    const p = r.data.org_pricing || null;
    setPricing(p);
    if (p) setPricingDraft(JSON.stringify(p, null, 2));
  });

  useEffect(() => {
    load().catch((e) => setMsg(e.message));
    loadPricing().catch(() => undefined);
  }, []);

  async function savePricing() {
    setMsg('');
    setSavingPricing(true);
    try {
      const parsed = JSON.parse(pricingDraft);
      await api('/admin/app-config', { method: 'PUT', body: JSON.stringify({ org_pricing: parsed }) });
      setMsg('Organisation seat pricing saved.');
      await loadPricing();
    } catch (err: any) {
      setMsg(err instanceof SyntaxError ? 'Pricing must be valid JSON.' : err.message);
    } finally {
      setSavingPricing(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return items;
    return items.filter((c) => `${c.code} ${c.label || ''} ${c.source} ${c.status} ${c.paymentReference || ''}`.toLowerCase().includes(q));
  }, [items, query]);

  const totals = useMemo(() => ({
    codes: items.length,
    seats: items.reduce((n, c) => n + c.seats, 0),
    redeemed: items.reduce((n, c) => n + c.redeemedCount, 0),
  }), [items]);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    setBusy(true);
    try {
      const body: Record<string, unknown> = { seats: Number(seats), quantity: Number(quantity) };
      if (label.trim()) body.label = label.trim();
      if (expiresAt) body.expiresAt = new Date(expiresAt).toISOString();
      const r = await api<{ data: AccessCode[] }>('/admin/access-codes', { method: 'POST', body: JSON.stringify(body) });
      setLastGenerated(r.data);
      setMsg(`Generated ${r.data.length} code${r.data.length === 1 ? '' : 's'} · ${Number(seats)} device${Number(seats) === 1 ? '' : 's'} each.`);
      setLabel('');
      setExpiresAt('');
      await load();
    } catch (err: any) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    setMsg('');
    try {
      const r = await api<{ data: { activeDevicesStillUnlocked: number } }>(`/admin/access-codes/${id}/revoke`, { method: 'POST' });
      const n = r.data.activeDevicesStillUnlocked;
      setMsg(n > 0
        ? `Code revoked. ${n} device${n === 1 ? '' : 's'} already unlocked with it keep access — revoke each in Support Devices if needed.`
        : 'Code revoked. It can no longer be redeemed.');
      await load();
    } catch (err: any) {
      setMsg(err.message);
    }
  }

  async function toggleRedemptions(id: string) {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id);
    setRedemptions([]);
    try {
      const r = await api<{ data: Redemption[] }>(`/admin/access-codes/${id}/redemptions`);
      setRedemptions(r.data);
    } catch (err: any) {
      setMsg(err.message);
    }
  }

  const copy = (text: string) => { navigator.clipboard?.writeText(text).then(() => setMsg('Copied to clipboard.')).catch(() => undefined); };

  return (
    <div className="adminPage">
      <div className="topbar">
        <div className="pageTitle">
          <span className="eyebrow">ORGANISATION ACCESS</span>
          <h1>Access Codes</h1>
          <p>Issue codes that unlock full access on a fixed number of devices. Redeeming a code is free for the recipient; collect payment out of band, or let the organisation buy seats in the direct app once Wave/APS is live.</p>
        </div>
      </div>
      {msg && <p className="notice" role="status">{msg}</p>}

      <div className="summaryGrid">
        <div className="summaryCard"><Ticket size={22} /><span><small>Codes</small><b>{totals.codes}</b></span></div>
        <div className="summaryCard"><Users size={22} /><span><small>Seats issued</small><b>{totals.seats}</b></span></div>
        <div className="summaryCard"><KeyRound size={22} /><span><small>Seats redeemed</small><b>{totals.redeemed}</b></span></div>
      </div>

      <section className="card">
        <h2>Seat pricing</h2>
        <p>Totals for purchased codes come from here — the client only picks a seat count. <code>tiers</code> maps a seat count to a fixed GMD price; any other size is priced at <code>custom_unit × seats</code> (min <code>custom_min_seats</code>, max <code>custom_max_seats</code>).</p>
        {pricing && (
          <p style={{ fontSize: 13, opacity: 0.8 }}>
            Current: {Object.entries(pricing.tiers || {}).map(([s, p]) => `${s}→D${p}`).join('  ·  ')}  ·  custom D{pricing.custom_unit}/device
          </p>
        )}
        <label>Pricing JSON
          <textarea className="input" rows={7} value={pricingDraft} onChange={(e) => setPricingDraft(e.target.value)} />
        </label>
        <div className="formActions">
          <button type="button" className="btn secondary" disabled={savingPricing} onClick={savePricing}>{savingPricing ? 'Saving…' : 'Save pricing'}</button>
        </div>
      </section>

      <section className="card">
        <h2>Generate codes</h2>
        <form onSubmit={generate}>
          <div className="formGrid">
            <label>Devices per code
              <input className="input" type="number" min={1} max={100000} step={1} value={seats} onChange={(e) => setSeats(e.target.value)} required />
              <span style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                {SEAT_PRESETS.map((n) => (
                  <button type="button" key={n} className={`btn compact ${Number(seats) === n ? '' : 'secondary'}`} onClick={() => setSeats(String(n))}>{n}</button>
                ))}
              </span>
            </label>
            <label>How many codes
              <input className="input" type="number" min={1} max={200} step={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
            </label>
            <label>Label (optional)
              <input className="input" maxLength={160} placeholder="e.g. Ministry of Health — batch 1" value={label} onChange={(e) => setLabel(e.target.value)} />
            </label>
            <label>Expires (optional)
              <input className="input" type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </label>
          </div>
          <div className="formActions">
            <button className="btn" disabled={busy}>{busy ? 'Generating…' : 'Generate codes'}</button>
          </div>
        </form>

        {lastGenerated.length > 0 && (
          <div className="notice" style={{ marginTop: 14, display: 'block' }}>
            <b>New codes — copy them now:</b>
            <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 6 }}>
              {lastGenerated.map((c) => (
                <li key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <code style={{ fontSize: 15 }}>{c.code}</code>
                  <span style={{ opacity: 0.7 }}>· {c.seats} devices</span>
                  <button type="button" className="btn compact secondary" onClick={() => copy(c.code)}><Copy size={12} /> Copy</button>
                </li>
              ))}
              <li>
                <button type="button" className="btn compact secondary" onClick={() => copy(lastGenerated.map((c) => c.code).join('\n'))}><Copy size={12} /> Copy all</button>
              </li>
            </ul>
          </div>
        )}
      </section>

      <section className="card dataCard">
        <div className="tableToolbar">
          <div><h2>All codes</h2><p>Purchased codes are minted automatically when an organisation payment succeeds.</p></div>
          <label className="searchBox"><Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search code, label, status" /></label>
        </div>
        <div className="tableWrap">
          <table>
            <thead><tr><th>Code</th><th>Label</th><th>Source</th><th>Seats</th><th>Status</th><th>Created</th><th>Action</th></tr></thead>
            <tbody>
              {filtered.map((c) => (
                <Fragment key={c.id}>
                  <tr>
                    <td><code>{c.code}</code></td>
                    <td>{c.label || <span style={{ opacity: 0.5 }}>—</span>}{c.paymentReference && <div style={{ fontSize: 11, opacity: 0.6 }}>{c.paymentReference}{c.paymentAmount != null ? ` · ${c.paymentAmount} ${c.paymentCurrency || ''}` : ''}</div>}</td>
                    <td>{c.source === 'purchase' ? 'Purchased' : 'Admin'}</td>
                    <td><button type="button" onClick={() => toggleRedemptions(c.id)} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: 0, font: 'inherit' }}><strong>{c.redeemedCount}</strong> / {c.seats}</button></td>
                    <td><span className={`statusBadge ${c.status === 'active' ? 'success' : c.status}`}>{c.status}</span></td>
                    <td>{new Date(c.createdAt).toLocaleDateString()}{c.expiresAt ? <div style={{ fontSize: 11, opacity: 0.6 }}>exp {new Date(c.expiresAt).toLocaleDateString()}</div> : null}</td>
                    <td>
                      {c.status === 'active'
                        ? <button className="btn compact danger" onClick={() => revoke(c.id)}><XCircle size={12} /> Revoke</button>
                        : <span className="completedLabel">—</span>}
                    </td>
                  </tr>
                  {openId === c.id && (
                    <tr key={`${c.id}-r`}>
                      <td colSpan={7} style={{ background: 'var(--surface)' }}>
                        {redemptions.length === 0
                          ? <span style={{ opacity: 0.6 }}>No devices have redeemed this code yet.</span>
                          : (
                            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 4 }}>
                              {redemptions.map((r) => (
                                <li key={r.device_id} style={{ fontSize: 12 }}>
                                  <code>{r.device_id.slice(0, 20)}…</code> · {r.device_status || 'unknown'} ({r.device_access_source || '—'}) · {new Date(r.redeemed_at).toLocaleString()}
                                </li>
                              ))}
                            </ul>
                          )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && <div className="emptyState"><Ticket size={28} /><b>No codes yet</b><span>Generate a batch above, or wait for the first organisation purchase.</span></div>}
      </section>
    </div>
  );
}

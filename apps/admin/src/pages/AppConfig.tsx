import { FormEvent, useEffect, useState } from 'react';
import { api } from '../api/client';

type Config = Record<string, unknown>;
const fields = [
  ['subscription_price', 'Contact Migration Pass price (GMD)', 'number', '100'],
  ['support_email', 'Support email', 'email', 'support@your-domain.gm'],
  ['support_phone', 'Support phone', 'tel', '+220 000 0000'],
  ['support_whatsapp', 'Support WhatsApp', 'tel', '+220 000 0000'],
  ['privacy_policy_url', 'Privacy policy URL', 'url', 'https://your-domain.gm/privacy'],
  ['terms_url', 'Terms URL', 'url', 'https://your-domain.gm/terms'],
  ['announcement_message', 'In-app announcement', 'text', 'Welcome to Gambia Number Migrator'],
] as const;

export default function AppConfig() {
  const [config, setConfig] = useState<Config>({});
  const [advanced, setAdvanced] = useState('{}');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [campaignStats, setCampaignStats] = useState<Record<string, number>>({});
  useEffect(() => {
    api<{data: Config}>('/app-config').then((r) => { setConfig(r.data); setAdvanced(JSON.stringify(r.data, null, 2)); });
    api<{data: Record<string, number>}>('/admin/free-access-stats').then((r) => setCampaignStats(r.data)).catch(() => undefined);
  }, []);
  function change(key: string, value: string, type?: string) { setConfig((current) => ({ ...current, [key]: type === 'number' ? Number(value) : value })); }
  async function submit(e: FormEvent) {
    e.preventDefault(); setSaving(true); setMsg('');
    try {
      const result = await api<{data: Config}>('/admin/app-config', { method: 'PUT', body: JSON.stringify(config) });
      setConfig(result.data); setAdvanced(JSON.stringify(result.data, null, 2));
      const stats = await api<{data: Record<string, number>}>('/admin/free-access-stats'); setCampaignStats(stats.data);
      setMsg('Live price and access settings published successfully.');
    }
    catch (err: any) { setMsg(err.message); }
    finally { setSaving(false); }
  }
  function applyAdvanced() { try { const next = JSON.parse(advanced); setConfig(next); setMsg('Advanced JSON applied. Select Save settings to publish it.'); } catch { setMsg('Advanced JSON is invalid.'); } }
  return <>
    <div className="topbar"><div className="pageTitle"><h1>App configuration</h1><p>Manage mobile pricing, support contacts, legal links and public app information.</p></div><span className="badge">Live mobile settings</span></div>
    {msg && <p className="notice" role="status">{msg}</p>}
    <form className="card" onSubmit={submit}>
      <h2>Pricing</h2>
      <div className="formGrid">{fields.map(([key, label, type, placeholder]) => <label key={key}>{label}<input className="input" type={type} min={type === 'number' ? 1 : undefined} step={type === 'number' ? 1 : undefined} placeholder={placeholder} value={String(config[key] ?? '')} onChange={(e) => change(key, e.target.value, type)} /></label>)}</div>
      <p className="configHint"><strong>Price scope:</strong> this amount is for the Contact Migration Pass only. Future products such as eSIMs should use separate product and price keys.</p>
      <p><small>Use full HTTPS links. WhatsApp numbers should include country code, for example +220.</small></p>
      <hr />
      <h2>Free-access campaign</h2>
      <p>Grant full migration access without payment. Existing promotional grants remain valid when the campaign is turned off.</p>
      <div className="formGrid">
        <label>Campaign mode
          <select value={String(config.free_access_mode || 'off')} onChange={(e) => change('free_access_mode', e.target.value)}>
            <option value="off">Paid access (campaign off)</option>
            <option value="first_n">First N users free</option>
            <option value="all">Free for everyone</option>
          </select>
        </label>
        <label>Number of free users
          <input className="input" type="number" min={1} max={1000000} step={1} value={String(config.free_access_user_limit ?? 100)} disabled={config.free_access_mode !== 'first_n'} onChange={(e) => change('free_access_user_limit', e.target.value, 'number')} />
        </label>
      </div>
      <div className="summaryGrid" style={{marginTop:16}}>
        <div className="summaryCard"><span><small>Promotional users</small><b>{campaignStats.promotional_users ?? 0}</b></span></div>
        <div className="summaryCard"><span><small>Places remaining</small><b>{config.free_access_mode === 'first_n' ? campaignStats.remaining_promotional_places ?? 0 : '—'}</b></span></div>
        <div className="summaryCard"><span><small>Paid users</small><b>{campaignStats.paid_users ?? 0}</b></span></div>
      </div>
      <p className="configHint"><strong>Recommended launch:</strong> choose “First N users free,” enter 100, then save. Places are assigned safely when a device registers.</p>
      <button className="btn" disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</button>
    </form>
    <details className="card"><summary><strong>Advanced configuration</strong></summary><p>Edit only when you understand the configuration keys. Invalid values may affect the mobile app.</p><textarea className="input" rows={16} value={advanced} onChange={(e) => setAdvanced(e.target.value)} /><div className="toolbar"><button type="button" className="btn secondary" onClick={applyAdvanced}>Apply JSON to form</button></div></details>
  </>;
}

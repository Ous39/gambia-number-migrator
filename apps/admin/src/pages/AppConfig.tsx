import { FormEvent, useEffect, useState } from 'react';
import { api } from '../api/client';

type Config = Record<string, unknown>;
const fields = [
  ['subscription_price', 'Contact Migration Pass price (GMD)', 'number', '25'],
  ['support_email', 'Support email', 'email', 'support@your-domain.gm'],
  ['support_phone', 'Support phone', 'tel', '+220 000 0000'],
  ['support_whatsapp', 'Support WhatsApp', 'tel', '+220 000 0000'],
  ['privacy_policy_url', 'Privacy policy URL', 'url', 'https://your-domain.gm/privacy'],
  ['terms_url', 'Terms URL', 'url', 'https://your-domain.gm/terms'],
  ['play_store_url', 'Google Play listing URL', 'url', 'https://play.google.com/store/apps/details?id=gm.oceanbrown.gnm'],
  ['app_store_url', 'Apple App Store listing URL', 'url', 'https://apps.apple.com/app/id0000000000'],
  ['announcement_message', 'In-app announcement', 'text', 'Welcome to Gambia Number Migrator'],
  ['rules_about_note', 'Rules & About note (Settings screen)', 'text', 'Optional extra note shown under Rules & About in the app. Leave blank to hide.'],
] as const;

function localDateTimeValue(value: unknown) {
  if (!value) return '';
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export default function AppConfig() {
  const [config, setConfig] = useState<Config>({});
  const [advanced, setAdvanced] = useState('{}');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [campaignStats, setCampaignStats] = useState<Record<string, number | string | null>>({});
  useEffect(() => {
    api<{data: Config}>('/app-config').then((r) => { setConfig(r.data); setAdvanced(JSON.stringify(r.data, null, 2)); }).catch((err: any) => setMsg(err.message)).finally(() => setLoading(false));
    api<{data: Record<string, number | string | null>}>('/admin/free-access-stats').then((r) => setCampaignStats(r.data)).catch(() => undefined);
  }, []);
  function change(key: string, value: string | boolean, type?: string) { setConfig((current) => ({ ...current, [key]: type === 'number' ? Number(value) : value })); }
  function changeSocial(platform: string, url: string) {
    setConfig((current) => ({ ...current, social_links: { ...((current.social_links as Record<string, string>) || {}), [platform]: url } }));
  }
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
  function applyAdvanced() { try { const next = JSON.parse(advanced); if (!next || Array.isArray(next) || typeof next !== 'object') throw new Error(); setConfig(next); setMsg('Advanced JSON applied. Select Save settings to publish it.'); } catch { setMsg('Advanced JSON must be a valid object.'); } }
  if (loading) return <div className="loadingState" role="status"><span aria-hidden="true"/>Loading application configuration…</div>;
  return <>
    <div className="topbar"><div className="pageTitle"><h1>App configuration</h1><p>Manage mobile pricing, support contacts, legal links and public app information.</p></div><span className="badge">Live mobile settings</span></div>
    {msg && <p className="notice" role="status">{msg}</p>}
    <form className="card" onSubmit={submit}>
      <h2>Pricing</h2>
      <div className="formGrid">{fields.map(([key, label, type, placeholder]) => <label key={key}>{label}<input className="input" type={type} min={type === 'number' ? 1 : undefined} step={type === 'number' ? 1 : undefined} placeholder={placeholder} value={String(config[key] ?? '')} onChange={(e) => change(key, e.target.value, type)} /></label>)}</div>
      <p className="configHint"><strong>Price scope:</strong> this amount is for the Contact Migration Pass only. Future products such as eSIMs should use separate product and price keys.</p>
      <p><small>Use full HTTPS links. WhatsApp numbers should include country code, for example +220.</small></p>
      <p className="configHint"><strong>Store links:</strong> set the Google Play / App Store URLs once the app is published. The website download buttons become active and open the store; leave blank to show “Coming soon”.</p>
      <hr />
      <h2>Social media links</h2>
      <p>Full HTTPS profile URLs. Each one you fill in shows as an icon in the website footer; leave blank to hide.</p>
      <div className="formGrid">
        {([
          ['facebook', 'Facebook', 'https://facebook.com/oceanbrown'],
          ['instagram', 'Instagram', 'https://instagram.com/oceanbrown'],
          ['x', 'X (Twitter)', 'https://x.com/oceanbrown'],
          ['linkedin', 'LinkedIn', 'https://linkedin.com/company/oceanbrown'],
          ['youtube', 'YouTube', 'https://youtube.com/@oceanbrown'],
          ['tiktok', 'TikTok', 'https://tiktok.com/@oceanbrown'],
          ['whatsapp', 'WhatsApp', 'https://wa.me/2203631776'],
        ] as const).map(([key, label, placeholder]) => (
          <label key={key}>{label}
            <input className="input" type="url" placeholder={placeholder}
              value={String((config.social_links as Record<string, string> | undefined)?.[key] ?? '')}
              onChange={(e) => changeSocial(key, e.target.value)} />
          </label>
        ))}
      </div>
      <hr />
      <h2>Approved payment wallets</h2>
      <p>Only enable a wallet after OceanBrown has a signed/confirmed arrangement, production credentials, approved callback rules and a successful end-to-end test. Disabled wallets are hidden from users and rejected by the API.</p>
      <div className="switchGrid">
        <label className="switchCard"><span><b>Wave</b><small>Show Wave as a payment option</small></span><input type="checkbox" checked={config.wave_payment_enabled === true} onChange={(e) => change('wave_payment_enabled', e.target.checked)} /><i aria-hidden="true"/></label>
        <label className="switchCard"><span><b>APS</b><small>Show APS as a payment option</small></span><input type="checkbox" checked={config.aps_payment_enabled === true} onChange={(e) => change('aps_payment_enabled', e.target.checked)} /><i aria-hidden="true"/></label>
      </div>
      <p className="configHint"><strong>Safe default:</strong> both wallets remain disabled until you approve them. If both are disabled, the mobile app displays “Payments coming soon.”</p>
      <hr />
      <h2>Duplicate cleanup availability</h2>
      <p>Control exactly when users may remove verified old-number duplicates. Cleanup remains backup-first and only removes an old number when its matching new number exists in the same contact.</p>
      <div className="switchGrid"><label className="switchCard"><span><b>Enable verified cleanup</b><small>Allow cleanup inside the optional schedule below</small></span><input type="checkbox" checked={config.cleanup_enabled === true} onChange={(e) => change('cleanup_enabled', e.target.checked)} /><i aria-hidden="true"/></label></div>
      <div className="formGrid">
        <label>Available from (optional)<input className="input" type="datetime-local" value={localDateTimeValue(config.cleanup_available_from)} onChange={(e) => change('cleanup_available_from', e.target.value ? new Date(e.target.value).toISOString() : '')} /></label>
        <label>Available until (optional)<input className="input" type="datetime-local" value={localDateTimeValue(config.cleanup_available_until)} onChange={(e) => change('cleanup_available_until', e.target.value ? new Date(e.target.value).toISOString() : '')} /></label>
      </div>
      <p className="configHint"><strong>Recommended:</strong> keep cleanup disabled during parallel running, then enable it after the official transition window.</p>
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
      <p className="configHint">
        <strong>Last changed:</strong>{' '}
        {campaignStats.configLastChangedAt
          ? `${new Date(String(campaignStats.configLastChangedAt)).toLocaleString()} by ${campaignStats.configLastChangedBy || 'an admin'}`
          : 'No configuration changes recorded yet.'}
      </p>
      <p className="configHint"><strong>Recommended launch:</strong> choose “First N users free,” enter 100, then save. Places are assigned safely when a device registers.</p>
      <button className="btn" disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</button>
    </form>
    <details className="card"><summary><strong>Advanced configuration</strong></summary><p>Edit only when you understand the configuration keys. Invalid values may affect the mobile app.</p><textarea className="input" rows={16} value={advanced} onChange={(e) => setAdvanced(e.target.value)} /><div className="toolbar"><button type="button" className="btn secondary" onClick={applyAdvanced}>Apply JSON to form</button></div></details>
  </>;
}

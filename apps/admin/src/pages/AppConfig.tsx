import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeDollarSign, LifeBuoy, MessageSquareText, ShieldCheck, Trash2, Sparkles, Code2 } from 'lucide-react';
import { api } from '../api/client';

type Config = Record<string, unknown>;

// Website-only keys are managed in Website Content, not here.
const WEB_ONLY_KEYS = ['play_store_url', 'app_store_url', 'social_links'];

const priceFields = [
  ['subscription_price', 'Contact Migration Pass price (GMD)', 'number', '25'],
] as const;
const supportFields = [
  ['support_email', 'Support email', 'email', 'support@your-domain.gm'],
  ['support_phone', 'Support phone', 'tel', '+220 000 0000'],
  ['support_whatsapp', 'Support WhatsApp', 'tel', '+220 000 0000'],
  ['privacy_policy_url', 'Privacy policy URL', 'url', 'https://your-domain.gm/privacy'],
  ['terms_url', 'Terms URL', 'url', 'https://your-domain.gm/terms'],
] as const;
const messageFields = [
  ['announcement_message', 'In-app announcement', 'text', 'Welcome to Gambia Number Migrator'],
  ['rules_about_note', 'Rules & About note (Settings screen)', 'text', 'Optional extra note shown under Rules & About in the app. Leave blank to hide.'],
  ['minimum_app_version', 'Minimum app version', 'text', '1.0.0'],
] as const;

function localDateTimeValue(value: unknown) {
  if (!value) return '';
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function SectionHead({ icon: Icon, title, children }: { icon: typeof BadgeDollarSign; title: string; children: ReactNode }) {
  return (
    <div className="cardHeader">
      <div className="cardIcon"><Icon size={20} aria-hidden="true" /></div>
      <div><h2>{title}</h2><p>{children}</p></div>
    </div>
  );
}

export default function AppConfig() {
  const [config, setConfig] = useState<Config>({});
  const [advanced, setAdvanced] = useState('{}');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [campaignStats, setCampaignStats] = useState<Record<string, number | string | null>>({});

  useEffect(() => {
    api<{ data: Config }>('/app-config').then((r) => { setConfig(r.data); setAdvanced(JSON.stringify(r.data, null, 2)); }).catch((err: any) => setMsg(err.message)).finally(() => setLoading(false));
    api<{ data: Record<string, number | string | null> }>('/admin/free-access-stats').then((r) => setCampaignStats(r.data)).catch(() => undefined);
  }, []);

  function change(key: string, value: string | boolean, type?: string) {
    setConfig((current) => ({ ...current, [key]: type === 'number' ? Number(value) : value }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault(); setSaving(true); setMsg('');
    try {
      // Never touch website-only keys from this page.
      const payload = Object.fromEntries(Object.entries(config).filter(([k]) => !WEB_ONLY_KEYS.includes(k)));
      const result = await api<{ data: Config }>('/admin/app-config', { method: 'PUT', body: JSON.stringify(payload) });
      setConfig((c) => ({ ...c, ...result.data }));
      setAdvanced(JSON.stringify(result.data, null, 2));
      const stats = await api<{ data: Record<string, number> }>('/admin/free-access-stats'); setCampaignStats(stats.data);
      setMsg('App settings published.');
    } catch (err: any) { setMsg(err.message); } finally { setSaving(false); }
  }

  function applyAdvanced() {
    try {
      const next = JSON.parse(advanced);
      if (!next || Array.isArray(next) || typeof next !== 'object') throw new Error();
      setConfig(next);
      setMsg('Advanced JSON applied. Select Save to publish it.');
    } catch { setMsg('Advanced JSON must be a valid object.'); }
  }

  const fieldInput = ([key, label, type, placeholder]: readonly [string, string, string, string]) => (
    <label key={key}>{label}
      <input
        className="input"
        type={type}
        min={type === 'number' ? 1 : undefined}
        step={type === 'number' ? 1 : undefined}
        placeholder={placeholder}
        value={String(config[key] ?? '')}
        onChange={(e) => change(key, e.target.value, type)}
      />
    </label>
  );

  if (loading) return <div className="loadingState" role="status"><span aria-hidden="true" />Loading application configuration…</div>;

  return (
    <div className="adminPage">
      <div className="topbar">
        <div className="pageTitle">
          <span className="eyebrow">MOBILE APP</span>
          <h1>App configuration</h1>
          <p>Settings for the GNM mobile app only. Website links, social media and public content live in <Link to="/website-content">Website Content</Link>.</p>
        </div>
        <span className="badge">Live mobile settings</span>
      </div>
      {msg && <p className="notice" role="status">{msg}</p>}

      <form onSubmit={submit}>
        <div className="card">
          <SectionHead icon={BadgeDollarSign} title="Pricing">The one-time Contact Migration Pass price. Future products (e.g. eSIMs) should use separate keys.</SectionHead>
          <div className="formGrid">{priceFields.map(fieldInput)}</div>
        </div>

        <div className="card">
          <SectionHead icon={LifeBuoy} title="Support & legal">Shown in the app's Settings screen (and reused on the website). Use full HTTPS links; include the country code on phone numbers.</SectionHead>
          <div className="formGrid">{supportFields.map(fieldInput)}</div>
        </div>

        <div className="card">
          <SectionHead icon={MessageSquareText} title="In-app messages">Text shown inside the app. Leave a field blank to hide it.</SectionHead>
          <div className="formGrid">{messageFields.map(fieldInput)}</div>
        </div>

        <div className="card">
          <SectionHead icon={ShieldCheck} title="Approved payment wallets">Enable a wallet only after a confirmed arrangement, production credentials and a successful end-to-end test. Disabled wallets are hidden and rejected by the API.</SectionHead>
          <div className="switchGrid">
            <label className="switchCard"><span><b>Wave</b><small>Show Wave as a payment option</small></span><input type="checkbox" checked={config.wave_payment_enabled === true} onChange={(e) => change('wave_payment_enabled', e.target.checked)} /><i aria-hidden="true" /></label>
            <label className="switchCard"><span><b>APS</b><small>Show APS as a payment option</small></span><input type="checkbox" checked={config.aps_payment_enabled === true} onChange={(e) => change('aps_payment_enabled', e.target.checked)} /><i aria-hidden="true" /></label>
          </div>
          <p className="configHint"><strong>Safe default:</strong> both stay disabled until approved. If both are off, the app shows “Payments coming soon.”</p>
        </div>

        <div className="card">
          <SectionHead icon={Trash2} title="Duplicate cleanup availability">Control when users may remove verified old-number duplicates. Cleanup is backup-first and only removes an old number when its matching new number exists in the same contact.</SectionHead>
          <div className="switchGrid"><label className="switchCard"><span><b>Enable verified cleanup</b><small>Allow cleanup inside the optional schedule below</small></span><input type="checkbox" checked={config.cleanup_enabled === true} onChange={(e) => change('cleanup_enabled', e.target.checked)} /><i aria-hidden="true" /></label></div>
          <div className="formGrid">
            <label>Available from (optional)<input className="input" type="datetime-local" value={localDateTimeValue(config.cleanup_available_from)} onChange={(e) => change('cleanup_available_from', e.target.value ? new Date(e.target.value).toISOString() : '')} /></label>
            <label>Available until (optional)<input className="input" type="datetime-local" value={localDateTimeValue(config.cleanup_available_until)} onChange={(e) => change('cleanup_available_until', e.target.value ? new Date(e.target.value).toISOString() : '')} /></label>
          </div>
          <p className="configHint"><strong>Recommended:</strong> keep cleanup disabled during parallel running, then enable it after the official transition window.</p>
        </div>

        <div className="card">
          <SectionHead icon={Sparkles} title="Free-access campaign">Grant full migration access without payment. Existing promotional grants stay valid when the campaign is turned off.</SectionHead>
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
          <div className="summaryGrid" style={{ marginTop: 16 }}>
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
        </div>

        <div className="formActions">
          <button className="btn" disabled={saving}>{saving ? 'Saving…' : 'Save app settings'}</button>
        </div>
      </form>

      <details className="card">
        <summary><MessageSquareText size={16} style={{ verticalAlign: '-3px', marginRight: 8 }} aria-hidden="true" /><strong>Advanced configuration</strong></summary>
        <p>Edit only when you understand the configuration keys. Invalid values may affect the mobile app. Website-only keys are ignored when saving from this page.</p>
        <label style={{ marginTop: 12 }}>Raw JSON<textarea className="input" rows={16} value={advanced} onChange={(e) => setAdvanced(e.target.value)} /></label>
        <div className="toolbar"><button type="button" className="btn secondary" onClick={applyAdvanced}><Code2 size={15} aria-hidden="true" /> Apply JSON to form</button></div>
      </details>
    </div>
  );
}

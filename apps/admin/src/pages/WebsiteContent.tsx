import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { HelpCircle, Link2, Megaphone, Share2, Timer, Users } from 'lucide-react';
import { api, resolveAssetUrl, uploadTeamPhoto } from '../api/client';

function toLocalInput(value: unknown) {
  if (!value) return '';
  const d = new Date(String(value));
  if (!Number.isFinite(d.getTime())) return '';
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

type Announcement = { id: string; title: string; body: string; status: 'draft' | 'published'; createdAt: string };
type Faq = { id: string; question: string; answer: string; sortOrder: number; active: boolean };
type TeamMember = { id: string; name: string; role: string; bio: string; initials: string; sortOrder: number; active: boolean; photoUrl?: string | null; longBio?: string | null; portfolioUrl?: string | null };
type Data = { announcements: Announcement[]; faqs: Faq[]; team: TeamMember[] };
type Tab = 'settings' | 'announcements' | 'faqs' | 'team';

const blankTeamForm = { name: '', role: '', initials: '', bio: '', longBio: '', portfolioUrl: '', sortOrder: 0, photoUrl: '' };

const SOCIALS = [
  ['facebook', 'Facebook', 'https://facebook.com/oceanbrown'],
  ['instagram', 'Instagram', 'https://instagram.com/oceanbrown'],
  ['x', 'X (Twitter)', 'https://x.com/oceanbrown'],
  ['linkedin', 'LinkedIn', 'https://linkedin.com/company/oceanbrown'],
  ['youtube', 'YouTube', 'https://youtube.com/@oceanbrown'],
  ['tiktok', 'TikTok', 'https://tiktok.com/@oceanbrown'],
  ['whatsapp', 'WhatsApp', 'https://wa.me/2203631776'],
] as const;

const TABS: Array<[Tab, string, typeof Link2]> = [
  ['settings', 'Links & social', Link2],
  ['announcements', 'Announcements', Megaphone],
  ['faqs', 'FAQs', HelpCircle],
  ['team', 'Team', Users],
];

export default function WebsiteContent() {
  const [data, setData] = useState<Data>({ announcements: [], faqs: [], team: [] });
  const [tab, setTab] = useState<Tab>('settings');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [teamForm, setTeamForm] = useState(blankTeamForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [site, setSite] = useState<{ play_store_url: string; app_store_url: string; social_links: Record<string, string>; countdown_enabled: boolean; countdown_target: string; countdown_label: string }>({ play_store_url: '', app_store_url: '', social_links: {}, countdown_enabled: false, countdown_target: '', countdown_label: '' });

  const load = () => api<{ data: Data }>('/admin/website-content').then((r) => setData(r.data));
  useEffect(() => {
    load().catch((e: any) => setMessage(e.message));
    api<{ data: Record<string, unknown> }>('/app-config').then((r) => {
      const c = r.data;
      setSite({
        play_store_url: String(c.play_store_url || ''),
        app_store_url: String(c.app_store_url || ''),
        social_links: (c.social_links && typeof c.social_links === 'object' ? c.social_links : {}) as Record<string, string>,
        countdown_enabled: c.countdown_enabled === true,
        countdown_target: toLocalInput(c.countdown_target),
        countdown_label: String(c.countdown_label || ''),
      });
    }).catch(() => undefined);
  }, []);

  async function saveSite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true); setMessage('');
    try {
      await api('/admin/app-config', { method: 'PUT', body: JSON.stringify({
        play_store_url: site.play_store_url.trim(),
        app_store_url: site.app_store_url.trim(),
        social_links: site.social_links,
        countdown_enabled: site.countdown_enabled,
        countdown_target: site.countdown_target ? new Date(site.countdown_target).toISOString() : '',
        countdown_label: site.countdown_label.trim(),
      }) });
      setMessage('Website settings saved.');
    } catch (err: any) { setMessage(err.message); } finally { setSaving(false); }
  }

  async function createAnnouncement(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true); setMessage('');
    const form = e.currentTarget;
    const body = Object.fromEntries(new FormData(form).entries());
    try { await api('/admin/website-content/announcements', { method: 'POST', body: JSON.stringify(body) }); form.reset(); setMessage('Announcement saved.'); await load(); }
    catch (err: any) { setMessage(err.message); } finally { setSaving(false); }
  }
  async function toggleAnnouncement(a: Announcement) {
    try { await api(`/admin/website-content/announcements/${a.id}`, { method: 'PATCH', body: JSON.stringify({ status: a.status === 'published' ? 'draft' : 'published' }) }); await load(); }
    catch (err: any) { setMessage(err.message); }
  }

  async function createFaq(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true); setMessage('');
    const form = e.currentTarget;
    const body = Object.fromEntries(new FormData(form).entries());
    try { await api('/admin/website-content/faqs', { method: 'POST', body: JSON.stringify(body) }); form.reset(); setMessage('FAQ added.'); await load(); }
    catch (err: any) { setMessage(err.message); } finally { setSaving(false); }
  }
  async function toggleFaq(f: Faq) {
    try { await api(`/admin/website-content/faqs/${f.id}`, { method: 'PATCH', body: JSON.stringify({ active: !f.active }) }); await load(); }
    catch (err: any) { setMessage(err.message); }
  }

  function editTeamMember(m: TeamMember) {
    setEditingId(m.id);
    setTeamForm({ name: m.name, role: m.role, initials: m.initials, bio: m.bio, longBio: m.longBio || '', portfolioUrl: m.portfolioUrl || '', sortOrder: m.sortOrder, photoUrl: m.photoUrl || '' });
    setTab('team');
  }
  function cancelTeamEdit() { setEditingId(null); setTeamForm(blankTeamForm); }

  async function onPhotoSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true); setMessage('');
    try { const { url } = await uploadTeamPhoto(file); setTeamForm((f) => ({ ...f, photoUrl: url })); }
    catch (err: any) { setMessage(err.message); }
    finally { setUploading(false); }
  }

  async function saveTeamMember(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true); setMessage('');
    try {
      if (editingId) {
        await api(`/admin/website-content/team/${editingId}`, { method: 'PUT', body: JSON.stringify(teamForm) });
        setMessage('Team member updated.');
      } else {
        await api('/admin/website-content/team', { method: 'POST', body: JSON.stringify(teamForm) });
        setMessage('Team member added.');
      }
      cancelTeamEdit();
      await load();
    } catch (err: any) { setMessage(err.message); } finally { setSaving(false); }
  }
  async function toggleTeamMember(m: TeamMember) {
    try { await api(`/admin/website-content/team/${m.id}`, { method: 'PATCH', body: JSON.stringify({ active: !m.active }) }); await load(); }
    catch (err: any) { setMessage(err.message); }
  }

  return (
    <div className="adminPage">
      <div className="topbar">
        <div className="pageTitle">
          <span className="eyebrow">PUBLIC WEBSITE</span>
          <h1>Website content</h1>
          <p>Everything shown on gnm.oceanbrown.gm — store &amp; social links, announcements, FAQs and the team page. App-only settings are in App configuration.</p>
        </div>
        <span className="badge">gnm.oceanbrown.gm</span>
      </div>
      {message && <p className="notice" role="status">{message}</p>}

      <div className="segmentTabs" role="tablist" aria-label="Website content sections">
        {TABS.map(([id, label, Icon]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            <Icon size={16} aria-hidden="true" /> <span>{label}</span>
          </button>
        ))}
      </div>

      {tab === 'settings' && (
        <form onSubmit={saveSite}>
          <div className="card">
            <div className="cardHeader">
              <div className="cardIcon"><Link2 size={20} aria-hidden="true" /></div>
              <div><h2>App store links</h2><p>Set once the app is published. The website download badges become clickable; leave blank to show “Coming soon”.</p></div>
            </div>
            <div className="formGrid">
              <label>Google Play listing URL
                <input className="input" type="url" placeholder="https://play.google.com/store/apps/details?id=gm.oceanbrown.gnm"
                  value={site.play_store_url} onChange={(e) => setSite((s) => ({ ...s, play_store_url: e.target.value }))} />
              </label>
              <label>Apple App Store listing URL
                <input className="input" type="url" placeholder="https://apps.apple.com/app/id0000000000"
                  value={site.app_store_url} onChange={(e) => setSite((s) => ({ ...s, app_store_url: e.target.value }))} />
              </label>
            </div>
          </div>

          <div className="card">
            <div className="cardHeader">
              <div className="cardIcon"><Share2 size={20} aria-hidden="true" /></div>
              <div><h2>Social media links</h2><p>Full HTTPS profile URLs. Each one you fill in shows as an icon in the website footer; leave blank to hide.</p></div>
            </div>
            <div className="formGrid">
              {SOCIALS.map(([key, label, placeholder]) => (
                <label key={key}>{label}
                  <input className="input" type="url" placeholder={placeholder}
                    value={site.social_links[key] ?? ''}
                    onChange={(e) => setSite((s) => ({ ...s, social_links: { ...s.social_links, [key]: e.target.value } }))} />
                </label>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="cardHeader">
              <div className="cardIcon"><Timer size={20} aria-hidden="true" /></div>
              <div><h2>Homepage countdown</h2><p>Show a live countdown in the website hero — e.g. to the start of parallel running. Hides automatically once the target passes.</p></div>
            </div>
            <label className="switchCard" style={{ maxWidth: 420 }}>
              <span><b>Show the countdown</b><small>Appears in the hero on gnm.oceanbrown.gm</small></span>
              <input type="checkbox" checked={site.countdown_enabled} onChange={(e) => setSite((s) => ({ ...s, countdown_enabled: e.target.checked }))} />
              <i aria-hidden="true" />
            </label>
            <div className="formGrid" style={{ marginTop: 14 }}>
              <label>Target date &amp; time
                <input className="input" type="datetime-local" value={site.countdown_target}
                  onChange={(e) => setSite((s) => ({ ...s, countdown_target: e.target.value }))} />
              </label>
              <label>Label
                <input className="input" type="text" maxLength={80} placeholder="Until PURA Phase 1 begins"
                  value={site.countdown_label} onChange={(e) => setSite((s) => ({ ...s, countdown_label: e.target.value }))} />
              </label>
            </div>
          </div>

          <div className="formActions"><button className="btn" disabled={saving}>{saving ? 'Saving…' : 'Save website settings'}</button></div>
        </form>
      )}

      {tab === 'announcements' && <div className="adminSplit">
        <form className="card" onSubmit={createAnnouncement}>
          <div className="cardHeader"><div className="cardIcon"><Megaphone size={20} aria-hidden="true" /></div><div><h2>New announcement</h2><p>Publish a release update or public notice to the website's Updates feed.</p></div></div>
          <label>Title<input className="input" name="title" maxLength={160} required /></label>
          <label>Summary (optional, shown in the list)<input className="input" name="summary" maxLength={280} /></label>
          <label>Message<textarea name="body" rows={6} maxLength={4000} required /></label>
          <label>Status<select name="status" defaultValue="draft"><option value="draft">Save as draft</option><option value="published">Publish now</option></select></label>
          <div className="toolbar"><button className="btn" disabled={saving}>{saving ? 'Saving…' : 'Save announcement'}</button></div>
        </form>
        <div className="card tableWrap">
          <h2>Announcements</h2>
          <table><thead><tr><th>Date</th><th>Title</th><th>Status</th><th>Control</th></tr></thead><tbody>
            {data.announcements.map((a) => <tr key={a.id}><td>{new Date(a.createdAt).toLocaleDateString()}</td><td><strong>{a.title}</strong><small className="cellNote">{a.body}</small></td><td><span className={`statusBadge ${a.status === 'published' ? 'active' : ''}`}>{a.status}</span></td><td><button type="button" className="btn compact secondary" onClick={() => toggleAnnouncement(a)}>{a.status === 'published' ? 'Unpublish' : 'Publish'}</button></td></tr>)}
          </tbody></table>
          {!data.announcements.length && <p>No announcements yet.</p>}
        </div>
      </div>}

      {tab === 'faqs' && <div className="adminSplit">
        <form className="card" onSubmit={createFaq}>
          <div className="cardHeader"><div className="cardIcon"><HelpCircle size={20} aria-hidden="true" /></div><div><h2>New FAQ</h2><p>Answers appear on the public FAQ section in display order.</p></div></div>
          <label>Question<input className="input" name="question" maxLength={300} required /></label>
          <label>Answer<textarea name="answer" rows={5} maxLength={2000} required /></label>
          <label>Display order<input className="input" name="sortOrder" type="number" min={0} defaultValue={0} /></label>
          <div className="toolbar"><button className="btn" disabled={saving}>{saving ? 'Saving…' : 'Add FAQ'}</button></div>
        </form>
        <div className="card tableWrap">
          <h2>FAQs</h2>
          <table><thead><tr><th>Order</th><th>Question</th><th>Status</th><th>Control</th></tr></thead><tbody>
            {data.faqs.map((f) => <tr key={f.id}><td>{f.sortOrder}</td><td><strong>{f.question}</strong><small className="cellNote">{f.answer}</small></td><td><span className={`statusBadge ${f.active ? 'active' : ''}`}>{f.active ? 'active' : 'hidden'}</span></td><td><button type="button" className="btn compact secondary" onClick={() => toggleFaq(f)}>{f.active ? 'Hide' : 'Show'}</button></td></tr>)}
          </tbody></table>
          {!data.faqs.length && <p>No FAQs yet.</p>}
        </div>
      </div>}

      {tab === 'team' && <div className="adminSplit">
        <form className="card" onSubmit={saveTeamMember}>
          <div className="cardHeader"><div className="cardIcon"><Users size={20} aria-hidden="true" /></div><div><h2>{editingId ? 'Edit team member' : 'New team member'}</h2><p>Introduce the young Gambian innovators behind GNM on the public website.</p></div></div>
          <label>Photo
            <div className="row" style={{ gap: 12, alignItems: 'center' }}>
              {teamForm.photoUrl
                ? <img src={resolveAssetUrl(teamForm.photoUrl)} alt="" width={56} height={56} style={{ borderRadius: 14, objectFit: 'cover' }} />
                : <span className="badge">{teamForm.initials || 'No photo'}</span>}
              <input className="input" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={onPhotoSelected} disabled={uploading} />
            </div>
            <small>{uploading ? 'Uploading…' : 'PNG, JPEG, WEBP or GIF, up to 3MB.'}</small>
          </label>
          <label>Full name<input className="input" value={teamForm.name} onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })} maxLength={120} required /></label>
          <label>Role<input className="input" value={teamForm.role} onChange={(e) => setTeamForm({ ...teamForm, role: e.target.value })} maxLength={120} required /></label>
          <label>Initials<input className="input" value={teamForm.initials} onChange={(e) => setTeamForm({ ...teamForm, initials: e.target.value })} maxLength={4} required /></label>
          <label>Short biography (shown on the team card)<textarea rows={3} value={teamForm.bio} onChange={(e) => setTeamForm({ ...teamForm, bio: e.target.value })} maxLength={1000} required /></label>
          <label>Full profile biography (optional — falls back to the short biography)<textarea rows={5} value={teamForm.longBio} onChange={(e) => setTeamForm({ ...teamForm, longBio: e.target.value })} maxLength={4000} /></label>
          <label>Portfolio or profile link (optional)<input className="input" type="url" placeholder="https://" value={teamForm.portfolioUrl} onChange={(e) => setTeamForm({ ...teamForm, portfolioUrl: e.target.value })} /></label>
          <label>Display order<input className="input" type="number" min={0} value={teamForm.sortOrder} onChange={(e) => setTeamForm({ ...teamForm, sortOrder: Number(e.target.value) })} /></label>
          <div className="toolbar">
            <button className="btn" disabled={saving || uploading}>{saving ? 'Saving…' : editingId ? 'Update team member' : 'Add team member'}</button>
            {editingId && <button type="button" className="btn secondary" onClick={cancelTeamEdit}>Cancel edit</button>}
          </div>
        </form>
        <div className="card tableWrap">
          <h2>Team</h2>
          <table><thead><tr><th>Order</th><th>Name</th><th>Status</th><th>Control</th></tr></thead><tbody>
            {data.team.map((m) => <tr key={m.id}>
              <td>{m.sortOrder}</td>
              <td>
                <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                  {m.photoUrl ? <img src={resolveAssetUrl(m.photoUrl)} alt="" width={36} height={36} style={{ borderRadius: 10, objectFit: 'cover' }} /> : <span className="badge">{m.initials}</span>}
                  <div><strong>{m.name}</strong><small className="cellNote">{m.role} — {m.bio}</small></div>
                </div>
              </td>
              <td><span className={`statusBadge ${m.active ? 'active' : ''}`}>{m.active ? 'shown' : 'hidden'}</span></td>
              <td><div className="row actionRow"><button type="button" className="btn compact secondary" onClick={() => editTeamMember(m)}>Edit</button><button type="button" className="btn compact secondary" onClick={() => toggleTeamMember(m)}>{m.active ? 'Hide' : 'Show'}</button></div></td>
            </tr>)}
          </tbody></table>
          {!data.team.length && <p>No team members yet.</p>}
        </div>
      </div>}
    </div>
  );
}

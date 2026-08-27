import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { api, resolveAssetUrl, uploadTeamPhoto } from '../api/client';

type Announcement = { id: string; title: string; body: string; status: 'draft' | 'published'; createdAt: string };
type Faq = { id: string; question: string; answer: string; sortOrder: number; active: boolean };
type TeamMember = { id: string; name: string; role: string; bio: string; initials: string; sortOrder: number; active: boolean; photoUrl?: string | null; longBio?: string | null; portfolioUrl?: string | null };
type Data = { announcements: Announcement[]; faqs: Faq[]; team: TeamMember[] };

const blankTeamForm = { name: '', role: '', initials: '', bio: '', longBio: '', portfolioUrl: '', sortOrder: 0, photoUrl: '' };

export default function WebsiteContent() {
  const [data, setData] = useState<Data>({ announcements: [], faqs: [], team: [] });
  const [tab, setTab] = useState<'announcements' | 'faqs' | 'team'>('announcements');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [teamForm, setTeamForm] = useState(blankTeamForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const load = () => api<{ data: Data }>('/admin/website-content').then((r) => setData(r.data));
  useEffect(() => { load().catch((e: any) => setMessage(e.message)); }, []);

  async function createAnnouncement(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true); setMessage('');
    const body = Object.fromEntries(new FormData(e.currentTarget).entries());
    try { await api('/admin/website-content/announcements', { method: 'POST', body: JSON.stringify(body) }); e.currentTarget.reset(); setMessage('Announcement saved.'); await load(); }
    catch (err: any) { setMessage(err.message); } finally { setSaving(false); }
  }
  async function toggleAnnouncement(a: Announcement) {
    try { await api(`/admin/website-content/announcements/${a.id}`, { method: 'PATCH', body: JSON.stringify({ status: a.status === 'published' ? 'draft' : 'published' }) }); await load(); }
    catch (err: any) { setMessage(err.message); }
  }

  async function createFaq(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true); setMessage('');
    const body = Object.fromEntries(new FormData(e.currentTarget).entries());
    try { await api('/admin/website-content/faqs', { method: 'POST', body: JSON.stringify(body) }); e.currentTarget.reset(); setMessage('FAQ added.'); await load(); }
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

  return <>
    <div className="topbar"><div className="pageTitle"><h1>Website content</h1><p>Manage announcements, FAQs and the public team page shown on gnm.oceanbrown.gm.</p></div><span className="badge">Public website</span></div>
    {message && <p className="notice" role="status">{message}</p>}
    <div className="row" style={{ gap: 8, marginBottom: 16 }}>
      {(['announcements', 'faqs', 'team'] as const).map((t) => (
        <button key={t} type="button" className={`btn compact ${tab === t ? '' : 'secondary'}`} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>
      ))}
    </div>

    {tab === 'announcements' && <div className="adminSplit">
      <form className="card" onSubmit={createAnnouncement}>
        <h2>New announcement</h2>
        <p>Publish a release update or public notice to the website's readiness centre.</p>
        <label>Title<input className="input" name="title" maxLength={160} required /></label>
        <label>Message<textarea name="body" rows={5} maxLength={2000} required /></label>
        <label>Status<select name="status" defaultValue="draft"><option value="draft">Save as draft</option><option value="published">Publish now</option></select></label>
        <div className="toolbar"><button className="btn" disabled={saving}>{saving ? 'Saving…' : 'Save announcement'}</button></div>
      </form>
      <div className="card tableWrap">
        <h2>Announcements</h2>
        <table><thead><tr><th>Date</th><th>Title</th><th>Status</th><th>Control</th></tr></thead><tbody>
          {data.announcements.map((a) => <tr key={a.id}><td>{new Date(a.createdAt).toLocaleDateString()}</td><td><strong>{a.title}</strong><small className="cellNote">{a.body}</small></td><td><span className="badge">{a.status}</span></td><td><button type="button" className="btn compact secondary" onClick={() => toggleAnnouncement(a)}>{a.status === 'published' ? 'Unpublish' : 'Publish'}</button></td></tr>)}
        </tbody></table>
        {!data.announcements.length && <p>No announcements yet.</p>}
      </div>
    </div>}

    {tab === 'faqs' && <div className="adminSplit">
      <form className="card" onSubmit={createFaq}>
        <h2>New FAQ</h2>
        <p>Answers appear on the public FAQ section in display-order.</p>
        <label>Question<input className="input" name="question" maxLength={300} required /></label>
        <label>Answer<textarea name="answer" rows={5} maxLength={2000} required /></label>
        <label>Display order<input className="input" name="sortOrder" type="number" min={0} defaultValue={0} /></label>
        <div className="toolbar"><button className="btn" disabled={saving}>{saving ? 'Saving…' : 'Add FAQ'}</button></div>
      </form>
      <div className="card tableWrap">
        <h2>FAQs</h2>
        <table><thead><tr><th>Order</th><th>Question</th><th>Status</th><th>Control</th></tr></thead><tbody>
          {data.faqs.map((f) => <tr key={f.id}><td>{f.sortOrder}</td><td><strong>{f.question}</strong><small className="cellNote">{f.answer}</small></td><td><span className="badge">{f.active ? 'active' : 'hidden'}</span></td><td><button type="button" className="btn compact secondary" onClick={() => toggleFaq(f)}>{f.active ? 'Hide' : 'Show'}</button></td></tr>)}
        </tbody></table>
        {!data.faqs.length && <p>No FAQs yet.</p>}
      </div>
    </div>}

    {tab === 'team' && <div className="adminSplit">
      <form className="card" onSubmit={saveTeamMember}>
        <h2>{editingId ? 'Edit team member' : 'New team member'}</h2>
        <p>Introduce the young Gambian innovators behind GNM on the public website.</p>
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
        <label>Full profile biography (shown on their "Read more" page; optional — falls back to the short biography)<textarea rows={5} value={teamForm.longBio} onChange={(e) => setTeamForm({ ...teamForm, longBio: e.target.value })} maxLength={4000} /></label>
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
            <td><span className="badge">{m.active ? 'shown' : 'hidden'}</span></td>
            <td><div className="row actionRow"><button type="button" className="btn compact secondary" onClick={() => editTeamMember(m)}>Edit</button><button type="button" className="btn compact secondary" onClick={() => toggleTeamMember(m)}>{m.active ? 'Hide' : 'Show'}</button></div></td>
          </tr>)}
        </tbody></table>
        {!data.team.length && <p>No team members yet.</p>}
      </div>
    </div>}
  </>;
}

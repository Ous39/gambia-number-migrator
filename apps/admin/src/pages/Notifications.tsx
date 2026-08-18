import { FormEvent, useEffect, useState } from 'react';
import { api } from '../api/client';

export default function Notifications() {
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState({ title: '', message: '', target: 'all', audience: 'all' });
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [previewPlatform, setPreviewPlatform] = useState<'android' | 'ios'>('android');
  const load = () => api<any>('/admin/notifications').then((r) => setItems(r.data));
  useEffect(() => { load().catch((e: any) => setMessage(e.message)); }, []);
  async function submit(e: FormEvent) {
    e.preventDefault(); setSending(true); setMessage('');
    try {
      const r = await api<any>('/admin/notifications', { method: 'POST', body: JSON.stringify(form) });
      setMessage(r.data.eligible_device_count === 0
        ? 'Notification saved, but no eligible registered devices were found. Open the installed app and allow notifications first.'
        : `Notification submitted to Expo Push. Accepted: ${r.data.sent_count}; failed immediately: ${r.data.failed_count}.`);
      setForm({ title: '', message: '', target: 'all', audience: 'all' }); await load();
    } catch (e: any) { setMessage(e.message); } finally { setSending(false); }
  }
  async function setEnabled(id: string, enabled: boolean) {
    setMessage('');
    try {
      await api(`/admin/notifications/${id}/enabled`, { method: 'PATCH', body: JSON.stringify({ enabled }) });
      setMessage(enabled ? 'Notification enabled.' : 'Notification disabled. Alerts already delivered to phones cannot be recalled.');
      await load();
    } catch (e: any) { setMessage(e.message); }
  }
  async function checkReceipts(id: string) {
    setMessage('Checking Expo delivery receipts…');
    try {
      const r = await api<any>(`/admin/notifications/${id}/check-receipts`, { method: 'POST' });
      setMessage(`Receipt check complete. Confirmed by push service: ${r.data.receipt_ok_count}; rejected later: ${r.data.receipt_failed_count}; still pending: ${r.data.pending_receipt_count}.`);
      await load();
    } catch (e: any) { setMessage(e.message); }
  }
  const delivered = items.reduce((n, x) => n + Number(x.sent_count || 0), 0);
  const failed = items.reduce((n, x) => n + Number(x.failed_count || 0), 0);
  return <>
    <div className="topbar"><div className="pageTitle"><h1>Push notifications</h1><p>Publish native device alerts and keep an in-app notification history.</p></div><span className="badge">Native push</span></div>
    {message && <p className="notice" role="status">{message}</p>}
    <div className="grid ruleMetrics"><div className="metric"><span>Messages</span><strong>{items.length}</strong></div><div className="metric"><span>Push accepted</span><strong>{delivered}</strong></div><div className="metric"><span>Failed</span><strong>{failed}</strong></div></div>
    <div className="adminSplit">
      <form className="card" onSubmit={submit}><h2>Create notification</h2><p>Choose the users and phone platform that should receive this message.</p><label>Title<input className="input" maxLength={80} required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /><small>{form.title.length}/80</small></label><div className="formGrid" style={{marginTop:16}}><label>User audience<select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}><option value="all">All eligible users</option><option value="trial">Users on free trial</option><option value="subscribed">Subscribed users</option></select></label><label>Platform<select value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })}><option value="all">Android and iOS</option><option value="android">Android only</option><option value="ios">iOS only</option></select></label></div><br /><label>Message<textarea rows={5} maxLength={500} required value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /><small>{form.message.length}/500</small></label><div className="toolbar"><button className="btn" disabled={sending}>{sending ? 'Sending…' : 'Publish notification'}</button></div></form>
      <div className="card notificationPreview"><div className="row" style={{justifyContent:'space-between'}}><h2>{previewPlatform === 'android' ? 'Android' : 'iOS'} preview</h2><div className="previewTabs"><button type="button" className={previewPlatform === 'android' ? 'active' : ''} onClick={() => setPreviewPlatform('android')}>Android</button><button type="button" className={previewPlatform === 'ios' ? 'active' : ''} onClick={() => setPreviewPlatform('ios')}>iOS</button></div></div><div className={`phoneNotification ${previewPlatform}`}><div className="notificationApp">Gambia Number Migrator <span>now</span></div><strong>{form.title || 'Notification title'}</strong><p>{form.message || 'Your notification message will appear here.'}</p></div><p><small>Final appearance depends on device settings. “Accepted” means Expo accepted the request, not that the user opened it.</small></p></div>
    </div>
    <div className="card tableWrap"><h2>Notification history</h2><table><thead><tr><th>Sent</th><th>Title</th><th>User audience</th><th>Platform</th><th>Accepted</th><th>Receipt OK</th><th>Failed</th><th>Status</th><th>Control</th></tr></thead><tbody>{items.map((n) => <tr key={n.id}><td>{new Date(n.sent_at || n.created_at).toLocaleString()}</td><td><strong>{n.title}</strong><small className="cellNote">{n.message}</small></td><td>{n.audience || 'all'}</td><td>{n.target}</td><td>{n.sent_count}</td><td>{n.receipt_ok_count || 0}</td><td>{Number(n.failed_count || 0) + Number(n.receipt_failed_count || 0)}</td><td><span className="badge">{n.enabled === false ? 'disabled' : n.status}</span></td><td><div className="row"><button type="button" className="btn compact secondary" onClick={() => checkReceipts(n.id)}>Check receipts</button><button type="button" className={`btn compact ${n.enabled === false ? 'secondary' : 'danger'}`} onClick={() => setEnabled(n.id, n.enabled === false)}>{n.enabled === false ? 'Enable' : 'Disable'}</button></div></td></tr>)}</tbody></table>{!items.length && <p>No notifications sent yet.</p>}</div>
  </>;
}

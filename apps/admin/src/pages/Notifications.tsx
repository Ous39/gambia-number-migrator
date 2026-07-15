import { FormEvent, useEffect, useState } from 'react';
import { api } from '../api/client';

export default function Notifications() {
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState({ title: '', message: '', target: 'all' });
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const load = () => api<any>('/admin/notifications').then((r) => setItems(r.data));
  useEffect(() => { load().catch((e: any) => setMessage(e.message)); }, []);
  async function submit(e: FormEvent) {
    e.preventDefault(); setSending(true); setMessage('');
    try {
      const r = await api<any>('/admin/notifications', { method: 'POST', body: JSON.stringify(form) });
      setMessage(`Notification published. Push accepted: ${r.data.sent_count}; failed: ${r.data.failed_count}.`);
      setForm({ title: '', message: '', target: 'all' }); await load();
    } catch (e: any) { setMessage(e.message); } finally { setSending(false); }
  }
  const delivered = items.reduce((n, x) => n + Number(x.sent_count || 0), 0);
  const failed = items.reduce((n, x) => n + Number(x.failed_count || 0), 0);
  return <>
    <div className="topbar"><div className="pageTitle"><h1>Push notifications</h1><p>Publish native device alerts and keep an in-app notification history.</p></div><span className="badge">Native push</span></div>
    {message && <p className="notice" role="status">{message}</p>}
    <div className="grid ruleMetrics"><div className="metric"><span>Messages</span><strong>{items.length}</strong></div><div className="metric"><span>Push accepted</span><strong>{delivered}</strong></div><div className="metric"><span>Failed</span><strong>{failed}</strong></div></div>
    <div className="adminSplit">
      <form className="card" onSubmit={submit}><h2>Create notification</h2><p>Keep the title short so Android can display it clearly.</p><div className="formGrid"><label>Title<input className="input" maxLength={80} required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /><small>{form.title.length}/80</small></label><label>Audience<select value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })}><option value="all">All devices</option><option value="android">Android only</option><option value="ios">iOS only</option></select></label></div><br /><label>Message<textarea rows={5} maxLength={500} required value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /><small>{form.message.length}/500</small></label><div className="toolbar"><button className="btn" disabled={sending}>{sending ? 'Sending…' : 'Publish notification'}</button></div></form>
      <div className="card notificationPreview"><h2>Android preview</h2><div className="phoneNotification"><div className="notificationApp">Gambia Number Migrator <span>now</span></div><strong>{form.title || 'Notification title'}</strong><p>{form.message || 'Your notification message will appear here.'}</p></div><p><small>Production appearance varies by Android version and the user’s notification settings.</small></p></div>
    </div>
    <div className="card tableWrap"><h2>Notification history</h2><table><thead><tr><th>Sent</th><th>Title</th><th>Audience</th><th>Push sent</th><th>Failed</th><th>Status</th></tr></thead><tbody>{items.map((n) => <tr key={n.id}><td>{new Date(n.sent_at || n.created_at).toLocaleString()}</td><td><strong>{n.title}</strong><small className="cellNote">{n.message}</small></td><td>{n.target}</td><td>{n.sent_count}</td><td>{n.failed_count}</td><td><span className="badge">{n.status}</span></td></tr>)}</tbody></table>{!items.length && <p>No notifications sent yet.</p>}</div>
  </>;
}

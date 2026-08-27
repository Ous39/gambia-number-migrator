import { useEffect, useState } from 'react';
import { api } from '../api/client';

type Inquiry = { id: string; name: string; email: string; category: string; message: string; status: 'new' | 'resolved'; createdAt: string };

const categoryLabels: Record<string, string> = { general: 'General support', technical: 'Technical issue', organisation: 'Business / institution', partnership: 'Partnership / media', privacy: 'Privacy request' };

export default function Inquiries() {
  const [items, setItems] = useState<Inquiry[]>([]);
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState<'all' | 'new' | 'resolved'>('new');
  const load = () => api<{ data: Inquiry[] }>('/admin/inquiries').then((r) => setItems(r.data));
  useEffect(() => { load().catch((e: any) => setMessage(e.message)); }, []);

  async function setStatus(id: string, status: 'new' | 'resolved') {
    setMessage('');
    try { await api(`/admin/inquiries/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }); await load(); }
    catch (err: any) { setMessage(err.message); }
  }

  const filtered = items.filter((i) => filter === 'all' || i.status === filter);
  const newCount = items.filter((i) => i.status === 'new').length;

  return <>
    <div className="topbar"><div className="pageTitle"><h1>Website enquiries</h1><p>Review messages submitted through the public website's contact form.</p></div><span className="badge">{newCount} new</span></div>
    {message && <p className="notice" role="status">{message}</p>}
    <div className="grid ruleMetrics"><div className="metric"><span>Total enquiries</span><strong>{items.length}</strong></div><div className="metric"><span>New</span><strong>{newCount}</strong></div><div className="metric"><span>Resolved</span><strong>{items.length - newCount}</strong></div></div>
    <div className="row" style={{ gap: 8, marginBottom: 16 }}>
      {(['new', 'resolved', 'all'] as const).map((f) => (
        <button key={f} type="button" className={`btn compact ${filter === f ? '' : 'secondary'}`} onClick={() => setFilter(f)}>{f[0].toUpperCase() + f.slice(1)}</button>
      ))}
    </div>
    <div className="card tableWrap">
      <h2>Enquiries</h2>
      <table><thead><tr><th>Received</th><th>From</th><th>Category</th><th>Message</th><th>Status</th><th>Control</th></tr></thead><tbody>
        {filtered.map((i) => <tr key={i.id}>
          <td>{new Date(i.createdAt).toLocaleString()}</td>
          <td><strong>{i.name}</strong><small className="cellNote">{i.email}</small></td>
          <td>{categoryLabels[i.category] || i.category}</td>
          <td><small className="cellNote">{i.message}</small></td>
          <td><span className="badge">{i.status}</span></td>
          <td>{i.status === 'new'
            ? <button type="button" className="btn compact secondary" onClick={() => setStatus(i.id, 'resolved')}>Mark resolved</button>
            : <button type="button" className="btn compact secondary" onClick={() => setStatus(i.id, 'new')}>Reopen</button>}
          </td>
        </tr>)}
      </tbody></table>
      {!filtered.length && <p>No {filter === 'all' ? '' : filter} enquiries.</p>}
    </div>
  </>;
}

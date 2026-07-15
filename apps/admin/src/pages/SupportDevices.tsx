import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';

export default function SupportDevices() {
  const [items, setItems] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const load = () => api<any>('/admin/devices').then((r) => setItems(r.data));
  useEffect(() => { load().catch((e: any) => setMessage(e.message)); }, []);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((x) => `${x.supportCode} ${x.deviceName} ${x.deviceModel} ${x.platform} ${x.osName} ${x.paymentReference} ${x.lastIp}`.toLowerCase().includes(q));
  }, [items, query]);
  async function changeStatus(id: string, action: 'block' | 'unblock') {
    try { await api(`/admin/devices/${encodeURIComponent(id)}/${action}`, { method: 'POST' }); setMessage(action === 'block' ? 'Device blocked.' : 'Device returned to trial access.'); await load(); }
    catch (e: any) { setMessage(e.message); }
  }
  async function restorePaidAccess(id: string) {
    try { await api(`/admin/devices/${encodeURIComponent(id)}/restore-paid-access`, { method: 'POST' }); setMessage('Paid Contact Migration Pass access restored.'); await load(); }
    catch (e: any) { setMessage(e.message); }
  }
  return <>
    <div className="topbar"><div className="pageTitle"><h1>Support devices</h1><p>Resolve payment and access problems using the support code shared by the user.</p></div><span className="badge">No contacts stored</span></div>
    {message && <p className="notice" role="status">{message}</p>}
    <div className="card"><label>Find support record<input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Support code, payment reference, model or IP address" /></label><p><small>Only use this information for fraud prevention, payment recovery and user-requested support.</small></p></div>
    <div className="card tableWrap">
      <table><thead><tr><th>Support</th><th>Device</th><th>App / OS</th><th>Access</th><th>Latest payment</th><th>Network / seen</th><th>Action</th></tr></thead>
        <tbody>{filtered.map((x) => <tr key={x.id}>
          <td><strong>{x.supportCode}</strong></td>
          <td>{x.deviceName || x.deviceModel || 'Unknown'}<small className="cellNote">{x.platform || 'unknown platform'}</small></td>
          <td>{x.appVersion || 'Unknown app'}<small className="cellNote">{x.osName || x.platform} {x.osVersion}</small></td>
          <td><span className="badge">{x.status}</span><small className="cellNote">Trial used: {x.trialContactsUsed || 0}</small></td>
          <td>{x.paymentStatus ? <><strong>{x.paymentStatus}</strong><small className="cellNote">{x.paymentProvider} · {x.paymentAmount} {x.paymentCurrency}<br />{x.paymentReference}</small></> : 'No payment'}</td>
          <td>{x.lastIp || 'Unavailable'}<small className="cellNote">{new Date(x.updatedAt).toLocaleString()}</small></td>
          <td><div className="actionStack">{x.paymentStatus === 'success' && x.status !== 'active' && x.status !== 'blocked' ? <button className="btn" onClick={() => restorePaidAccess(x.id)}>Restore access</button> : null}{x.status === 'blocked' ? <button className="btn secondary" onClick={() => changeStatus(x.id, 'unblock')}>Unblock</button> : <button className="btn danger" onClick={() => changeStatus(x.id, 'block')}>Block</button>}</div></td>
        </tr>)}</tbody>
      </table>{!filtered.length && <p>No matching support record.</p>}
    </div>
  </>;
}

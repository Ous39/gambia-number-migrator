import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Bell, CalendarRange, CreditCard, FileClock, LayoutDashboard, LifeBuoy, LogOut, Moon, Network, RadioTower, Settings, Sun, Users, type LucideIcon } from 'lucide-react';
import { API_BASE_URL, clearToken, getAdmin } from '../api/client';

export default function Layout() {
  const navigate = useNavigate();
  const admin = getAdmin();
  const [theme, setTheme] = useState(() => localStorage.getItem('gnm_admin_theme') || 'light');
  useEffect(() => {
    document.body.classList.toggle('light', theme === 'light');
    localStorage.setItem('gnm_admin_theme', theme);
  }, [theme]);
  useEffect(() => {
    const handler = () => navigate('/login', { replace: true });
    window.addEventListener('gnm-auth-expired', handler);
    return () => window.removeEventListener('gnm-auth-expired', handler);
  }, [navigate]);
  const logout = () => { clearToken(); navigate('/login'); };
  const links: Array<[string, string, LucideIcon]> = [
    ['/', 'Dashboard', LayoutDashboard],
    ['/operators', 'Operators', RadioTower],
    ['/rules', 'Migration Rules', Network],
    ['/transition', 'Transition', CalendarRange],
    ['/payments', 'Payments', CreditCard],
    ['/support-devices', 'Support Devices', LifeBuoy],
    ['/notifications', 'Notifications', Bell],
    ['/app-config', 'App Config', Settings],
    ['/audit', 'Audit Logs', FileClock],
    ...(getAdmin()?.role==='owner' ? [['/team', 'Team Access', Users] as [string,string,LucideIcon]] : []),
  ];
  return (
    <div className="appShell">
      <aside className="sidebar">
        <div className="logo"><div className="logoMark">GN</div><span>Gambia Number<small>Migration Console</small></span></div>
        <nav className="nav">{links.map(([to, label, Icon]) => <NavLink key={String(to)} to={String(to)}><Icon size={19}/> <span>{String(label)}</span></NavLink>)}</nav>
        <div className="sideHelp">
          <div className="adminIdentity"><div>{(admin?.fullName||admin?.username||'A').slice(0,1).toUpperCase()}</div><span><b>{admin?.fullName||admin?.username||'Administrator'}</b><small>{admin?.role||'admin'} account</small></span></div>
          <button className="themeToggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={18}/> : <Moon size={18}/>} {theme === 'dark' ? 'Light mode' : 'Dark mode'}</button>
          <button className="btn secondary" onClick={logout}><LogOut size={18}/> Logout</button>
          <small className="oceanCredit">Powered by OceanBrown</small>
          <small className="apiStatus">API · {API_BASE_URL.replace(/^https?:\/\//,'')}</small>
        </div>
      </aside>
      <main className="main"><Outlet /></main>
    </div>
  );
}

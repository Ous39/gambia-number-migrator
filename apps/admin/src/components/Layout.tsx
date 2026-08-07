import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Bell, CalendarRange, CreditCard, FileClock, LayoutDashboard, LifeBuoy, LogOut, Menu, Moon, Network, RadioTower, Settings, Sun, Users, X, type LucideIcon } from 'lucide-react';
import { API_BASE_URL, clearToken, getAdmin } from '../api/client';

export default function Layout() {
  const navigate = useNavigate();
  const admin = getAdmin();
  const [theme, setTheme] = useState(() => localStorage.getItem('gnm_admin_theme') || 'light');
  const [menuOpen, setMenuOpen] = useState(false);
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
      {menuOpen && <button className="menuBackdrop" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar ${menuOpen ? 'menuOpen' : ''}`}>
        <div className="logo"><div className="logoMark">GN</div><span>Gambia Number<small>Admin Console · v2.8.5</small></span><button className="mobileClose" aria-label="Close menu" onClick={() => setMenuOpen(false)}><X size={20}/></button></div>
        <nav className="nav" aria-label="Administration sections">{links.map(([to, label, Icon]) => <NavLink key={String(to)} to={String(to)} onClick={() => setMenuOpen(false)}><Icon aria-hidden="true" size={19}/> <span>{String(label)}</span></NavLink>)}</nav>
        <div className="sideHelp">
          <small className="oceanCredit">Powered by OceanBrown</small>
          <small className="apiStatus">API · {API_BASE_URL.replace(/^https?:\/\//,'')}</small>
        </div>
      </aside>
      <div className="adminWorkspace">
        <header className="adminNavbar">
          <button className="mobileMenu" aria-label="Open navigation" onClick={() => setMenuOpen(true)}><Menu size={21}/></button>
          <div className="navbarIdentity"><div>{(admin?.fullName||admin?.username||'A').slice(0,1).toUpperCase()}</div><span><b>{admin?.fullName||admin?.username||'Administrator'}</b><small>{admin?.role === 'owner' ? 'System Owner' : `${admin?.role||'admin'} account`}</small></span></div>
          <div className="navbarActions">
            <button type="button" className="navbarButton" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}<span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span></button>
            <button type="button" className="navbarButton logoutButton" onClick={logout}><LogOut size={18}/><span>Logout</span></button>
          </div>
        </header>
        <main className="main"><Outlet /></main>
      </div>
    </div>
  );
}

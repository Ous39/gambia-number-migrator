import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Bell, CalendarRange, CreditCard, FileClock, Globe, LayoutDashboard, LifeBuoy, LogOut, Mail, Menu, Moon, Network, RadioTower, Settings, Sun, Ticket, Users, X, type LucideIcon } from 'lucide-react';
import { API_BASE_URL, clearToken, getAdmin } from '../api/client';

// Mirrors apps/api/src/middleware/auth.ts `roleAreas` so a role only ever sees
// navigation links it is actually authorized to open. The API still enforces
// this independently; this filtering is a usability layer, not the security boundary.
export const navAreasByRole: Record<string, string[]> = {
  owner: ['*'], admin: ['*'], viewer: ['*'],
  operations: ['/', '/operators', '/rules', '/transition', '/notifications', '/app-config'],
  finance: ['/', '/payments', '/access-codes'],
  support: ['/', '/support-devices', '/notifications'],
  communications: ['/', '/website-content', '/inquiries', '/notifications'],
};

export function allowedNavPaths(role: string | undefined, paths: string[]): string[] {
  const allowed = navAreasByRole[role || ''] || navAreasByRole.viewer;
  if (allowed.includes('*')) return paths;
  return paths.filter((path) => allowed.includes(path));
}

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
  const allLinks: Array<[string, string, LucideIcon]> = [
    ['/', 'Dashboard', LayoutDashboard],
    ['/operators', 'Operators', RadioTower],
    ['/rules', 'Migration Rules', Network],
    ['/transition', 'Transition', CalendarRange],
    ['/payments', 'Payments', CreditCard],
    ['/access-codes', 'Access Codes', Ticket],
    ['/support-devices', 'Support Devices', LifeBuoy],
    ['/notifications', 'Notifications', Bell],
    ['/website-content', 'Website Content', Globe],
    ['/inquiries', 'Enquiries', Mail],
    ['/app-config', 'App Config', Settings],
    ['/audit', 'Audit Logs', FileClock],
    ...(admin?.role==='owner' ? [['/team', 'Team Access', Users] as [string,string,LucideIcon]] : []),
  ];
  const visiblePaths = new Set(allowedNavPaths(admin?.role, allLinks.map(([to]) => to)));
  const links = allLinks.filter(([to]) => visiblePaths.has(to));
  return (
    <div className="appShell">
      {menuOpen && <button className="menuBackdrop" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar ${menuOpen ? 'menuOpen' : ''}`}>
        <div className="logo"><div className="logoMark">GNM</div><span>Gambia Number Migrator<small>Admin Console · v2.10.0</small></span><button className="mobileClose" aria-label="Close menu" onClick={() => setMenuOpen(false)}><X size={20}/></button></div>
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

import { Navigate, Route, Routes } from 'react-router-dom';
import { getToken } from './api/client';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Operators from './pages/Operators';
import Rules from './pages/Rules';
import Transition from './pages/Transition';
import Payments from './pages/Payments';
import AppConfig from './pages/AppConfig';
import Audit from './pages/Audit';
import Notifications from './pages/Notifications';
import SupportDevices from './pages/SupportDevices';
import Team from './pages/Team';
import WebsiteContent from './pages/WebsiteContent';
import Inquiries from './pages/Inquiries';

function Protected() { return getToken() ? <Layout /> : <Navigate to="/login" replace />; }
export default function App() {
  return <Routes>
    <Route path="/login" element={<Login />} />
    <Route element={<Protected />}>
      <Route path="/" element={<Dashboard />} />
      <Route path="/operators" element={<Operators />} />
      <Route path="/rules" element={<Rules />} />
      <Route path="/transition" element={<Transition />} />
      <Route path="/payments" element={<Payments />} />
      <Route path="/notifications" element={<Notifications />} />
      <Route path="/support-devices" element={<SupportDevices />} />
      <Route path="/app-config" element={<AppConfig />} />
      <Route path="/website-content" element={<WebsiteContent />} />
      <Route path="/inquiries" element={<Inquiries />} />
      <Route path="/audit" element={<Audit />} />
      <Route path="/team" element={<Team />} />
    </Route>
  </Routes>;
}

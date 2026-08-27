import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import Support from './pages/Support';
import Contact from './pages/Contact';
import Organisations from './pages/Organisations';
import Status from './pages/Status';
import Updates from './pages/Updates';
import UpdatePost from './pages/UpdatePost';
import TeamProfile from './pages/TeamProfile';
import DataDeletion from './pages/DataDeletion';

function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) { el.scrollIntoView({ behavior: 'smooth' }); return; }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollManager />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/status" element={<Status />} />
        <Route path="/updates" element={<Updates />} />
        <Route path="/updates/:slug" element={<UpdatePost />} />
        <Route path="/organisations" element={<Organisations />} />
        <Route path="/support" element={<Support />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/data-deletion" element={<DataDeletion />} />
        <Route path="/team/:id" element={<TeamProfile />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </>
  );
}

import { Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import Support from './pages/Support';
import Contact from './pages/Contact';
import TeamProfile from './pages/TeamProfile';
import DataDeletion from './pages/DataDeletion';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/support" element={<Support />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/team/:id" element={<TeamProfile />} />
      <Route path="/data-deletion" element={<DataDeletion />} />
    </Routes>
  );
}

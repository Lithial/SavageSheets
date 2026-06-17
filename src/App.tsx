import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { RosterPage } from './pages/RosterPage';
import { SheetPage } from './pages/SheetPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RosterPage />} />
        <Route path="/c/:id" element={<SheetPage />} />
      </Routes>
    </BrowserRouter>
  );
}

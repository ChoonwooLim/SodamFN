import { BrowserRouter, Routes, Route } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import Dashboard from './pages/Dashboard';
import CameraPage from './pages/Camera';
import ExpenseConfirm from './pages/ExpenseConfirm';
import VendorSettings from './pages/VendorSettings';
import StaffPage from './pages/Staff';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 pb-20 font-sans text-gray-900">
        <div className="max-w-md mx-auto min-h-screen bg-white shadow-xl relative">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/camera" element={<CameraPage />} />
            <Route path="/confirm" element={<ExpenseConfirm />} />
            <Route path="/settings" element={<VendorSettings />} />
            <Route path="/staff" element={<StaffPage />} />
          </Routes>
          <BottomNav />
        </div>
      </div>
    </BrowserRouter>
  );
}

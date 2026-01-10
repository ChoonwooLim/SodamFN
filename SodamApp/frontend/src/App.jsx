import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import ExpenseConfirm from './pages/ExpenseConfirm';
import VendorSettings from './pages/VendorSettings';
import StaffPage from './pages/Staff';
import StaffDetail from './pages/StaffDetail';
import DataInputPage from './pages/DataInputPage';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50 flex">
        {/* Desktop Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <div className="flex-1 md:ml-64 relative min-h-screen">
          <Routes>
            <Route path="/" element={<Dashboard />} />

            {/* Split Input Routes */}
            <Route path="/input/revenue" element={<DataInputPage mode="revenue" />} />
            <Route path="/input/expense" element={<DataInputPage mode="expense" />} />

            {/* Backward compatibility / Redirection */}
            <Route path="/camera" element={<DataInputPage mode="expense" />} />

            <Route path="/confirm" element={<ExpenseConfirm />} />
            <Route path="/settings" element={<VendorSettings />} />
            <Route path="/staff" element={<StaffPage />} />
            <Route path="/staff/:id" element={<StaffDetail />} />
          </Routes>

          {/* Mobile Bottom Navigation - Only visible on small screens */}
          <div className="md:hidden">
            <BottomNav />
          </div>
        </div>
      </div>
    </BrowserRouter>
  );
}

import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import ExpenseConfirm from './pages/ExpenseConfirm';
import VendorSettings from './pages/VendorSettings'; // Keeping this for now if referenced elsewhere
import Settings from './pages/Settings';
import StaffPage from './pages/Staff';
import StaffDetail from './pages/StaffDetail';
import DataInputPage from './pages/DataInputPage';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';
import LoginPage from './pages/Login';
import ContractMyPage from './pages/ContractMy';
import ContractSignPage from './pages/ContractSign';
import SignupPage from './pages/Signup';
import StaffDashboard from './pages/StaffDashboard';
import CardSales from './pages/CardSales';
import ProfitLoss from './pages/ProfitLoss';

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('user_role');

  if (!token) return <Navigate to="/login" replace />;

  if (adminOnly && role !== 'admin') {
    return <Navigate to="/staff-dashboard" replace />;
  }

  return children;
};

const Layout = ({ children }) => {
  // Use location to trigger re-render on route change
  // eslint-disable-next-line no-unused-vars
  const location = useLocation();
  const role = localStorage.getItem('user_role');
  const isAdmin = role === 'admin';
  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup';

  if (isAuthPage) {
    return <div className="min-h-screen bg-slate-50">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Render Sidebar for Admin (Reactive) */}
      {isAdmin && <Sidebar />}

      {/* Main Content Area */}
      <div className={`flex-1 relative min-h-screen ${isAdmin ? 'md:ml-64' : ''}`}>
        {children}

        {/* Mobile Bottom Navigation - Only visible on small screens for Admin */}
        {isAdmin && (
          <div className="md:hidden">
            <BottomNav />
          </div>
        )}
      </div>
    </div>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          <Route path="/" element={<ProtectedRoute adminOnly><Dashboard /></ProtectedRoute>} />

          {/* SPLIT INPUT ROUTES */}
          <Route path="/input/revenue" element={<ProtectedRoute adminOnly><DataInputPage mode="revenue" /></ProtectedRoute>} />
          <Route path="/input/expense" element={<ProtectedRoute adminOnly><DataInputPage mode="expense" /></ProtectedRoute>} />

          {/* FINANCE */}
          <Route path="/finance/card-sales" element={<ProtectedRoute adminOnly><CardSales /></ProtectedRoute>} />
          <Route path="/finance/profitloss" element={<ProtectedRoute adminOnly><ProfitLoss /></ProtectedRoute>} />

          {/* BACKWARD COMPATIBILITY */}
          <Route path="/camera" element={<ProtectedRoute adminOnly><DataInputPage mode="expense" /></ProtectedRoute>} />

          <Route path="/confirm" element={<ProtectedRoute adminOnly><ExpenseConfirm /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute adminOnly><Settings /></ProtectedRoute>} />
          <Route path="/vendor-settings" element={<ProtectedRoute adminOnly><VendorSettings /></ProtectedRoute>} />
          <Route path="/staff" element={<ProtectedRoute adminOnly><StaffPage /></ProtectedRoute>} />
          <Route path="/staff/:id" element={<ProtectedRoute adminOnly><StaffDetail /></ProtectedRoute>} />

          {/* STAFF ROUTES */}
          <Route path="/staff-dashboard" element={<ProtectedRoute><StaffDashboard /></ProtectedRoute>} />
          <Route path="/contracts/my" element={<ProtectedRoute><ContractMyPage /></ProtectedRoute>} />
          <Route path="/contracts/:id/sign" element={<ProtectedRoute><ContractSignPage /></ProtectedRoute>} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

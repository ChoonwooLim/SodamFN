import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';

// Lazy Load Pages
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const ExpenseConfirm = React.lazy(() => import('./pages/ExpenseConfirm'));
const VendorSettings = React.lazy(() => import('./pages/VendorSettings'));
const Settings = React.lazy(() => import('./pages/Settings'));
const StaffPage = React.lazy(() => import('./pages/Staff'));
const StaffDetail = React.lazy(() => import('./pages/StaffDetail'));
const DataInputPage = React.lazy(() => import('./pages/DataInputPage'));
const LoginPage = React.lazy(() => import('./pages/Login'));
const ContractMyPage = React.lazy(() => import('./pages/ContractMy'));
const ContractSignPage = React.lazy(() => import('./pages/ContractSign'));
const SignupPage = React.lazy(() => import('./pages/Signup'));
const StaffDashboard = React.lazy(() => import('./pages/StaffDashboard'));
const CardSales = React.lazy(() => import('./pages/CardSales'));
const ProfitLoss = React.lazy(() => import('./pages/ProfitLoss'));

// Loading Fallback Component
const PageLoader = () => (
  <div className="flex justify-center items-center h-screen bg-slate-50">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
  </div>
);

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
        <Suspense fallback={<PageLoader />}>
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
        </Suspense>
      </Layout>
    </BrowserRouter>
  );
}

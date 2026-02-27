import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';
import ErrorBoundary from './components/ErrorBoundary';

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
const RevenueManagement = React.lazy(() => import('./pages/RevenueManagement'));
const PurchaseManagement = React.lazy(() => import('./pages/PurchaseManagement'));
const RecipeBook = React.lazy(() => import('./pages/RecipeBook'));
const LandingPage = React.lazy(() => import('./pages/LandingPage'));
const StaffAppPreview = React.lazy(() => import('./pages/StaffAppPreview'));
const PurchaseRequests = React.lazy(() => import('./pages/PurchaseRequests'));
const EmergencyContactsAdmin = React.lazy(() => import('./pages/EmergencyContacts'));
const AnnouncementsAdmin = React.lazy(() => import('./pages/Announcements'));

// Loading Fallback Component
const PageLoader = () => (
  <div className="flex justify-center items-center h-screen bg-slate-50">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
  </div>
);

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('user_role');

  if (!token) return <Navigate to="/" replace />;

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
  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup' || location.pathname === '/';

  if (isAuthPage) {
    return <div className="min-h-screen bg-slate-50">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      {/* Render Sidebar for Admin (Reactive) */}
      {isAdmin && <Sidebar />}

      {/* Main Content Area */}
      <div className={`flex-1 relative md:min-h-screen ${isAdmin ? 'md:ml-64' : ''}`}>
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
      <ErrorBoundary>
        <Layout>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />

              <Route path="/" element={<LandingPage />} />
              <Route path="/dashboard" element={<ProtectedRoute adminOnly><Dashboard /></ProtectedRoute>} />

              {/* SPLIT INPUT ROUTES */}
              <Route path="/input/expense" element={<ProtectedRoute adminOnly><DataInputPage mode="expense" /></ProtectedRoute>} />

              {/* FINANCE */}
              <Route path="/finance/card-sales" element={<ProtectedRoute adminOnly><CardSales /></ProtectedRoute>} />
              <Route path="/finance/profitloss" element={<ProtectedRoute adminOnly><ProfitLoss /></ProtectedRoute>} />
              <Route path="/revenue" element={<ProtectedRoute adminOnly><RevenueManagement /></ProtectedRoute>} />
              <Route path="/purchase" element={<ProtectedRoute adminOnly><PurchaseManagement /></ProtectedRoute>} />
              <Route path="/purchase-requests" element={<ProtectedRoute adminOnly><PurchaseRequests /></ProtectedRoute>} />
              <Route path="/emergency-contacts" element={<ProtectedRoute adminOnly><EmergencyContactsAdmin /></ProtectedRoute>} />
              <Route path="/announcements" element={<ProtectedRoute adminOnly><AnnouncementsAdmin /></ProtectedRoute>} />
              <Route path="/recipes" element={<ProtectedRoute adminOnly><RecipeBook /></ProtectedRoute>} />

              {/* BACKWARD COMPATIBILITY */}
              <Route path="/camera" element={<ProtectedRoute adminOnly><DataInputPage mode="expense" /></ProtectedRoute>} />

              <Route path="/confirm" element={<ProtectedRoute adminOnly><ExpenseConfirm /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute adminOnly><Settings /></ProtectedRoute>} />
              <Route path="/vendor-settings" element={<ProtectedRoute adminOnly><VendorSettings /></ProtectedRoute>} />
              <Route path="/staff" element={<ProtectedRoute adminOnly><StaffPage /></ProtectedRoute>} />
              <Route path="/staff/:id" element={<ProtectedRoute adminOnly><StaffDetail /></ProtectedRoute>} />

              {/* STAFF ROUTES */}
              <Route path="/staff-app-preview" element={<ProtectedRoute adminOnly><StaffAppPreview /></ProtectedRoute>} />
              <Route path="/staff-dashboard" element={<ProtectedRoute><StaffDashboard /></ProtectedRoute>} />
              <Route path="/contracts/my" element={<ProtectedRoute><ContractMyPage /></ProtectedRoute>} />
              <Route path="/contracts/:id/sign" element={<ProtectedRoute><ContractSignPage /></ProtectedRoute>} />

              {/* 404 catch-all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </Layout>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

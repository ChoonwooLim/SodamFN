import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useState } from 'react';
import BottomTab from './components/BottomTab';
import Onboarding from './pages/Onboarding';

const Login = lazy(() => import('./pages/Login'));
const Home = lazy(() => import('./pages/Home'));
const Attendance = lazy(() => import('./pages/Attendance'));
const Contracts = lazy(() => import('./pages/Contracts'));
const ContractSign = lazy(() => import('./pages/ContractSign'));
const Documents = lazy(() => import('./pages/Documents'));
const Payslip = lazy(() => import('./pages/Payslip'));
const Profile = lazy(() => import('./pages/Profile'));
const PurchaseRequest = lazy(() => import('./pages/PurchaseRequest'));
const EmergencyContacts = lazy(() => import('./pages/EmergencyContacts'));
const Suggestions = lazy(() => import('./pages/Suggestions'));
const StaffChat = lazy(() => import('./pages/StaffChat'));
const InstallGuide = lazy(() => import('./pages/InstallGuide'));
const OpenChecklist = lazy(() => import('./pages/OpenChecklist'));
const InventoryCheck = lazy(() => import('./pages/InventoryCheck'));

function PageLoader() {
  return (
    <div className="page-loading">
      <div className="spinner" />
      <span className="text-muted text-sm">로딩 중...</span>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token');
  const urlParams = new URLSearchParams(window.location.search);
  const targetBid = urlParams.get('bid');

  // If there is a token but the URL specifies a different business, clear it
  let shouldClearParams = false;
  if (token && targetBid) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      // Note: payload.business_id could be null for superadmin, but for staff it exists
      if (payload.business_id && payload.business_id.toString() !== targetBid) {
        localStorage.removeItem('token');
        shouldClearParams = true;
      }
    } catch (e) {
      console.error(e);
    }
  }

  if (shouldClearParams) {
    return <Navigate to={`/login?bid=${targetBid}`} replace />;
  }

  // Check token again in case it was removed above
  if (!localStorage.getItem('token')) {
    return <Navigate to={`/login${window.location.search}`} replace />;
  }
  return children;
}

export default function App() {
  const [onboarded, setOnboarded] = useState(
    () => localStorage.getItem('onboarding_completed') === 'true'
  );

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Install guide is always accessible */}
          <Route path="/install" element={<InstallGuide />} />

          {/* If not onboarded, show onboarding on all routes except /install */}
          {!onboarded ? (
            <Route path="*" element={<Onboarding onComplete={() => setOnboarded(true)} />} />
          ) : (
            <>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
              <Route path="/attendance" element={<ProtectedRoute><Attendance /></ProtectedRoute>} />
              <Route path="/contracts" element={<ProtectedRoute><Contracts /></ProtectedRoute>} />
              <Route path="/contracts/:id/sign" element={<ProtectedRoute><ContractSign /></ProtectedRoute>} />
              <Route path="/documents" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
              <Route path="/payslip" element={<ProtectedRoute><Payslip /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/purchase-request" element={<ProtectedRoute><PurchaseRequest /></ProtectedRoute>} />
              <Route path="/emergency" element={<ProtectedRoute><EmergencyContacts /></ProtectedRoute>} />
              <Route path="/suggestions" element={<ProtectedRoute><Suggestions /></ProtectedRoute>} />
              <Route path="/staff-chat" element={<ProtectedRoute><StaffChat /></ProtectedRoute>} />
              <Route path="/open-checklist" element={<ProtectedRoute><OpenChecklist /></ProtectedRoute>} />
              <Route path="/inventory-check" element={<ProtectedRoute><InventoryCheck /></ProtectedRoute>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          )}
        </Routes>
      </Suspense>
      {onboarded && <ConditionalBottomTab />}
    </BrowserRouter>
  );
}

function ConditionalBottomTab() {
  const loc = window.location.pathname;
  if (loc === '/install' || loc === '/login') return null;
  return <BottomTab />;
}

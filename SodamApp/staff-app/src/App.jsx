import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import BottomTab from './components/BottomTab';
import LocationPermission from './components/LocationPermission';

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
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
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
          <Route path="/install" element={<InstallGuide />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <ConditionalBottomTab />
      <ConditionalLocationPermission />
    </BrowserRouter>
  );
}

function ConditionalBottomTab() {
  const loc = window.location.pathname;
  if (loc === '/install' || loc === '/login') return null;
  return <BottomTab />;
}

function ConditionalLocationPermission() {
  const token = localStorage.getItem('token');
  const loc = window.location.pathname;
  if (!token || loc === '/install' || loc === '/login') return null;
  return <LocationPermission />;
}

import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';
import InstallBanner from './components/InstallBanner';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './hooks/useToast';
import { BusinessConfigProvider } from './hooks/useBusinessConfig';
import './styles/mobile-ux.css';

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

const CardSales = React.lazy(() => import('./pages/CardSales'));
const ExternalIntegration = React.lazy(() => import('./pages/ExternalIntegration'));
const CardModuleDetail = React.lazy(() => import('./pages/CardModuleDetail'));
const CardPurchaseModuleDetail = React.lazy(() => import('./pages/CardPurchaseModuleDetail'));
const EasyPosModuleDetail = React.lazy(() => import('./pages/EasyPosModuleDetail'));
const CoupangEatsModuleDetail = React.lazy(() => import('./pages/CoupangEatsModuleDetail'));
const BaeminModuleDetail = React.lazy(() => import('./pages/BaeminModuleDetail'));
const AutoCollection = React.lazy(() => import('./pages/AutoCollection'));
const ProfitLoss = React.lazy(() => import('./pages/ProfitLoss'));
const RevenueManagement = React.lazy(() => import('./pages/RevenueManagement'));
const PurchaseManagement = React.lazy(() => import('./pages/PurchaseManagement'));
const RecipeBook = React.lazy(() => import('./pages/RecipeBook'));
const MenuBoard = React.lazy(() => import('./pages/ProductManagement/MenuBoard'));
const DeliveryImages = React.lazy(() => import('./pages/ProductManagement/DeliveryImages'));
const StoreMaterials = React.lazy(() => import('./pages/ProductManagement/StoreMaterials'));
const LandingPage = React.lazy(() => import('./pages/LandingPage'));
const PlatformLanding = React.lazy(() => import('./pages/PlatformLanding'));
const StaffAppPreview = React.lazy(() => import('./pages/StaffAppPreview'));
const MaterialOrderForm = React.lazy(() => import('./pages/Materials/OrderForm'));
const MaterialOrderManage = React.lazy(() => import('./pages/Materials/OrderManage'));
const MaterialItems = React.lazy(() => import('./pages/Materials/ItemsManagement'));
const MaterialStock = React.lazy(() => import('./pages/Materials/StockManagement'));
const MaterialReceipts = React.lazy(() => import('./pages/Materials/Receipts'));
const PrimaryVendors = React.lazy(() => import('./pages/Materials/PrimaryVendors'));
const EmergencyContactsAdmin = React.lazy(() => import('./pages/EmergencyContacts'));
const AnnouncementsAdmin = React.lazy(() => import('./pages/Announcements'));
const BoardManagement = React.lazy(() => import('./pages/BoardManagement'));
const DeployManagement = React.lazy(() => import('./pages/DeployManagement'));
const AdminAppPreview = React.lazy(() => import('./pages/AdminAppPreview'));
const UserManual = React.lazy(() => import('./pages/UserManual'));
const OpenChecklistPage = React.lazy(() => import('./pages/OpenChecklistPage'));
const InventoryCheckAdmin = React.lazy(() => import('./pages/InventoryCheckAdmin'));
const DevelopmentRoadmap = React.lazy(() => import('./pages/DevelopmentRoadmap'));
const SuperAdminDashboard = React.lazy(() => import('./pages/SuperAdminDashboard'));
const DevWorkLog = React.lazy(() => import('./pages/DevWorkLog'));
const GuestDashboard = React.lazy(() => import('./pages/GuestDashboard'));
const StoreApplicationForm = React.lazy(() => import('./pages/StoreApplicationForm'));
const RetirementPay = React.lazy(() => import('./pages/RetirementPay'));
const RetirementPayCalc = React.lazy(() => import('./pages/RetirementPayCalc'));
// PayrollLedger merged into StaffDetail PayrollTab — route redirects to /employees
const DeliveryAppDashboard = React.lazy(() => import('./pages/DeliveryAppDashboard'));
const MoreMenu = React.lazy(() => import('./pages/MoreMenu'));
const DesignPlan = React.lazy(() => import('./pages/DesignPlan'));
const AISystemDesign = React.lazy(() => import('./pages/AISystemDesign'));
const HRDashboard = React.lazy(() => import('./pages/HRDashboard'));
const JobPosting = React.lazy(() => import('./pages/JobPosting'));
const FaxTransmission = React.lazy(() => import('./pages/FaxTransmission'));
const BankSync = React.lazy(() => import('./pages/BankSync'));
const TaxInvoice = React.lazy(() => import('./pages/TaxInvoice'));
const Statement = React.lazy(() => import('./pages/Statement'));
const HomeTaxCollect = React.lazy(() => import('./pages/HomeTaxCollect'));
const KakaoNotifications = React.lazy(() => import('./pages/KakaoNotifications'));
const CashBill = React.lazy(() => import('./pages/CashBill'));
const YearEnd = React.lazy(() => import('./pages/YearEnd'));
const SalesGuideHome = React.lazy(() => import('./pages/sales-guide/SalesGuideHome'));
const SalesGuideCategoryPage = React.lazy(() => import('./pages/sales-guide/CategoryPage'));

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

  // Guest users can only access guest routes
  if (role === 'guest') {
    return <Navigate to="/guest" replace />;
  }

  if (adminOnly && role !== 'admin' && role !== 'superadmin' && role !== 'superadmin_viewer') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

const SuperAdminRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('user_role');
  if (!token) return <Navigate to="/" replace />;
  // superadmin + 읽기전용 뷰어(superadmin_viewer) 허용
  if (role !== 'superadmin' && role !== 'superadmin_viewer') return <Navigate to="/dashboard" replace />;
  return children;
};

const GuestRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('user_role');
  if (!token) return <Navigate to="/login" replace />;
  if (role !== 'guest') return <Navigate to="/dashboard" replace />;
  return children;
};

const Layout = ({ children }) => {
  // Use location for page transition animation key
  const location = useLocation();
  const role = localStorage.getItem('user_role');
  const isAdmin = role === 'admin' || role === 'superadmin' || role === 'superadmin_viewer';
  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup' || location.pathname === '/' || location.pathname === '/store' || location.pathname === '/guest' || location.pathname === '/apply';

  if (isAuthPage) {
    return <div className="min-h-screen bg-slate-50">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      {/* Render Sidebar for Admin (Reactive) */}
      {isAdmin && <Sidebar />}

      {/* Main Content Area */}
      <div className={`flex-1 relative md:min-h-screen ${isAdmin ? 'md:ml-[272px] pt-11 md:pt-0' : ''}`}>
        <div key={location.pathname} className="mobile-page-enter">
          {children}
        </div>

        {/* Mobile Bottom Navigation - Only visible on small screens for Admin */}
        {isAdmin && (
          <div className="md:hidden">
            <BottomNav />
            <InstallBanner />
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
        <ToastProvider>
        <BusinessConfigProvider>
        <Layout>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />

              <Route path="/" element={<PlatformLanding />} />
              <Route path="/store" element={<LandingPage />} />
              <Route path="/dashboard" element={<ProtectedRoute adminOnly><Dashboard /></ProtectedRoute>} />

              {/* SPLIT INPUT ROUTES */}
              <Route path="/input/expense" element={<ProtectedRoute adminOnly><DataInputPage mode="expense" /></ProtectedRoute>} />

              {/* FINANCE */}
              <Route path="/finance/card-sales" element={<ProtectedRoute adminOnly><CardSales /></ProtectedRoute>} />
              <Route path="/external-integration" element={<ProtectedRoute adminOnly><ExternalIntegration /></ProtectedRoute>} />
              <Route path="/external-integration/cards" element={<ProtectedRoute adminOnly><CardModuleDetail /></ProtectedRoute>} />
              <Route path="/external-integration/card-purchase" element={<ProtectedRoute adminOnly><CardPurchaseModuleDetail /></ProtectedRoute>} />
              <Route path="/external-integration/banks" element={<ProtectedRoute adminOnly><BankSync source="codef" /></ProtectedRoute>} />
              <Route path="/external-integration/easypos" element={<ProtectedRoute adminOnly><EasyPosModuleDetail /></ProtectedRoute>} />
              <Route path="/external-integration/coupang-eats" element={<ProtectedRoute adminOnly><CoupangEatsModuleDetail /></ProtectedRoute>} />
              <Route path="/external-integration/baemin" element={<ProtectedRoute adminOnly><BaeminModuleDetail /></ProtectedRoute>} />
              <Route path="/auto-collection" element={<ProtectedRoute adminOnly><AutoCollection /></ProtectedRoute>} />
              <Route path="/finance/profitloss" element={<ProtectedRoute adminOnly><ProfitLoss /></ProtectedRoute>} />
              <Route path="/revenue" element={<ProtectedRoute adminOnly><RevenueManagement /></ProtectedRoute>} />
              <Route path="/purchase" element={<ProtectedRoute adminOnly><PurchaseManagement /></ProtectedRoute>} />
              <Route path="/finance/delivery" element={<ProtectedRoute adminOnly><DeliveryAppDashboard /></ProtectedRoute>} />
              <Route path="/finance/bank-sync" element={<ProtectedRoute adminOnly><BankSync /></ProtectedRoute>} />
              <Route path="/finance/tax-invoice" element={<ProtectedRoute adminOnly><TaxInvoice /></ProtectedRoute>} />
              <Route path="/finance/statement" element={<ProtectedRoute adminOnly><Statement /></ProtectedRoute>} />
              <Route path="/finance/hometax" element={<ProtectedRoute adminOnly><HomeTaxCollect /></ProtectedRoute>} />
              <Route path="/hr/notifications" element={<ProtectedRoute adminOnly><KakaoNotifications /></ProtectedRoute>} />
              <Route path="/finance/cashbill" element={<ProtectedRoute adminOnly><CashBill /></ProtectedRoute>} />
              <Route path="/purchase-requests" element={<Navigate to="/materials/order-manage" replace />} />
              <Route path="/materials/order-form" element={<ProtectedRoute adminOnly><MaterialOrderForm /></ProtectedRoute>} />
              <Route path="/materials/order-manage" element={<ProtectedRoute adminOnly><MaterialOrderManage /></ProtectedRoute>} />
              <Route path="/materials/items" element={<ProtectedRoute adminOnly><MaterialItems /></ProtectedRoute>} />
              <Route path="/materials/inventory" element={<ProtectedRoute adminOnly><MaterialStock /></ProtectedRoute>} />
              <Route path="/materials/receipts" element={<ProtectedRoute adminOnly><MaterialReceipts /></ProtectedRoute>} />
              <Route path="/materials/primary-vendors" element={<ProtectedRoute adminOnly><PrimaryVendors /></ProtectedRoute>} />
              <Route path="/emergency-contacts" element={<ProtectedRoute adminOnly><EmergencyContactsAdmin /></ProtectedRoute>} />
              <Route path="/announcements" element={<ProtectedRoute adminOnly><AnnouncementsAdmin /></ProtectedRoute>} />
              <Route path="/board" element={<ProtectedRoute adminOnly><BoardManagement /></ProtectedRoute>} />
              <Route path="/deploy" element={<ProtectedRoute adminOnly><DeployManagement /></ProtectedRoute>} />
              <Route path="/recipes" element={<Navigate to="/products/recipes" replace />} />
              <Route path="/products/recipes" element={<ProtectedRoute adminOnly><RecipeBook /></ProtectedRoute>} />
              <Route path="/products/menu-board" element={<ProtectedRoute adminOnly><MenuBoard /></ProtectedRoute>} />
              <Route path="/products/delivery-images" element={<ProtectedRoute adminOnly><DeliveryImages /></ProtectedRoute>} />
              <Route path="/products/store-materials" element={<ProtectedRoute adminOnly><StoreMaterials /></ProtectedRoute>} />
              <Route path="/open-checklist" element={<ProtectedRoute adminOnly><OpenChecklistPage /></ProtectedRoute>} />
              <Route path="/inventory-check-admin" element={<ProtectedRoute adminOnly><InventoryCheckAdmin /></ProtectedRoute>} />
              <Route path="/roadmap" element={<ProtectedRoute adminOnly><DevelopmentRoadmap /></ProtectedRoute>} />
              <Route path="/superadmin" element={<SuperAdminRoute><SuperAdminDashboard /></SuperAdminRoute>} />
              <Route path="/superadmin/worklog" element={<SuperAdminRoute><DevWorkLog /></SuperAdminRoute>} />
              <Route path="/guest" element={<GuestRoute><GuestDashboard /></GuestRoute>} />
              <Route path="/apply" element={<GuestRoute><StoreApplicationForm /></GuestRoute>} />

              {/* BACKWARD COMPATIBILITY */}
              <Route path="/camera" element={<ProtectedRoute adminOnly><DataInputPage mode="expense" /></ProtectedRoute>} />

              <Route path="/confirm" element={<ProtectedRoute adminOnly><ExpenseConfirm /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute adminOnly><Settings /></ProtectedRoute>} />
              <Route path="/vendor-settings" element={<ProtectedRoute adminOnly><VendorSettings /></ProtectedRoute>} />
              <Route path="/manual" element={<ProtectedRoute adminOnly><UserManual /></ProtectedRoute>} />
              <Route path="/employees" element={<ProtectedRoute adminOnly><StaffPage /></ProtectedRoute>} />
              <Route path="/employees/:id" element={<ProtectedRoute adminOnly><StaffDetail /></ProtectedRoute>} />
              <Route path="/hr/retirement" element={<ProtectedRoute adminOnly><RetirementPay /></ProtectedRoute>} />
              <Route path="/retirement-calc" element={<ProtectedRoute adminOnly><RetirementPayCalc /></ProtectedRoute>} />
              <Route path="/retirement-calc/:staffId" element={<ProtectedRoute adminOnly><RetirementPayCalc /></ProtectedRoute>} />
              <Route path="/hr/foreign-worker-guide" element={<Navigate to="/sales-guide/hr" replace />} />
              <Route path="/sales-guide" element={<ProtectedRoute adminOnly><SalesGuideHome /></ProtectedRoute>} />
              <Route path="/sales-guide/:category" element={<ProtectedRoute adminOnly><SalesGuideCategoryPage /></ProtectedRoute>} />
              <Route path="/hr/dashboard" element={<ProtectedRoute adminOnly><HRDashboard /></ProtectedRoute>} />
              <Route path="/hr/job-posting" element={<ProtectedRoute adminOnly><JobPosting /></ProtectedRoute>} />
              <Route path="/hr/fax" element={<ProtectedRoute adminOnly><FaxTransmission /></ProtectedRoute>} />
              <Route path="/hr/payroll-ledger" element={<Navigate to="/employees" replace />} />
              <Route path="/yearend" element={<ProtectedRoute adminOnly><YearEnd /></ProtectedRoute>} />
              <Route path="/more" element={<ProtectedRoute adminOnly><MoreMenu /></ProtectedRoute>} />
              <Route path="/design-plan" element={<ProtectedRoute adminOnly><DesignPlan /></ProtectedRoute>} />
              <Route path="/ai-system-design" element={<ProtectedRoute adminOnly><AISystemDesign /></ProtectedRoute>} />

              {/* STAFF ROUTES */}
              <Route path="/staff-app-preview" element={<ProtectedRoute adminOnly><StaffAppPreview /></ProtectedRoute>} />
              <Route path="/admin-app-preview" element={<ProtectedRoute adminOnly><AdminAppPreview /></ProtectedRoute>} />

              <Route path="/contracts/my" element={<ProtectedRoute><ContractMyPage /></ProtectedRoute>} />
              <Route path="/contracts/:id/sign" element={<ProtectedRoute><ContractSignPage /></ProtectedRoute>} />

              {/* 404 catch-all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </Layout>
        </BusinessConfigProvider>
        </ToastProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

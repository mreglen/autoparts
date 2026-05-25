// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useEffect } from 'react';
import { fetchProfile, logout } from './redux/slices/AuthSlice';
import { fetchPublicSiteConfig, fetchSiteQuickLinks } from './redux/slices/PublicInfoSlice';

// Pages
import Authorization from './pages/Autorization/Authorization';
import MainLayout from './layouts/MainLayout';
import ProfileWithMenuLayout from './layouts/ProfileWithMenuLayout';
import ProfilePage from './pages/Profile/ProfilePage';
import PasswordReset from './pages/Autorization/PasswordReset/PasswordReset';
import AutoParts from './pages/AutoParts/AutoParts';
import AboutCompany from './pages/About/AboutCompany';
import DeliveryPage from './pages/About/DeliveryPage';
import PaymentPage from './pages/About/PaymentPage';
import ReviewsPage from './pages/About/ReviewsPage';
import { useShowSiteReviews } from './utils/siteReviewsPublic';
import UsedPartsFiltersPage from './pages/AutoParts/UsedParts/UsedPartsFiltersPage';
import NewPartsFiltersPage from './pages/AutoParts/NewParts/NewPartsFiltersPage';
import Main from './pages/Main/Main';
import CatalogPage from './pages/Catalog/CatalogPage';
import MyParts from './pages/MyParts/MyParts';
import AddPart from './pages/MyParts/AddPart/AddPart';
import EditPart from './pages/MyParts/EditPart/EditPart';
import ResubmitPart from './pages/MyParts/ResubmitPart/ResubmitPart';
import EditPendingPart from './pages/MyParts/EditPendingPart/EditPendingPart';
import StockInList from './pages/StockIn/StockInList';
import { StockOutList } from './pages/StockOut';
import CartPage from './pages/Cart/CartPage';
import OrderRegistration from './pages/Cart/OrderRegistration';
import SalesOrdersPage from './pages/Sales/SalesOrdersPage';
import SalesReturnsPage from './pages/Sales/SalesReturnsPage';
import PurchasesOrdersPage from './pages/Sales/PurchasesOrdersPage';
import PurchasesReturnsPage from './pages/Sales/PurchasesReturnsPage';
import WarehouseSalesPage from './pages/Sales/WarehouseSalesPage';
import FinancePage from './pages/Finance/FinancePage';
import DashboardPage from './pages/Dashboard/DashboardPage';
import EmployeesPage from './pages/Profile/EmployeesPage';
import ClientsPage from './pages/Profile/ClientsPage';
import StorageAddressesPage from './pages/Profile/StorageAddressesPage';
import PendingSellersPage from './pages/Moderation/PendingSellersPage';
import ProductModeration from './pages/Moderation/ProductModeration/ProductModeration';
import OrganizationProductModerationPage from './pages/Moderation/ProductModeration/OrganizationProductModerationPage';
import SellersPage from './pages/Profile/SellersPage';
import SellerWorkspacePage from './pages/Profile/SellerWorkspacePage';
import Organization from './pages/Settings/Organization';
import PrintSettings from './pages/Settings/PrintSettings';
import IntegrationPage from './pages/Settings/IntegrationPage';
import AvitoIntegrationPage from './pages/Settings/AvitoIntegrationPage';
import AvitoNomenclaturePage from './pages/Settings/AvitoNomenclaturePage';
import DromIntegrationPage from './pages/Settings/DromIntegrationPage';
import DromNomenclaturePage from './pages/Settings/DromNomenclaturePage';
import NotFound from './pages/NotFound/NotFound';
import PartDetail from './pages/PartDetail/PartDetail';
import VehiclesList from './pages/Vehicles/VehiclesList';
import AddVehiclePage from './pages/Vehicles/AddVehiclePage';
import EditVehiclePage from './pages/Vehicles/EditVehiclePage';
import ChatsHubPage from './pages/Chat/ChatsHubPage';
import ProductNotFound from './pages/Chat/ProductNotFound';
import RequireAuth from './components/auth/RequireAuth';
import AdminPanelPage from './pages/Admin/AdminPanelPage';
import AuditLogPage from './pages/Admin/AuditLogPage';
import AnalyticsPage from './pages/Admin/AnalyticsPage';
import useSiteAnalytics from './hooks/useSiteAnalytics';



// Component to handle Service Worker navigation messages
function ServiceWorkerNavigationHandler() {
  const navigate = useNavigate();
  
  useEffect(() => {
    const handleNavigateToChat = (event) => {
      const storedToken = localStorage.getItem('token');
      if (!storedToken) {
        navigate('/auth', { replace: true });
        return;
      }
      const { chatId } = event.detail;
      console.log('[App] Navigating to chat from notification:', chatId);
      navigate(`/chats/${chatId}`, { state: { scrollToBottom: true } });
    };
    
    window.addEventListener('navigateToChat', handleNavigateToChat);
    
    return () => {
      window.removeEventListener('navigateToChat', handleNavigateToChat);
    };
  }, [navigate]);
  
  return null; // This component doesn't render anything
}

function SiteAnalyticsTracker() {
  useSiteAnalytics();
  return null;
}

function ReviewsRoute() {
  const showSiteReviews = useShowSiteReviews();
  if (!showSiteReviews) {
    return <Navigate to="/" replace />;
  }
  return <ReviewsPage />;
}

function App() {
  const dispatch = useDispatch();
  const { token } = useSelector((state) => state.auth);

  // Check auth status on app load
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      dispatch(fetchProfile())
        .unwrap()
        .catch((error) => {
          // If profile fetch fails due to auth error, clear everything
          if (error?.includes('401') || error?.includes('Unauthorized')) {
            localStorage.removeItem('token');
            // Force a Redux state update by dispatching logout
            dispatch(logout());
          }
        });
    }
    // Load public site config on app start (always, regardless of auth)
    dispatch(fetchPublicSiteConfig());
    dispatch(fetchSiteQuickLinks());
  }, [dispatch]);

  // Fetch profile when token changes
  useEffect(() => {
    if (token) {
      dispatch(fetchProfile())
        .unwrap()
        .catch((error) => {
          // If profile fetch fails due to auth error, clear local storage
          if (error?.includes('401') || error?.includes('Unauthorized')) {
            localStorage.removeItem('token');
            dispatch(logout());
          }
        });
    }
  }, [dispatch, token]);

  return (
    <BrowserRouter>
      <ServiceWorkerNavigationHandler />
      <SiteAnalyticsTracker />
      <Routes>
        {/* Публичные маршруты */}
        <Route path="/auth" element={<Authorization />} />
        <Route path="/auth/password-reset" element={<PasswordReset />} />

        {/* Основной layout — страницы без бокового меню */}
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Main />} />
          <Route path="/autoparts" element={<Navigate to="/autoparts/new" replace />} />
          <Route path="/autoparts/new/filters" element={<NewPartsFiltersPage />} />
          <Route path="/autoparts/new" element={<AutoParts />} />
          <Route path="/autoparts/used/filters" element={<UsedPartsFiltersPage />} />
          <Route path="/autoparts/used" element={<AutoParts />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/about" element={<AboutCompany />} />
          <Route path="/delivery" element={<DeliveryPage />} />
          <Route path="/payment" element={<PaymentPage />} />
          <Route path="/reviews" element={<ReviewsRoute />} />
          <Route path="/autoservice" element={<Navigate to="/about" replace />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/order-reg" element={<OrderRegistration />} />
          <Route path="/my-parts/add" element={<AddPart />} />
          <Route path="/my-parts/edit/:id" element={<EditPart />} />
          <Route path="/part/:productId" element={<PartDetail />} />
          <Route path="/product-not-found" element={<ProductNotFound />} />

          <Route path="*" element={<NotFound />} />
        </Route>

        {/* Layout с боковым меню для страниц профиля */}
        <Route path="/" element={<ProfileWithMenuLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/my-parts" element={<MyParts />} />
          <Route path="/my-parts/resubmit/:id" element={<ResubmitPart />} />
          <Route path="/my-parts/edit-pending/:id" element={<EditPendingPart />} />
          <Route path="/vehicles" element={<VehiclesList />} />
          <Route path="/vehicles/add" element={<AddVehiclePage />} />
          <Route path="/vehicles/edit/:id" element={<EditVehiclePage />} />
          <Route path="/purchases/orders" element={<PurchasesOrdersPage />} />
          <Route path="/purchases/returns" element={<PurchasesReturnsPage />} />
          <Route path="/sales/orders" element={<SalesOrdersPage />} />
          <Route path="/sales/returns" element={<SalesReturnsPage />} />
          <Route path="/stock-in" element={<StockInList />} />
          <Route path="/stock-out" element={<StockOutList />} />
          <Route path="/warehouse-sales" element={<WarehouseSalesPage />} />
          <Route path="/finance" element={<FinancePage />} />
          <Route path="/settings/employees" element={<EmployeesPage />} />
          <Route
            path="/chats"
            element={(
              <RequireAuth>
                <ChatsHubPage />
              </RequireAuth>
            )}
          />
          <Route
            path="/chats/:chatId"
            element={(
              <RequireAuth>
                <ChatsHubPage />
              </RequireAuth>
            )}
          />
          <Route path="/settings/storage-addresses" element={<StorageAddressesPage />} />
          <Route path="/settings/organization" element={<Organization />} />
          <Route path="/settings/printers" element={<PrintSettings />} />
          <Route path="/settings/integration" element={<IntegrationPage />} />
          <Route path="/settings/integration/avito" element={<AvitoIntegrationPage />} />
          <Route path="/settings/integration/avito/nomenclature" element={<AvitoNomenclaturePage />} />
          <Route path="/settings/integration/drom" element={<DromIntegrationPage />} />
          <Route path="/settings/integration/drom/nomenclature" element={<DromNomenclaturePage />} />
          <Route path="/moderation/pending-sellers" element={<PendingSellersPage />} />
          <Route path="/moderation/products" element={<ProductModeration />} />
          <Route path="/moderation/products/:organizationId" element={<OrganizationProductModerationPage />} />
          <Route path="/sellers" element={<SellersPage />} />
          <Route path="/sellers/:sellerId/workspace" element={<SellerWorkspacePage />} />
          <Route path="/admin-settings" element={<AdminPanelPage />} />
          <Route path="/admin/analytics" element={<AnalyticsPage />} />
          <Route path="/admin/audit-log" element={<AuditLogPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
// src/App.jsx
import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchProfile, logout } from './redux/slices/AuthSlice';
import { fetchPublicSiteConfig, fetchSiteQuickLinks } from './redux/slices/PublicInfoSlice';

import RouteFallback from './components/RouteFallback';
import RequireAuth from './components/auth/RequireAuth';
import CookieBanner from './components/Legal/CookieBanner';
import MainLayout from './layouts/MainLayout';
import ProfileWithMenuLayout from './layouts/ProfileWithMenuLayout';
import { useShowSiteReviews } from './utils/siteReviewsPublic';
import useSiteAnalytics from './hooks/useSiteAnalytics';

// Eager: публичный каталог и первый экран
import Authorization from './pages/Autorization/Authorization';
import PasswordReset from './pages/Autorization/PasswordReset/PasswordReset';
import AutoParts from './pages/AutoParts/AutoParts';
import AboutCompany from './pages/About/AboutCompany';
import DeliveryPage from './pages/About/DeliveryPage';
import PaymentPage from './pages/About/PaymentPage';
import PrivacyPolicyPage from './pages/About/PrivacyPolicyPage';
import PersonalDataConsentPage from './pages/About/PersonalDataConsentPage';
import PublicOfferPage from './pages/About/PublicOfferPage';
import CookiePolicyPage from './pages/About/CookiePolicyPage';
import UsedPartsFiltersPage from './pages/AutoParts/UsedParts/UsedPartsFiltersPage';
import NewPartsFiltersPage from './pages/AutoParts/NewParts/NewPartsFiltersPage';
import NewPartDetailPage from './pages/AutoParts/NewParts/NewPartDetailPage';
import Main from './pages/Main/Main';
import CatalogPage from './pages/Catalog/CatalogPage';
import CartPage from './pages/Cart/CartPage';
import PartDetail from './pages/PartDetail/PartDetail';
import NotFound from './pages/NotFound/NotFound';
import ProductNotFound from './pages/Chat/ProductNotFound';

// Lazy: кабинет продавца
const ProfilePage = lazy(() => import('./pages/Profile/ProfilePage'));
const MyParts = lazy(() => import('./pages/MyParts/MyParts'));
const AddPart = lazy(() => import('./pages/MyParts/AddPart/AddPart'));
const EditPart = lazy(() => import('./pages/MyParts/EditPart/EditPart'));
const ResubmitPart = lazy(() => import('./pages/MyParts/ResubmitPart/ResubmitPart'));
const EditPendingPart = lazy(() => import('./pages/MyParts/EditPendingPart/EditPendingPart'));
const StockInList = lazy(() => import('./pages/StockIn/StockInList'));
const StockOutList = lazy(() => import('./pages/StockOut').then((m) => ({ default: m.StockOutList })));
const OrderRegistration = lazy(() => import('./pages/Cart/OrderRegistration'));
const NewPartsOrderRegistration = lazy(() => import('./pages/Cart/NewPartsOrderRegistration'));
const NewPartsPaymentPage = lazy(() => import('./pages/Cart/NewPartsPaymentPage'));
const SalesOrdersPage = lazy(() => import('./pages/Sales/SalesOrdersPage'));
const SalesReturnsPage = lazy(() => import('./pages/Sales/SalesReturnsPage'));
const PurchasesOrdersPage = lazy(() => import('./pages/Sales/PurchasesOrdersPage'));
const PurchasesReturnsPage = lazy(() => import('./pages/Sales/PurchasesReturnsPage'));
const WarehouseSalesPage = lazy(() => import('./pages/Sales/WarehouseSalesPage'));
const FinancePage = lazy(() => import('./pages/Finance/FinancePage'));
const DashboardPage = lazy(() => import('./pages/Dashboard/DashboardPage'));
const EmployeesPage = lazy(() => import('./pages/Profile/EmployeesPage'));
const ClientsPage = lazy(() => import('./pages/Profile/ClientsPage'));
const StorageAddressesPage = lazy(() => import('./pages/Profile/StorageAddressesPage'));
const PendingSellersPage = lazy(() => import('./pages/Moderation/PendingSellersPage'));
const ProductModeration = lazy(() => import('./pages/Moderation/ProductModeration/ProductModeration'));
const OrganizationProductModerationPage = lazy(() => import('./pages/Moderation/ProductModeration/OrganizationProductModerationPage'));
const SellersPage = lazy(() => import('./pages/Profile/SellersPage'));
const SellerWorkspacePage = lazy(() => import('./pages/Profile/SellerWorkspacePage'));
const Organization = lazy(() => import('./pages/Settings/Organization'));
const VehiclesList = lazy(() => import('./pages/Vehicles/VehiclesList'));
const AddVehiclePage = lazy(() => import('./pages/Vehicles/AddVehiclePage'));
const EditVehiclePage = lazy(() => import('./pages/Vehicles/EditVehiclePage'));
const SellerPartCardPage = lazy(() => import('./pages/SellerPartCard/SellerPartCardPage'));
const OrganizationsPage = lazy(() => import('./pages/Organizations/OrganizationsPage'));
const OrganizationPublicPage = lazy(() => import('./pages/Organizations/OrganizationPublicPage'));
const PublicUserProfilePage = lazy(() => import('./pages/PublicProfiles/PublicUserProfilePage'));
const ReviewsPage = lazy(() => import('./pages/About/ReviewsPage'));

// Lazy: интеграции
const PrintSettings = lazy(() => import('./pages/Settings/PrintSettings'));
const IntegrationPage = lazy(() => import('./pages/Settings/IntegrationPage'));
const AvitoIntegrationPage = lazy(() => import('./pages/Settings/AvitoIntegrationPage'));
const AvitoNomenclaturePage = lazy(() => import('./pages/Settings/AvitoNomenclaturePage'));
const DromIntegrationPage = lazy(() => import('./pages/Settings/DromIntegrationPage'));
const DromNomenclaturePage = lazy(() => import('./pages/Settings/DromNomenclaturePage'));

// Lazy: чат
const ChatsHubPage = lazy(() => import('./pages/Chat/ChatsHubPage'));

// Lazy: админка
const AdminPanelPage = lazy(() => import('./pages/Admin/AdminPanelPage'));
const AuditLogPage = lazy(() => import('./pages/Admin/AuditLogPage'));
const AdminUsersPage = lazy(() => import('./pages/Admin/AdminUsersPage'));
const RosskoSettingsPage = lazy(() => import('./pages/Admin/RosskoSettingsPage'));
const AnalyticsPage = lazy(() => import('./pages/Admin/AnalyticsPage'));

function LazyRoute({ children }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

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

  return null;
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
  return (
    <LazyRoute>
      <ReviewsPage />
    </LazyRoute>
  );
}

function RedirectLegacyProfileRoute() {
  const { publicCode } = useParams();
  return <Navigate to={`/users/${encodeURIComponent(publicCode || '')}`} replace />;
}

function App() {
  const dispatch = useDispatch();
  const { token } = useSelector((state) => state.auth);

  useEffect(() => {
    dispatch(fetchPublicSiteConfig());
    dispatch(fetchSiteQuickLinks());
  }, [dispatch]);

  useEffect(() => {
    if (!token) return;
    dispatch(fetchProfile())
      .unwrap()
      .catch((error) => {
        if (error?.includes('401') || error?.includes('Unauthorized')) {
          localStorage.removeItem('token');
          dispatch(logout());
        }
      });
  }, [dispatch, token]);

  return (
    <BrowserRouter>
      <CookieBanner />
      <ServiceWorkerNavigationHandler />
      <SiteAnalyticsTracker />
      <Routes>
        <Route path="/auth" element={<Authorization />} />
        <Route path="/auth/password-reset" element={<PasswordReset />} />

        <Route path="/" element={<MainLayout />}>
          <Route index element={<Main />} />
          <Route path="/autoparts" element={<Navigate to="/autoparts/new" replace />} />
          <Route path="/autoparts/new/filters" element={<NewPartsFiltersPage />} />
          <Route path="/autoparts/new" element={<AutoParts />} />
          <Route path="/autoparts/new/part/:cardId" element={<NewPartDetailPage />} />
          <Route path="/autoparts/used/filters" element={<UsedPartsFiltersPage />} />
          <Route path="/autoparts/used" element={<AutoParts />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/about" element={<AboutCompany />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/personal-data-consent" element={<PersonalDataConsentPage />} />
          <Route path="/offer" element={<PublicOfferPage />} />
          <Route path="/cookie-policy" element={<CookiePolicyPage />} />
          <Route path="/delivery" element={<DeliveryPage />} />
          <Route path="/payment" element={<PaymentPage />} />
          <Route path="/reviews" element={<ReviewsRoute />} />
          <Route
            path="/organizations"
            element={(
              <LazyRoute>
                <OrganizationsPage />
              </LazyRoute>
            )}
          />
          <Route
            path="/organizations/:orgId"
            element={(
              <LazyRoute>
                <OrganizationPublicPage />
              </LazyRoute>
            )}
          />
          <Route
            path="/seller/part-card/:id"
            element={(
              <LazyRoute>
                <SellerPartCardPage />
              </LazyRoute>
            )}
          />
          <Route
            path="/users/:publicCode"
            element={(
              <LazyRoute>
                <PublicUserProfilePage />
              </LazyRoute>
            )}
          />
          <Route path="/seller/:publicCode" element={<RedirectLegacyProfileRoute />} />
          <Route path="/buyer/:publicCode" element={<RedirectLegacyProfileRoute />} />
          <Route path="/cart" element={<CartPage />} />
          <Route
            path="/order-reg"
            element={(
              <LazyRoute>
                <OrderRegistration />
              </LazyRoute>
            )}
          />
          <Route
            path="/cart/new/checkout"
            element={(
              <LazyRoute>
                <NewPartsOrderRegistration />
              </LazyRoute>
            )}
          />
          <Route
            path="/cart/new/pay/:sessionId"
            element={(
              <LazyRoute>
                <NewPartsPaymentPage />
              </LazyRoute>
            )}
          />
          <Route path="/part/:productId" element={<PartDetail />} />
          <Route path="/product-not-found" element={<ProductNotFound />} />
          <Route path="*" element={<NotFound />} />
        </Route>

        <Route path="/" element={<ProfileWithMenuLayout />}>
          <Route
            path="/dashboard"
            element={(
              <LazyRoute>
                <DashboardPage />
              </LazyRoute>
            )}
          />
          <Route
            path="/clients"
            element={(
              <LazyRoute>
                <ClientsPage />
              </LazyRoute>
            )}
          />
          <Route
            path="/profile"
            element={(
              <LazyRoute>
                <ProfilePage />
              </LazyRoute>
            )}
          />
          <Route
            path="/my-parts"
            element={(
              <LazyRoute>
                <MyParts />
              </LazyRoute>
            )}
          />
          <Route
            path="/my-parts/add"
            element={(
              <LazyRoute>
                <AddPart />
              </LazyRoute>
            )}
          />
          <Route
            path="/my-parts/edit/:id"
            element={(
              <LazyRoute>
                <EditPart />
              </LazyRoute>
            )}
          />
          <Route
            path="/my-parts/resubmit/:id"
            element={(
              <LazyRoute>
                <ResubmitPart />
              </LazyRoute>
            )}
          />
          <Route
            path="/my-parts/edit-pending/:id"
            element={(
              <LazyRoute>
                <EditPendingPart />
              </LazyRoute>
            )}
          />
          <Route
            path="/vehicles"
            element={(
              <LazyRoute>
                <VehiclesList />
              </LazyRoute>
            )}
          />
          <Route
            path="/vehicles/add"
            element={(
              <LazyRoute>
                <AddVehiclePage />
              </LazyRoute>
            )}
          />
          <Route
            path="/vehicles/edit/:id"
            element={(
              <LazyRoute>
                <EditVehiclePage />
              </LazyRoute>
            )}
          />
          <Route
            path="/purchases/orders"
            element={(
              <LazyRoute>
                <PurchasesOrdersPage />
              </LazyRoute>
            )}
          />
          <Route
            path="/purchases/returns"
            element={(
              <LazyRoute>
                <PurchasesReturnsPage />
              </LazyRoute>
            )}
          />
          <Route
            path="/sales/orders"
            element={(
              <LazyRoute>
                <SalesOrdersPage />
              </LazyRoute>
            )}
          />
          <Route
            path="/sales/returns"
            element={(
              <LazyRoute>
                <SalesReturnsPage />
              </LazyRoute>
            )}
          />
          <Route
            path="/stock-in"
            element={(
              <LazyRoute>
                <StockInList />
              </LazyRoute>
            )}
          />
          <Route
            path="/stock-out"
            element={(
              <LazyRoute>
                <StockOutList />
              </LazyRoute>
            )}
          />
          <Route
            path="/warehouse-sales"
            element={(
              <LazyRoute>
                <WarehouseSalesPage />
              </LazyRoute>
            )}
          />
          <Route
            path="/finance"
            element={(
              <LazyRoute>
                <FinancePage />
              </LazyRoute>
            )}
          />
          <Route
            path="/settings/employees"
            element={(
              <LazyRoute>
                <EmployeesPage />
              </LazyRoute>
            )}
          />
          <Route
            path="/chats"
            element={(
              <RequireAuth>
                <LazyRoute>
                  <ChatsHubPage />
                </LazyRoute>
              </RequireAuth>
            )}
          />
          <Route
            path="/chats/:chatId"
            element={(
              <RequireAuth>
                <LazyRoute>
                  <ChatsHubPage />
                </LazyRoute>
              </RequireAuth>
            )}
          />
          <Route
            path="/settings/storage-addresses"
            element={(
              <LazyRoute>
                <StorageAddressesPage />
              </LazyRoute>
            )}
          />
          <Route
            path="/settings/organization"
            element={(
              <LazyRoute>
                <Organization />
              </LazyRoute>
            )}
          />
          <Route
            path="/settings/printers"
            element={(
              <LazyRoute>
                <PrintSettings />
              </LazyRoute>
            )}
          />
          <Route
            path="/settings/integration"
            element={(
              <LazyRoute>
                <IntegrationPage />
              </LazyRoute>
            )}
          />
          <Route
            path="/settings/integration/avito"
            element={(
              <LazyRoute>
                <AvitoIntegrationPage />
              </LazyRoute>
            )}
          />
          <Route
            path="/settings/integration/avito/nomenclature"
            element={(
              <LazyRoute>
                <AvitoNomenclaturePage />
              </LazyRoute>
            )}
          />
          <Route
            path="/settings/integration/drom"
            element={(
              <LazyRoute>
                <DromIntegrationPage />
              </LazyRoute>
            )}
          />
          <Route
            path="/settings/integration/drom/nomenclature"
            element={(
              <LazyRoute>
                <DromNomenclaturePage />
              </LazyRoute>
            )}
          />
          <Route
            path="/moderation/pending-sellers"
            element={(
              <LazyRoute>
                <PendingSellersPage />
              </LazyRoute>
            )}
          />
          <Route
            path="/moderation/products"
            element={(
              <LazyRoute>
                <ProductModeration />
              </LazyRoute>
            )}
          />
          <Route
            path="/moderation/products/:organizationId"
            element={(
              <LazyRoute>
                <OrganizationProductModerationPage />
              </LazyRoute>
            )}
          />
          <Route
            path="/sellers"
            element={(
              <LazyRoute>
                <SellersPage />
              </LazyRoute>
            )}
          />
          <Route
            path="/sellers/:sellerId/workspace"
            element={(
              <LazyRoute>
                <SellerWorkspacePage />
              </LazyRoute>
            )}
          />
          <Route
            path="/admin-settings"
            element={(
              <LazyRoute>
                <AdminPanelPage />
              </LazyRoute>
            )}
          />
          <Route
            path="/admin/analytics"
            element={(
              <LazyRoute>
                <AnalyticsPage />
              </LazyRoute>
            )}
          />
          <Route
            path="/admin/audit-log"
            element={(
              <LazyRoute>
                <AuditLogPage />
              </LazyRoute>
            )}
          />
          <Route
            path="/admin/users"
            element={(
              <LazyRoute>
                <AdminUsersPage />
              </LazyRoute>
            )}
          />
          <Route
            path="/admin/rossko"
            element={(
              <LazyRoute>
                <RosskoSettingsPage />
              </LazyRoute>
            )}
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

// src/App.jsx
import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchProfile, logout } from './redux/slices/AuthSlice';
import { setAuthToken } from './utils/apiClient';
import { subscribeToPushNotifications } from './redux/slices/ChatSlice';
import { fetchPublicSiteConfig, fetchSiteQuickLinks } from './redux/slices/PublicInfoSlice';

import RouteFallback from './components/RouteFallback';
import RequireAuth from './components/auth/RequireAuth';
import CookieBanner from './components/Legal/CookieBanner';
import PullToRefresh from './components/PullToRefresh/PullToRefresh';
import MainLayout from './layouts/MainLayout';
import ProfileWithMenuLayout from './layouts/ProfileWithMenuLayout';
import { useShowSiteReviews, useShowWarehouseInventory } from './utils/siteReviewsPublic';
import { buildAutopartsRedirectSeo, PageSeoHelmet } from './utils/pageSeo';
import useSiteAnalytics from './hooks/useSiteAnalytics';

// Eager: публичный каталог и первый экран
import Authorization from './pages/Autorization/Authorization';
import PasswordReset from './pages/Autorization/PasswordReset/PasswordReset';
import AutoParts from './pages/AutoParts/AutoParts';
import Main from './pages/Main/Main';
import FindRedirectPage from './pages/Find/FindRedirectPage';
import CartPage from './pages/Cart/CartPage';

// Lazy: вторичные публичные страницы
const AboutCompany = lazy(() => import('./pages/About/AboutCompany'));
const DeliveryPage = lazy(() => import('./pages/About/DeliveryPage'));
const PaymentPage = lazy(() => import('./pages/About/PaymentPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/About/PrivacyPolicyPage'));
const PersonalDataConsentPage = lazy(() => import('./pages/About/PersonalDataConsentPage'));
const PublicOfferPage = lazy(() => import('./pages/About/PublicOfferPage'));
const CookiePolicyPage = lazy(() => import('./pages/About/CookiePolicyPage'));
const UsedPartsFiltersPage = lazy(() => import('./pages/AutoParts/UsedParts/UsedPartsFiltersPage'));
const NewPartsFiltersPage = lazy(() => import('./pages/AutoParts/NewParts/NewPartsFiltersPage'));
const NewPartDetailPage = lazy(() => import('./pages/AutoParts/NewParts/NewPartDetailPage'));
const NewPartOpenPage = lazy(() => import('./pages/AutoParts/NewParts/NewPartOpenPage'));
const NewPartsBrandLandingPage = lazy(() => import('./pages/AutoParts/NewParts/NewPartsBrandLandingPage'));
const NewPartsCategoryLandingPage = lazy(() => import('./pages/AutoParts/NewParts/NewPartsCategoryLandingPage'));
const UsedPartsBrandLandingPage = lazy(() => import('./pages/AutoParts/UsedParts/UsedPartsBrandLandingPage'));
const UsedPartsCategoryLandingPage = lazy(() => import('./pages/AutoParts/UsedParts/UsedPartsCategoryLandingPage'));
const UsedPartsGeoLandingPage = lazy(() => import('./pages/AutoParts/UsedParts/UsedPartsGeoLandingPage'));
const CatalogPage = lazy(() => import('./pages/Catalog/CatalogPage'));
const PartDetail = lazy(() => import('./pages/PartDetail/PartDetail'));
const NotFound = lazy(() => import('./pages/NotFound/NotFound'));
const ProductNotFound = lazy(() => import('./pages/Chat/ProductNotFound'));

// Lazy: кабинет продавца
const ProfilePage = lazy(() => import('./pages/Profile/ProfilePage'));
const NotificationSettingsPage = lazy(() => import('./pages/Profile/NotificationSettingsPage'));
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
const PurchasesOrdersPage = lazy(() => import('./pages/Sales/PurchasesOrdersPage'));
const SalesReturnsPage = lazy(() => import('./pages/Sales/SalesReturnsPage'));
const PurchasesReturnsPage = lazy(() => import('./pages/Sales/PurchasesReturnsPage'));
const ProfileFavoritesPage = lazy(() => import('./pages/Profile/ProfileFavoritesPage'));
const ProfileViewsPage = lazy(() => import('./pages/Profile/ProfileViewsPage'));
const ProfileSubscriptionsPage = lazy(() => import('./pages/Profile/ProfileSubscriptionsPage'));
const WarehouseSalesPage = lazy(() => import('./pages/Sales/WarehouseSalesPage'));
const FinancePage = lazy(() => import('./pages/Finance/FinancePage'));
const DashboardPage = lazy(() => import('./pages/Dashboard/DashboardPage'));
const EmployeesPage = lazy(() => import('./pages/Profile/EmployeesPage'));
const ClientsPage = lazy(() => import('./pages/Profile/ClientsPage'));
const StorageAddressesPage = lazy(() => import('./pages/Profile/StorageAddressesPage'));
const WmsStoragesPage = lazy(() => import('./pages/Warehouse/WmsStoragesPage'));
const WarehouseScanPage = lazy(() => import('./pages/Warehouse/WarehouseScanPage'));
const LabelQrResolvePage = lazy(() => import('./pages/Warehouse/LabelQrResolvePage'));
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
const SitePaymentsPage = lazy(() => import('./pages/Admin/SitePaymentsPage'));
const SitePaymentsHistoryPage = lazy(() => import('./pages/Admin/SitePaymentsHistoryPage'));
const AnalyticsPage = lazy(() => import('./pages/Admin/AnalyticsPage'));
const SeoSeedQueuePage = lazy(() => import('./pages/Admin/analytics/SeoSeedQueuePage'));

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
      const { chatId, url } = event.detail;
      if (url) {
        navigate(url, { state: { scrollToBottom: true } });
        return;
      }
      if (chatId) {
        console.log('[App] Navigating to chat from notification:', chatId);
        navigate(`/chats?source=garage&chatId=${chatId}`, { state: { scrollToBottom: true } });
      }
    };

    const handleNavigateToUrl = (event) => {
      const storedToken = localStorage.getItem('token');
      const { url } = event.detail;
      if (!url) return;
      const isPublicPath = url.startsWith('/part/') || url.startsWith('/autoparts');
      if (!storedToken && !isPublicPath) {
        navigate('/auth', { replace: true });
        return;
      }
      navigate(url);
    };

    window.addEventListener('navigateToChat', handleNavigateToChat);
    window.addEventListener('navigateToUrl', handleNavigateToUrl);

    return () => {
      window.removeEventListener('navigateToChat', handleNavigateToChat);
      window.removeEventListener('navigateToUrl', handleNavigateToUrl);
    };
  }, [navigate]);

  return null;
}

function SiteAnalyticsTracker() {
  useSiteAnalytics();
  return null;
}

function AutopartsRedirect() {
  const seo = buildAutopartsRedirectSeo();
  return (
    <>
      <PageSeoHelmet seo={seo} />
      <Navigate to="/autoparts/new" replace />
    </>
  );
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

function WarehouseInventoryRoute() {
  const showWarehouseInventory = useShowWarehouseInventory();
  if (!showWarehouseInventory) {
    return <Navigate to="/dashboard" replace />;
  }
  return (
    <LazyRoute>
      <WmsStoragesPage />
    </LazyRoute>
  );
}

function RedirectLegacyProfileRoute() {
  const { publicCode } = useParams();
  return <Navigate to={`/users/${encodeURIComponent(publicCode || '')}`} replace />;
}

function NotificationsBanner() {
  const { token, user } = useSelector((state) => state.auth);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!token || !user) {
      setVisible(false);
      return;
    }
    if (localStorage.getItem('notifications_banner_dismissed') === '1') {
      setVisible(false);
      return;
    }
    if (!('Notification' in window) || Notification.permission === 'granted') {
      setVisible(false);
      return;
    }
    setVisible(true);
  }, [token, user]);

  if (!visible) return null;

  return (
    <div className="border-b border-indigo-100 bg-indigo-50 px-4 py-2.5 text-sm text-indigo-900">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
        <span>Включите уведомления, чтобы не пропустить заказы и сообщения.</span>
        <div className="flex items-center gap-3">
          <a href="/profile/notifications" className="font-medium text-indigo-700 hover:underline">
            Настроить
          </a>
          <button
            type="button"
            onClick={() => {
              localStorage.setItem('notifications_banner_dismissed', '1');
              setVisible(false);
            }}
            className="text-indigo-600 hover:text-indigo-800"
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const dispatch = useDispatch();
  const { token, user } = useSelector((state) => state.auth);

  useEffect(() => {
    dispatch(fetchPublicSiteConfig());
    dispatch(fetchSiteQuickLinks());
  }, [dispatch]);

  useEffect(() => {
    if (!token) return undefined;

    let cancelled = false;
    const ensurePush = async () => {
      try {
        if (!user) {
          await dispatch(fetchProfile()).unwrap();
        }
        if (!cancelled) {
          dispatch(subscribeToPushNotifications({ prompt: false }));
        }
      } catch (error) {
        if (String(error || '').includes('401') || String(error || '').includes('Unauthorized')) {
          setAuthToken(null);
          dispatch(logout());
        }
      }
    };
    ensurePush();
    return () => {
      cancelled = true;
    };
  }, [dispatch, token, user]);

  return (
    <BrowserRouter>
      <PullToRefresh />
      <CookieBanner />
      <NotificationsBanner />
      <ServiceWorkerNavigationHandler />
      <SiteAnalyticsTracker />
      <Routes>
        <Route path="/auth" element={<Authorization />} />
        <Route path="/auth/password-reset" element={<PasswordReset />} />

        <Route path="/" element={<MainLayout />}>
          <Route index element={<Main />} />
          <Route path="/find" element={<FindRedirectPage />} />
          <Route path="/autoparts" element={<AutopartsRedirect />} />
          <Route path="/contacts" element={<Navigate to="/about" replace />} />
          <Route path="/autoparts/new/filters" element={<LazyRoute><NewPartsFiltersPage /></LazyRoute>} />
          <Route path="/autoparts/new" element={<AutoParts />} />
          <Route path="/autoparts/new/brand/:brandSlug" element={<LazyRoute><NewPartsBrandLandingPage /></LazyRoute>} />
          <Route path="/autoparts/new/category/:categorySlug" element={<LazyRoute><NewPartsCategoryLandingPage /></LazyRoute>} />
          <Route path="/autoparts/new/open" element={<LazyRoute><NewPartOpenPage /></LazyRoute>} />
          <Route path="/autoparts/new/part/:cardId" element={<LazyRoute><NewPartDetailPage /></LazyRoute>} />
          <Route path="/autoparts/used/filters" element={<LazyRoute><UsedPartsFiltersPage /></LazyRoute>} />
          <Route path="/autoparts/used" element={<AutoParts />} />
          <Route path="/autoparts/used/brand/:brandSlug" element={<LazyRoute><UsedPartsBrandLandingPage /></LazyRoute>} />
          <Route path="/autoparts/used/category/:categorySlug" element={<LazyRoute><UsedPartsCategoryLandingPage /></LazyRoute>} />
          <Route path="/autoparts/used/geo/:geoSlug" element={<LazyRoute><UsedPartsGeoLandingPage /></LazyRoute>} />
          <Route path="/catalog" element={<LazyRoute><CatalogPage /></LazyRoute>} />
          <Route path="/about" element={<LazyRoute><AboutCompany /></LazyRoute>} />
          <Route path="/privacy" element={<LazyRoute><PrivacyPolicyPage /></LazyRoute>} />
          <Route path="/personal-data-consent" element={<LazyRoute><PersonalDataConsentPage /></LazyRoute>} />
          <Route path="/offer" element={<LazyRoute><PublicOfferPage /></LazyRoute>} />
          <Route path="/cookie-policy" element={<LazyRoute><CookiePolicyPage /></LazyRoute>} />
          <Route path="/delivery" element={<LazyRoute><DeliveryPage /></LazyRoute>} />
          <Route path="/payment" element={<LazyRoute><PaymentPage /></LazyRoute>} />
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
            path="/qr/label/:code"
            element={(
              <LazyRoute>
                <LabelQrResolvePage />
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
          <Route path="/part/:productId" element={<LazyRoute><PartDetail /></LazyRoute>} />
          <Route path="/product-not-found" element={<LazyRoute><ProductNotFound /></LazyRoute>} />
          <Route path="*" element={<LazyRoute><NotFound /></LazyRoute>} />
        </Route>

        <Route element={<ProfileWithMenuLayout />}>
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
            path="/profile/notifications"
            element={(
              <LazyRoute>
                <NotificationSettingsPage />
              </LazyRoute>
            )}
          />
          <Route
            path="/profile/favorites"
            element={(
              <LazyRoute>
                <ProfileFavoritesPage />
              </LazyRoute>
            )}
          />
          <Route
            path="/profile/views"
            element={(
              <LazyRoute>
                <ProfileViewsPage />
              </LazyRoute>
            )}
          />
          <Route
            path="/profile/subscriptions"
            element={(
              <LazyRoute>
                <ProfileSubscriptionsPage />
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
            path="/my-parts/drafts/:draftId/edit"
            element={(
              <LazyRoute>
                <AddPart draftMode />
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
          <Route path="/purchases/favorites" element={<Navigate to="/profile/favorites" replace />} />
          <Route path="/purchases/history" element={<Navigate to="/profile/views" replace />} />
          <Route path="/purchases/subscriptions" element={<Navigate to="/profile/subscriptions" replace />} />
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
            path="/warehouse/inventory"
            element={<WarehouseInventoryRoute />}
          />
          <Route
            path="/warehouse/scan"
            element={(
              <LazyRoute>
                <WarehouseScanPage />
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
            path="/admin/analytics/seo/queue/:source"
            element={(
              <LazyRoute>
                <SeoSeedQueuePage />
              </LazyRoute>
            )}
          />
          <Route
            path="/admin/analytics/seo/queue"
            element={(
              <LazyRoute>
                <SeoSeedQueuePage />
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
          <Route
            path="/admin/site-payments/history"
            element={(
              <LazyRoute>
                <SitePaymentsHistoryPage />
              </LazyRoute>
            )}
          />
          <Route
            path="/admin/site-payments"
            element={(
              <LazyRoute>
                <SitePaymentsPage />
              </LazyRoute>
            )}
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

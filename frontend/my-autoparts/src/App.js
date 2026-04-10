// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useEffect } from 'react';
import { fetchProfile, logout } from './redux/slices/AuthSlice';

// Pages
import Authorization from './pages/Autorization/Authorization';
import MainLayout from './layouts/MainLayout';
import ProfileWithMenuLayout from './layouts/ProfileWithMenuLayout';
import ProfilePage from './pages/Profile/ProfilePage';
import PasswordReset from './pages/Autorization/PasswordReset/PasswordReset';
import Home from './pages/Home/Home';
import AutoParts from './pages/AutoParts/AutoParts';
import Main from './pages/Main/Main';
import MyParts from './pages/MyParts/MyParts';
import AddPart from './pages/MyParts/AddPart/AddPart';
import EditPart from './pages/MyParts/EditPart/EditPart';
import StockInList from './pages/StockIn/StockInList';
import { StockOutList } from './pages/StockOut';
import CartPage from './pages/Cart/CartPage';
import OrderRegistration from './pages/Cart/OrderRegistration';
import SalesOrdersPage from './pages/Sales/SalesOrdersPage';
import SalesReturnsPage from './pages/Sales/SalesReturnsPage';
import PurchasesOrdersPage from './pages/Sales/PurchasesOrdersPage';
import PurchasesReturnsPage from './pages/Sales/PurchasesReturnsPage';
import WarehouseSalesPage from './pages/Sales/WarehouseSalesPage';
import DashboardPage from './pages/Dashboard/DashboardPage';
import EmployeesPage from './pages/Profile/EmployeesPage';
import ClientsPage from './pages/Profile/ClientsPage';
import StorageAddressesPage from './pages/Profile/StorageAddressesPage';
import PendingSellersPage from './pages/Moderation/PendingSellersPage';
import ProductModeration from './pages/Moderation/ProductModeration/ProductModeration';
import SellersPage from './pages/Profile/SellersPage';
import Organization from './pages/Settings/Organization';
import PrintSettings from './pages/Settings/PrintSettings';
import IntegrationPage from './pages/Settings/IntegrationPage';
import NotFound from './pages/NotFound/NotFound';
import PartDetail from './pages/PartDetail/PartDetail';
import VehiclesList from './pages/Vehicles/VehiclesList';
import AddVehiclePage from './pages/Vehicles/AddVehiclePage';
import EditVehiclePage from './pages/Vehicles/EditVehiclePage';
import ChatsHubPage from './pages/Chat/ChatsHubPage';
import AdminPanelPage from './pages/Admin/AdminPanelPage';



// Component to handle Service Worker navigation messages
function ServiceWorkerNavigationHandler() {
  const navigate = useNavigate();
  
  useEffect(() => {
    const handleNavigateToChat = (event) => {
      const { chatId } = event.detail;
      console.log('[App] Navigating to chat from notification:', chatId);
      navigate(`/chats/${chatId}`);
    };
    
    window.addEventListener('navigateToChat', handleNavigateToChat);
    
    return () => {
      window.removeEventListener('navigateToChat', handleNavigateToChat);
    };
  }, [navigate]);
  
  return null; // This component doesn't render anything
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
      <Routes>
        {/* Публичные маршруты */}
        <Route path="/auth" element={<Authorization />} />
        <Route path="/auth/password-reset" element={<PasswordReset />} />

        {/* Основной layout — страницы без бокового меню */}
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Main />} />
          <Route path="/autoparts" element={<Navigate to="/autoparts/new" replace />} />
          <Route path="/autoparts/new" element={<AutoParts />} />
          <Route path="/autoparts/used" element={<AutoParts />} />
          <Route path="/autoservice" element={<Home />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/order-reg" element={<OrderRegistration />} />
          <Route path="/my-parts/add" element={<AddPart />} />
          <Route path="/my-parts/edit/:id" element={<EditPart />} />
          <Route path="/part/:productId" element={<PartDetail />} />

          <Route path="*" element={<NotFound />} />
        </Route>

        {/* Layout с боковым меню для страниц профиля */}
        <Route path="/" element={<ProfileWithMenuLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/my-parts" element={<MyParts />} />
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
          <Route path="/settings/employees" element={<EmployeesPage />} />
          <Route path="/chats" element={<ChatsHubPage />} />
          <Route path="/chats/:chatId" element={<ChatsHubPage />} />
          <Route path="/settings/storage-addresses" element={<StorageAddressesPage />} />
          <Route path="/settings/organization" element={<Organization />} />
          <Route path="/settings/printers" element={<PrintSettings />} />
          <Route path="/settings/integration" element={<IntegrationPage />} />
          <Route path="/moderation/pending-sellers" element={<PendingSellersPage />} />
          <Route path="/moderation/products" element={<ProductModeration />} />
          <Route path="/sellers" element={<SellersPage />} />
          <Route path="/admin-settings" element={<AdminPanelPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
// src/App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useEffect } from 'react';
import { fetchProfile } from './redux/slices/AuthSlice';

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


function App() {
  const dispatch = useDispatch();
  const { token } = useSelector((state) => state.auth);

  useEffect(() => {
    if (token) {
      dispatch(fetchProfile());
    }
  }, [dispatch, token]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Публичные маршруты */}
        <Route path="/auth" element={<Authorization />} />
        <Route path="/auth/password-reset" element={<PasswordReset />} />

        {/* Основной layout — страницы без бокового меню */}
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Main />} />
          <Route path="/autoparts" element={<AutoParts />} />
          <Route path="/autoservice" element={<Home />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/order-reg" element={<OrderRegistration />} />
          <Route path="/my-parts/add" element={<AddPart />} />
          <Route path="/my-parts/edit/:id" element={<EditPart />} />

          <Route path="*" element={<div>404</div>} />
        </Route>

        {/* Layout с боковым меню для страниц профиля */}
        <Route path="/" element={<ProfileWithMenuLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/my-parts" element={<MyParts />} />
          <Route path="/purchases/orders" element={<PurchasesOrdersPage />} />
          <Route path="/purchases/returns" element={<PurchasesReturnsPage />} />
          <Route path="/sales/orders" element={<SalesOrdersPage />} />
          <Route path="/sales/returns" element={<SalesReturnsPage />} />
          <Route path="/stock-in" element={<StockInList />} />
          <Route path="/stock-out" element={<StockOutList />} />
          <Route path="/warehouse-sales" element={<WarehouseSalesPage />} />
          <Route path="/settings/employees" element={<EmployeesPage />} />
          <Route path="/settings/clients" element={<ClientsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
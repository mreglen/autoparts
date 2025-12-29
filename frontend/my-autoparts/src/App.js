// src/App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useEffect } from 'react';
import { fetchProfile } from './redux/slices/AuthSlice';

// Pages
import Authorization from './pages/Autorization/Authorization';
import MainLayout from './layouts/MainLayout';
import ProfilePage from './pages/Profile/ProfilePage';
import PasswordReset from './pages/Autorization/PasswordReset/PasswordReset';
import Home from './pages/Home/Home';
import AutoParts from './pages/AutoParts/AutoParts';
import Main from './pages/Main/Main';
import MyParts from './pages/MyParts/MyParts';
import AddPart from './pages/MyParts/AddPart/AddPart';
import EditPart from './pages/MyParts/EditPart/EditPart';
import StockInList from './pages/StockIn/StockInList';
import StockOutList from './pages/StockOut/StockOut';
import CartPage from './pages/Cart/CartPage';
import OrderRegistration from './pages/Cart/OrderRegistration';
import SalesPage from './pages/Sales/SalesPage';
import PurchasesPage from './pages/Sales/PurchasesPage';


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

        {/* Основной layout — доступен всегда */}
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Main />} />
          <Route path="/profile" element={<ProfilePage />} />



          {/* Остальные маршруты */}
          <Route path="/autoparts" element={<AutoParts />} />
          <Route path="/autoservice" element={<Home />} />
          <Route path="/my-parts" element={<MyParts />} />
          <Route path="/my-parts/add" element={<AddPart />} />
          <Route path="/my-parts/edit/:id" element={<EditPart />} />
          <Route path="/stock-in" element={<StockInList />} />
          <Route path="/stock-out" element={<StockOutList />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/order-reg" element={<OrderRegistration />} />
          <Route path="/sales" element={<SalesPage />} />
          <Route path="/purchases" element={<PurchasesPage />} />

          <Route path="*" element={<div>404</div>} />

        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
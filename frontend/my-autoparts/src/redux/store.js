import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/AuthSlice';
import organizationReducer from './slices/OrganizationSlice'
import adminReducer from './slices/AdminSlice'
import userReducer from './slices/UserSlice'
import rosskoReducer from './slices/RosskoSlice'
import productReducer from './slices/ProductSlice';
import stockInReducer from './slices/StockInSlice';
import stockOutReducer from './slices/StockOutSlice';
import cartReducer from './slices/CartSlice';
import clientReducer from './slices/ClientSlice';
import storageCellsReducer from './slices/StorageCellsSlice';
import moderationReducer from './slices/ModerationSlice';
import sellersReducer from './slices/SellerSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    organization: organizationReducer,
    admin: adminReducer,
    user: userReducer,
    rossko: rosskoReducer,
    products: productReducer,
    stockIn: stockInReducer,
    stockOut: stockOutReducer,
    cart: cartReducer,
    clients: clientReducer,
    storageCells: storageCellsReducer,
    moderation: moderationReducer,
    sellers: sellersReducer,
  },
});
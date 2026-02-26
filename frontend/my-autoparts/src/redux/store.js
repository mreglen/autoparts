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
import pendingProductStorageCellsReducer from './slices/PendingProductStorageCellsSlice';

import moderationReducer from './slices/ModerationSlice';
import moderationProductsReducer from './slices/ModerationProductsSlice';
import sellersReducer from './slices/SellerSlice';
import publicInfoReducer from './slices/PublicInfoSlice';

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
    pendingProductStorageCells: pendingProductStorageCellsReducer,

    moderation: moderationReducer,
    moderationProducts: moderationProductsReducer,
    sellers: sellersReducer,
    publicInfo: publicInfoReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['auth/login/rejected', 'auth/register/rejected', 'auth/seller/register/rejected', 'auth/fetchProfile/rejected', 'auth/requestPasswordReset/rejected', 'auth/confirmPasswordReset/rejected', 'auth/sendVerificationCode/rejected', 'auth/verifyEmailCode/rejected', 'auth/completeRegistration/rejected', 'auth/registerSeller/rejected'],
        ignoredActionPaths: ['error', 'payload', 'meta.arg'],
        ignoredPaths: ['auth.error'],
      },
    }),
});
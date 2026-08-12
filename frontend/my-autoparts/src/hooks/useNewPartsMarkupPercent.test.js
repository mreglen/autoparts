import { renderHook, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import publicInfoReducer from '../redux/slices/PublicInfoSlice';
import useNewPartsMarkupPercent from './useNewPartsMarkupPercent';
import {
  SELLER_AUTOSERVICE_MODE_AUTOSERVICE,
  SELLER_AUTOSERVICE_MODE_SELLER,
  setSellerAutoserviceMode,
} from '../utils/sellerAutoserviceMode';

const BUYER = 30;
const SELLER = 15;
const AUTOSERVICE = 7;

function makeStore({ user = null, adminSellerMarkupContext = null } = {}) {
  return configureStore({
    reducer: {
      publicInfo: publicInfoReducer,
      auth: (state = { user, adminSellerMarkupContext }) => state,
    },
    preloadedState: {
      publicInfo: {
        newPartsMarkupPercent: BUYER,
        sellerMarkupPercent: SELLER,
        autoserviceMarkupPercent: AUTOSERVICE,
        adminSellerMarkupContext,
      },
      auth: { user },
    },
  });
}

function renderMarkup(context, options) {
  const store = makeStore(options);
  const wrapper = ({ children }) => <Provider store={store}>{children}</Provider>;
  return renderHook(() => useNewPartsMarkupPercent(context), { wrapper });
}

const guest = null;
const buyerUser = { id: 1, is_buyer: true };
const sellerUser = { id: 2, is_seller: true, organization_id: 'ORG-1' };
const autoserviceUser = {
  id: 3,
  is_seller: true,
  organization_id: 'ORG-2',
  organization_is_autoservice: true,
};

beforeEach(() => {
  setSellerAutoserviceMode(SELLER_AUTOSERVICE_MODE_SELLER);
});

describe('useNewPartsMarkupPercent: наценки не влияют друг на друга', () => {
  it('гость в публичном каталоге видит наценку покупателя', () => {
    expect(renderMarkup('auto', { user: guest }).result.current).toBe(BUYER);
  });

  it('покупатель без организации видит наценку покупателя', () => {
    expect(renderMarkup('auto', { user: buyerUser }).result.current).toBe(BUYER);
  });

  it('продавец видит наценку продавца, а не покупателя', () => {
    expect(renderMarkup('auto', { user: sellerUser }).result.current).toBe(SELLER);
  });

  it('автосервис в режиме «Автосервис» видит наценку автосервиса', () => {
    setSellerAutoserviceMode(SELLER_AUTOSERVICE_MODE_AUTOSERVICE);
    expect(renderMarkup('auto', { user: autoserviceUser }).result.current).toBe(AUTOSERVICE);
  });

  it('автосервис в режиме «Продавец» видит наценку продавца', () => {
    setSellerAutoserviceMode(SELLER_AUTOSERVICE_MODE_SELLER);
    expect(renderMarkup('auto', { user: autoserviceUser }).result.current).toBe(SELLER);
  });

  it('явные контексты игнорируют пользователя', () => {
    expect(renderMarkup('public', { user: autoserviceUser }).result.current).toBe(BUYER);
    expect(renderMarkup('autoservice', { user: guest }).result.current).toBe(AUTOSERVICE);
    expect(renderMarkup('seller', { user: guest }).result.current).toBe(SELLER);
  });

  it('админ в кабинете продавца видит наценку этого продавца', () => {
    const { result } = renderMarkup('auto', {
      user: { id: 4, is_admin: true },
      adminSellerMarkupContext: { sellerId: 2, markupPercent: 42 },
    });
    expect(result.current).toBe(42);
  });

  it('переключение режима пересчитывает наценку без перемонтирования', () => {
    const { result } = renderMarkup('auto', { user: autoserviceUser });
    expect(result.current).toBe(SELLER);

    act(() => setSellerAutoserviceMode(SELLER_AUTOSERVICE_MODE_AUTOSERVICE));
    expect(result.current).toBe(AUTOSERVICE);

    act(() => setSellerAutoserviceMode(SELLER_AUTOSERVICE_MODE_SELLER));
    expect(result.current).toBe(SELLER);
  });
});

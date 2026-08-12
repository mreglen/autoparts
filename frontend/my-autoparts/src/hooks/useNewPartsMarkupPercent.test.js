import { renderHook } from '@testing-library/react';
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
      auth: (state = { user }) => state,
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

function markupFor(context, options) {
  const store = makeStore(options);
  const wrapper = ({ children }) => <Provider store={store}>{children}</Provider>;
  return renderHook(() => useNewPartsMarkupPercent(context), { wrapper }).result.current;
}

const guest = null;
const buyerUser = { id: 1, is_buyer: true };
const sellerUser = { id: 2, is_seller: true, organization_id: 'ORG-1' };
// organization_is_autoservice приходит с backend уже с учётом паузы
const autoserviceUser = {
  id: 3,
  is_seller: true,
  organization_id: 'ORG-2',
  organization_is_autoservice: true,
};
const pausedAutoserviceUser = { ...autoserviceUser, organization_is_autoservice: false };

beforeEach(() => {
  setSellerAutoserviceMode(SELLER_AUTOSERVICE_MODE_SELLER);
});

describe('useNewPartsMarkupPercent: наценки не влияют друг на друга', () => {
  it('гость в публичном каталоге видит наценку покупателя', () => {
    expect(markupFor('auto', { user: guest })).toBe(BUYER);
  });

  it('покупатель без организации видит наценку покупателя', () => {
    expect(markupFor('auto', { user: buyerUser })).toBe(BUYER);
  });

  it('продавец видит наценку продавца, а не покупателя', () => {
    expect(markupFor('auto', { user: sellerUser })).toBe(SELLER);
  });

  it('явные контексты игнорируют пользователя', () => {
    expect(markupFor('public', { user: autoserviceUser })).toBe(BUYER);
    expect(markupFor('autoservice', { user: guest })).toBe(AUTOSERVICE);
    expect(markupFor('seller', { user: guest })).toBe(SELLER);
  });

  it('админ в кабинете продавца видит наценку этого продавца', () => {
    expect(
      markupFor('auto', {
        user: { id: 4, is_admin: true },
        adminSellerMarkupContext: { sellerId: 2, markupPercent: 42 },
      }),
    ).toBe(42);
  });
});

describe('useNewPartsMarkupPercent: подключённый автосервис', () => {
  it('получает наценку автосервиса в режиме меню «Продавец»', () => {
    setSellerAutoserviceMode(SELLER_AUTOSERVICE_MODE_SELLER);
    expect(markupFor('auto', { user: autoserviceUser })).toBe(AUTOSERVICE);
  });

  it('получает наценку автосервиса в режиме меню «Автосервис»', () => {
    setSellerAutoserviceMode(SELLER_AUTOSERVICE_MODE_AUTOSERVICE);
    expect(markupFor('auto', { user: autoserviceUser })).toBe(AUTOSERVICE);
  });

  it('наценка автосервиса ниже наценки продавца и покупателя', () => {
    const autoservice = markupFor('auto', { user: autoserviceUser });
    expect(autoservice).toBeLessThan(markupFor('auto', { user: sellerUser }));
    expect(autoservice).toBeLessThan(markupFor('auto', { user: guest }));
  });

  it('на паузе возвращается к наценке продавца', () => {
    expect(markupFor('auto', { user: pausedAutoserviceUser })).toBe(SELLER);
  });

  it('приоритетнее контекста админа по продавцу', () => {
    expect(
      markupFor('auto', {
        user: autoserviceUser,
        adminSellerMarkupContext: { sellerId: 2, markupPercent: 42 },
      }),
    ).toBe(AUTOSERVICE);
  });

  it('в контексте seller тоже получает наценку автосервиса', () => {
    expect(markupFor('seller', { user: autoserviceUser })).toBe(AUTOSERVICE);
  });
});

describe('useNewPartsMarkupPercent: индивидуальная наценка организации', () => {
  it('приоритетнее автоматической наценки автосервиса', () => {
    expect(
      markupFor('auto', {
        user: {
          ...autoserviceUser,
          organization_new_parts_markup_tier: 'buyer',
        },
      }),
    ).toBe(BUYER);
  });

  it('приоритетнее контекста админа по продавцу', () => {
    expect(
      markupFor('auto', {
        user: {
          ...sellerUser,
          organization_new_parts_markup_tier: 'autoservice',
        },
        adminSellerMarkupContext: { sellerId: 2, markupPercent: 42 },
      }),
    ).toBe(AUTOSERVICE);
  });
});

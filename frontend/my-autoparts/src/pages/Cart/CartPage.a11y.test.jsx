import React from 'react';
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

vi.mock('../../hooks/useNetworkStatus', () => ({ default: () => ({ offline: false }) }));

const mockDispatch = vi.fn(() => ({
  unwrap: () => Promise.resolve(),
}));

vi.mock('react-redux', () => ({
  useDispatch: () => mockDispatch,
  useSelector: (selector) => selector({
    cart: {
      cart: {
        new_parts_items: [],
        used_parts_items: [],
        new_parts_baskets: [{ id: 1, name: 'Корзина 1', is_default: true, items: [] }],
      },
      loading: false,
      error: null,
      quantityUpdatingIds: [],
      newPartsBaskets: [{ id: 1, name: 'Корзина 1', is_default: true, items: [] }],
      activeBasketId: 1,
    },
    auth: { token: null, user: null, permissionCodes: [] },
    clientMarkup: { displayMode: 'purchase_only' },
  }),
}));

vi.mock('../../redux/slices/CartSlice', async () => ({
  ...(await vi.importActual('../../redux/slices/CartSlice')),
  fetchCart: vi.fn(() => ({ type: 'cart/fetchCart/fulfilled' })),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/cart', search: '', hash: '', state: null }),
}), { virtual: true });

// eslint-disable-next-line import/first
import CartPage from './CartPage';

describe('CartPage accessibility', () => {
  it('empty loaded cart has no serious or critical axe violations', async () => {
    const { container } = render(<CartPage />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

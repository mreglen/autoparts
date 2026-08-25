import React from 'react';
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

jest.mock('../../hooks/useNetworkStatus', () => () => ({ offline: false }));

const mockDispatch = jest.fn(() => ({
  unwrap: () => Promise.resolve(),
}));

jest.mock('react-redux', () => ({
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

jest.mock('../../redux/slices/CartSlice', () => ({
  ...jest.requireActual('../../redux/slices/CartSlice'),
  fetchCart: jest.fn(() => ({ type: 'cart/fetchCart/fulfilled' })),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
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

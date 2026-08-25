import React from 'react';
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

jest.mock('react-redux', () => ({
  useDispatch: () => jest.fn(() => ({ unwrap: () => Promise.resolve() })),
  useSelector: (selector) => selector({
    auth: { loading: false, error: null },
  }),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
  useLocation: () => ({ state: null }),
  Link: ({ children, to }) => <a href={to}>{children}</a>,
}), { virtual: true });

// eslint-disable-next-line import/first
import Login from './Login';

describe('Login accessibility', () => {
  it('login form has no serious or critical axe violations', async () => {
    const { container } = render(<Login />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

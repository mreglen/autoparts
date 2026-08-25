import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

jest.mock('react-redux', () => ({
  useSelector: (selector) => selector({
    auth: { token: null, user: null },
  }),
}));

jest.mock('../../hooks/useSelectedCity', () => ({
  useSelectedCity: () => ({
    city: 'Москва',
    isModalOpen: false,
    openModal: jest.fn(),
    closeModal: jest.fn(),
    selectCity: jest.fn(),
    cities: [],
    citiesStatus: 'idle',
    citiesError: null,
    loadCities: jest.fn(),
  }),
}));

jest.mock('../../utils/siteReviewsPublic', () => ({
  useShowYandexBadge: () => false,
}));

jest.mock('../../utils/pwaStandalone', () => ({
  PWA_START_PATH: '/autoparts/new',
  usePwaStandalone: () => false,
}));

jest.mock('../../hooks/useHistoryBack', () => () => jest.fn());

jest.mock('../Header/headerPrimitives', () => ({
  HeaderAvatar: () => <span data-testid="header-avatar" />,
  HeaderCityChip: ({ city }) => <button type="button">{city}</button>,
  HeaderIconButton: ({ children, label, onClick }) => (
    <button type="button" aria-label={label} onClick={onClick}>{children}</button>
  ),
  HeaderLogo: () => <span data-testid="header-logo">Logo</span>,
}));

jest.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => jest.fn(),
  useLocation: () => ({ pathname: '/autoparts/new' }),
}), { virtual: true });

// eslint-disable-next-line import/first
import MobileHeader from './MobileHeader';

describe('MobileHeader accessibility', () => {
  it('home header has banner landmark and search control', async () => {
    const { container } = render(<MobileHeader onMenuClick={() => {}} />);

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /поиск в каталоге/i })).toBeInTheDocument();

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

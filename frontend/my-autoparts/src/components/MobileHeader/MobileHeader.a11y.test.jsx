import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

vi.mock('react-redux', () => ({
  useSelector: (selector) => selector({
    auth: { token: null, user: null },
  }),
}));

vi.mock('../../hooks/useSelectedCity', () => ({
  useSelectedCity: () => ({
    city: 'Москва',
    isModalOpen: false,
    openModal: vi.fn(),
    closeModal: vi.fn(),
    selectCity: vi.fn(),
    cities: [],
    citiesStatus: 'idle',
    citiesError: null,
    loadCities: vi.fn(),
  }),
}));

vi.mock('../../utils/siteReviewsPublic', () => ({
  useShowYandexBadge: () => false,
}));

vi.mock('../../utils/pwaStandalone', () => ({
  PWA_START_PATH: '/autoparts/new',
  usePwaStandalone: () => false,
}));

vi.mock('../../hooks/useHistoryBack', () => ({ default: () => vi.fn() }));

vi.mock('../Header/headerPrimitives', () => ({
  HeaderAvatar: () => <span data-testid="header-avatar" />,
  HeaderCityChip: ({ city }) => <button type="button">{city}</button>,
  HeaderIconButton: ({ children, label, onClick }) => (
    <button type="button" aria-label={label} onClick={onClick}>{children}</button>
  ),
  HeaderLogo: () => <span data-testid="header-logo">Logo</span>,
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => vi.fn(),
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

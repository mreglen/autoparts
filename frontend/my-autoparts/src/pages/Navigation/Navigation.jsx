import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, NavLink, Link } from 'react-router-dom';
import { logout } from '../../redux/slices/AuthSlice';
import { selectCartSummary } from '../../redux/slices/CartSlice';
import { fetchAdminOrganizationPhone } from '../../redux/slices/PublicInfoSlice';
import { fetchUnreadCount } from '../../redux/slices/ChatSlice';
import { selectTotalUnreadCount } from '../../utils/chatUnread';
import Search from './Search/Search';
import { useShowSiteReviews, useShowYandexBadge } from '../../utils/siteReviewsPublic';
import HeaderYandexBadge from '../../components/Seo/HeaderYandexBadge';
import CitySelectModal from '../../components/CitySelectModal/CitySelectModal';
import { useSelectedCity } from '../../hooks/useSelectedCity';
import { Button } from '../../components/UI';
import {
  HEADER_CONTENT_CLASS,
  HeaderAvatar,
  HeaderCityChip,
  HeaderIconButton,
  HeaderLogo,
} from '../../components/Header/headerPrimitives';

const formatPhoneNumber = (phone) => {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('7') || digits.startsWith('8')) {
    digits = '7' + digits.slice(1);
  }
  let formatted = '+7 ';
  if (digits.length > 1) formatted += '(' + digits.slice(1, 4);
  if (digits.length > 4) formatted += ') ' + digits.slice(4, 7);
  if (digits.length > 7) formatted += '-' + digits.slice(7, 9);
  if (digits.length > 9) formatted += '-' + digits.slice(9, 11);
  return formatted;
};

function DesktopNavLink({ to, children, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `rounded-sg px-3 py-1.5 text-sm font-medium transition-colors ${
          isActive
            ? 'bg-brand-50 text-brand-700'
            : 'text-ink-muted hover:bg-surface-subtle hover:text-ink'
        }`
      }
    >
      {children}
    </NavLink>
  );
}

export default function Navigation() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, token } = useSelector((state) => state.auth);
  const cartData = useSelector(selectCartSummary);
  const { adminOrganizationPhone } = useSelector((state) => state.publicInfo);
  const totalUnreadCount = useSelector(selectTotalUnreadCount);
  const showNewAutoparts = useSelector((state) => state.publicInfo.showNewAutoparts !== false);
  const showSiteReviews = useShowSiteReviews();
  const showYandexBadge = useShowYandexBadge();
  const {
    city: selectedCity,
    isModalOpen: isCityModalOpen,
    openModal: openCityModal,
    closeModal: closeCityModal,
    selectCity,
    cities,
    citiesStatus,
    citiesError,
    loadCities,
  } = useSelectedCity();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [closeTimeout, setCloseTimeout] = useState(null);

  useEffect(() => {
    dispatch(fetchAdminOrganizationPhone());
    if (token) dispatch(fetchUnreadCount());
  }, [dispatch, token]);

  const handleLogout = () => {
    dispatch(logout());
    setIsProfileOpen(false);
    navigate('/', { replace: true });
  };

  const handleMouseEnter = () => {
    if (closeTimeout) {
      clearTimeout(closeTimeout);
      setCloseTimeout(null);
    }
    setIsProfileOpen(true);
  };

  const handleMouseLeave = () => {
    const timeout = setTimeout(() => setIsProfileOpen(false), 150);
    setCloseTimeout(timeout);
  };

  useEffect(
    () => () => {
      if (closeTimeout) clearTimeout(closeTimeout);
    },
    [closeTimeout]
  );

  const firstName = user?.first_name || 'Пользователь';
  const fullName = `${user?.last_name || ''} ${user?.first_name || ''} ${user?.patronymic || ''}`.trim();
  const profilePath = '/profile';

  const formatCartLine = (count, price) => {
    const amount = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(price);
    return `${count}шт Х ${amount} Р`;
  };

  return (
    <>
    <header className="fixed inset-x-0 top-0 z-50 border-b border-line bg-surface">
      {showYandexBadge ? <HeaderYandexBadge /> : null}
      <div className="border-b border-line bg-surface-subtle">
        <div className={`flex h-9 items-center justify-between gap-4 ${HEADER_CONTENT_CLASS}`}>
          <div className="flex min-w-0 items-center gap-3 text-xs text-ink-muted">
            <HeaderCityChip
              city={selectedCity}
              onClick={openCityModal}
              isOpen={isCityModalOpen}
            />
            {adminOrganizationPhone?.organization_phone && (
              <>
                <span className="hidden text-line-strong sm:inline">|</span>
                <a
                  href={`tel:${adminOrganizationPhone.organization_phone.replace(/\D/g, '')}`}
                  className="hidden items-center gap-1.5 font-medium text-ink-soft transition hover:text-brand-600 sm:inline-flex"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  {formatPhoneNumber(adminOrganizationPhone.organization_phone)}
                </a>
              </>
            )}
          </div>

          <nav className="flex shrink-0 items-center gap-0.5">
            {showNewAutoparts && (
              <DesktopNavLink to="/autoparts/new">Новые запчасти</DesktopNavLink>
            )}
            <DesktopNavLink to="/autoparts/used">Б/У</DesktopNavLink>
            <DesktopNavLink to="/delivery">Доставка</DesktopNavLink>
            {showSiteReviews && <DesktopNavLink to="/reviews">Отзывы</DesktopNavLink>}
            <DesktopNavLink to="/payment">Оплата</DesktopNavLink>
            <DesktopNavLink to="/about">О компании</DesktopNavLink>
            <DesktopNavLink to="/organizations">Организации</DesktopNavLink>
          </nav>
        </div>
      </div>

      <div className={HEADER_CONTENT_CLASS}>
        <div className="flex h-[4.25rem] min-w-0 w-full items-center gap-4 lg:gap-5">
          <HeaderLogo wordmarkClassName="hidden xl:block" />

          <Button as={NavLink} to="/catalog" size="sm" className="shrink-0">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            Каталог
          </Button>

          <div className="min-w-0 flex-1">
            <Search />
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <Link
              to="/cart"
              aria-label="Корзина"
              className="relative hidden items-center gap-2 rounded-sg border border-line bg-surface-muted px-3 py-2 text-sm transition hover:border-brand-200 hover:bg-brand-50/50 sm:flex"
            >
              <svg className="h-5 w-5 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {cartData.itemCount > 0 ? (
                <span className="whitespace-nowrap font-medium text-ink">
                  {formatCartLine(cartData.itemCount, cartData.totalPrice)}
                </span>
              ) : (
                <span className="font-medium text-ink-soft">Корзина</span>
              )}
            </Link>

            <HeaderIconButton to="/cart" label="Корзина" className="sm:hidden">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </HeaderIconButton>

            {token && user ? (
              <>
                <HeaderIconButton to="/chats" label="Чаты" badge={totalUnreadCount}>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </HeaderIconButton>

                <div
                  className="relative ml-1 flex items-center"
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                >
                  <Link
                    to={profilePath}
                    aria-label="Профиль"
                    className="flex items-center gap-2 rounded-sg border border-line py-1 pl-1 pr-3 transition hover:border-brand-200 hover:bg-surface-subtle"
                  >
                    <HeaderAvatar initial={firstName} size="sm" />
                    <span className="hidden max-w-[120px] truncate text-sm font-medium text-ink lg:block">
                      {firstName}
                    </span>
                  </Link>

                  {isProfileOpen && (
                    <div className="absolute right-0 top-[calc(100%+6px)] w-80 overflow-hidden rounded-sg-lg border border-line bg-surface shadow-sg-md">
                      <Link
                        to={profilePath}
                        onClick={() => setIsProfileOpen(false)}
                        className="block border-b border-line bg-brand-50 px-4 py-4 transition hover:bg-brand-100"
                      >
                        <div className="flex items-center gap-3">
                          <HeaderAvatar initial={firstName} size="lg" />
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-ink">{fullName || firstName}</p>
                            {user.organization_name && (
                              <p className="truncate text-xs text-ink-muted">{user.organization_name}</p>
                            )}
                          </div>
                        </div>
                      </Link>

                      <div className="space-y-0.5 p-2 text-sm text-ink-muted">
                        {user.phone && (
                          <p className="flex items-center gap-2 px-3 py-1.5">
                            <svg className="h-4 w-4 shrink-0 text-ink-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            <span className="truncate">{user.phone}</span>
                          </p>
                        )}
                        {user.email && (
                          <p className="flex items-center gap-2 px-3 py-1.5">
                            <svg className="h-4 w-4 shrink-0 text-ink-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            <span className="truncate">{user.email}</span>
                          </p>
                        )}
                      </div>

                      <div className="border-t border-line p-2">
                        <button
                          type="button"
                          onClick={() => {
                            setIsProfileOpen(false);
                            navigate(profilePath);
                          }}
                          className="flex w-full items-center gap-2 rounded-sg px-3 py-2 text-sm font-medium text-ink-soft hover:bg-surface-subtle"
                        >
                          Личный кабинет
                        </button>
                        <button
                          type="button"
                          onClick={handleLogout}
                          className="flex w-full items-center gap-2 rounded-sg px-3 py-2 text-sm font-medium text-danger hover:bg-danger-50"
                        >
                          Выйти
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <Button as={NavLink} to="/auth" variant="secondary" size="sm" className="shrink-0">
                Войти
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
    <CitySelectModal
      isOpen={isCityModalOpen}
      onClose={closeCityModal}
      selectedCity={selectedCity}
      cities={cities}
      citiesStatus={citiesStatus}
      citiesError={citiesError}
      onSelect={selectCity}
      onRetry={loadCities}
    />
    </>
  );
}

import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, NavLink, Link } from 'react-router-dom';
import { logout } from '../../redux/slices/AuthSlice';
import { selectCart } from '../../redux/slices/CartSlice';
import { fetchAdminOrganizationPhone } from '../../redux/slices/PublicInfoSlice';
import { fetchUnreadCount } from '../../redux/slices/ChatSlice';
import Search from './Search/Search';
import { useShowSiteReviews } from '../../utils/siteReviewsPublic';

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
        `rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
          isActive
            ? 'bg-indigo-50 text-indigo-700'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`
      }
    >
      {children}
    </NavLink>
  );
}

function HeaderBadge({ count }) {
  if (!count || count <= 0) return null;
  return (
    <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
      {count > 99 ? '99+' : count}
    </span>
  );
}

function HeaderIconLink({ to, label, badge, children }) {
  return (
    <Link
      to={to}
      aria-label={label}
      className="relative flex h-10 w-10 items-center justify-center rounded-xl text-gray-600 transition hover:bg-gray-100 hover:text-indigo-600"
    >
      {children}
      <HeaderBadge count={badge} />
    </Link>
  );
}

export default function Navigation() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, token } = useSelector((state) => state.auth);
  const cart = useSelector(selectCart);
  const { adminOrganizationPhone } = useSelector((state) => state.publicInfo);
  const { chats } = useSelector((state) => state.chats);
  const { chats: avitoChats } = useSelector((state) => state.avitoChats);
  const showNewAutoparts = useSelector((state) => state.publicInfo.showNewAutoparts !== false);
  const showSiteReviews = useShowSiteReviews();

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

  const cartData = useMemo(() => {
    if (!cart) return { itemCount: 0, totalPrice: 0 };
    const newPartsCount = cart.new_parts_items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
    const newPartsPrice =
      cart.new_parts_items?.reduce((sum, item) => sum + item.price * item.quantity, 0) || 0;
    const usedPartsCount = cart.used_parts_items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
    const usedPartsPrice =
      cart.used_parts_items?.reduce(
        (sum, item) => sum + (item.price || 0) * item.quantity,
        0
      ) || 0;
    return {
      itemCount: newPartsCount + usedPartsCount,
      totalPrice: newPartsPrice + usedPartsPrice,
    };
  }, [cart]);

  const garageUnreadCount = useMemo(() => {
    if (!chats?.length) return 0;
    return chats.reduce((total, chat) => {
      if (chat.unread_count) return total + chat.unread_count;
      if (chat.last_message && !chat.last_message.is_read && chat.last_message.sender_id !== user?.id) {
        return total + 1;
      }
      return total;
    }, 0);
  }, [chats, user?.id]);

  const avitoUnreadCount = useMemo(() => {
    if (!avitoChats?.length) return 0;
    return avitoChats.reduce((total, chat) => {
      if (chat.unread_count) return total + chat.unread_count;
      if (chat.has_unread_messages) return total + 1;
      return total;
    }, 0);
  }, [avitoChats]);

  const totalUnreadCount = garageUnreadCount + avitoUnreadCount;

  const formatPrice = (price) =>
    new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(
      price
    );

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90">
      {/* Верхняя полоска: контакты и навигация */}
      <div className="border-b border-gray-100 bg-gray-50/90">
        <div className="mx-auto flex h-9 max-w-7xl items-center justify-between gap-4 px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-3 text-xs text-gray-600">
            <span className="inline-flex items-center gap-1.5">
              <svg className="h-3.5 w-3.5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              г. Екатеринбург
            </span>
            {adminOrganizationPhone?.organization_phone && (
              <>
                <span className="hidden text-gray-300 sm:inline">|</span>
                <a
                  href={`tel:${adminOrganizationPhone.organization_phone.replace(/\D/g, '')}`}
                  className="hidden items-center gap-1.5 font-medium text-gray-700 transition hover:text-indigo-600 sm:inline-flex"
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

      {/* Основная строка */}
      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        <div className="flex h-[4.25rem] items-center gap-4 lg:gap-5">
          <NavLink to="/" className="flex shrink-0 items-center gap-2.5">
            <img src="/img/LogoWithoutBg.png" alt="Свой Гараж" className="h-9 w-auto" />
            <div className="hidden leading-tight text-blue-900 xl:block">
              <span className="block text-sm font-bold">Свой</span>
              <span className="block text-sm font-bold">Гараж</span>
            </div>
          </NavLink>

          <NavLink
            to="/catalog"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            Каталог
          </NavLink>

          <div className="min-w-0 flex-1 max-w-2xl">
            <Search />
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
            {token && user ? (
              <>
                <HeaderIconLink to="/chats" label="Чаты" badge={totalUnreadCount}>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </HeaderIconLink>

                <Link
                  to="/cart"
                  aria-label="Корзина"
                  className="relative hidden items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm transition hover:border-indigo-200 hover:bg-indigo-50/50 sm:flex"
                >
                  <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  {cartData.itemCount > 0 ? (
                    <span className="flex flex-col items-start leading-tight">
                      <span className="text-xs text-gray-500">{cartData.itemCount} шт.</span>
                      <span className="font-semibold text-gray-900">{formatPrice(cartData.totalPrice)}</span>
                    </span>
                  ) : (
                    <span className="font-medium text-gray-700">Корзина</span>
                  )}
                  <HeaderBadge count={cartData.itemCount} />
                </Link>

                <Link
                  to="/cart"
                  aria-label="Корзина"
                  className="relative flex h-10 w-10 items-center justify-center rounded-xl text-gray-600 transition hover:bg-gray-100 hover:text-indigo-600 sm:hidden"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <HeaderBadge count={cartData.itemCount} />
                </Link>

                <div
                  className="relative ml-1 flex items-center"
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                >
                  <Link
                    to={profilePath}
                    aria-label="Профиль"
                    className="flex items-center gap-2 rounded-xl border border-gray-200 py-1.5 pl-1.5 pr-3 transition hover:border-indigo-200 hover:bg-gray-50"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 text-sm font-semibold text-white">
                      {firstName.charAt(0).toUpperCase()}
                    </span>
                    <span className="hidden max-w-[120px] truncate text-sm font-medium text-gray-800 lg:block">
                      {firstName}
                    </span>
                  </Link>
                  <button
                    type="button"
                    aria-label="Меню аккаунта"
                    aria-expanded={isProfileOpen}
                    className="ml-0.5 hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 lg:flex"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {isProfileOpen && (
                    <div className="absolute right-0 top-[calc(100%+6px)] w-80 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
                      <Link
                        to={profilePath}
                        onClick={() => setIsProfileOpen(false)}
                        className="block border-b border-gray-100 bg-gradient-to-br from-indigo-50/80 to-white px-4 py-4 transition hover:bg-indigo-50/90"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-lg font-semibold text-white">
                            {firstName.charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-gray-900">{fullName || firstName}</p>
                            {user.organization_name && (
                              <p className="truncate text-xs text-gray-500">{user.organization_name}</p>
                            )}
                          </div>
                        </div>
                      </Link>

                      <div className="space-y-0.5 p-2 text-sm text-gray-600">
                        {user.phone && (
                          <p className="flex items-center gap-2 px-3 py-1.5">
                            <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            <span className="truncate">{user.phone}</span>
                          </p>
                        )}
                        {user.email && (
                          <p className="flex items-center gap-2 px-3 py-1.5">
                            <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            <span className="truncate">{user.email}</span>
                          </p>
                        )}
                      </div>

                      <div className="border-t border-gray-100 p-2">
                        <button
                          type="button"
                          onClick={() => {
                            setIsProfileOpen(false);
                            navigate(profilePath);
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Личный кабинет
                        </button>
                        <button
                          type="button"
                          onClick={handleLogout}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                        >
                          Выйти
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <NavLink
                to="/auth"
                className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                Войти
              </NavLink>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

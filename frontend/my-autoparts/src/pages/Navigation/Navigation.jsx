// src/pages/Navigation/Navigation.jsx
import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, NavLink, Link } from 'react-router-dom';
import { logout } from '../../redux/slices/AuthSlice';
import { selectCart } from '../../redux/slices/CartSlice';
import { fetchAdminOrganizationPhone } from '../../redux/slices/PublicInfoSlice';
import { fetchUnreadCount } from '../../redux/slices/ChatSlice';
import Search from './Search/Search';
import MobileBottomNav from '../../components/MobileBottomNav/MobileBottomNav';

const formatPhoneNumber = (phone) => {
    if (!phone) return '';

    // Удаляем все нецифровые символы
    let digits = phone.replace(/\D/g, '');

    // Если начинается с 7 или 8, заменяем на 7
    if (digits.startsWith('7') || digits.startsWith('8')) {
        digits = '7' + digits.slice(1);
    }

    // Форматируем как +7 (XXX) XXX-XX-XX
    let formatted = '+7 ';
    if (digits.length > 1) {
        formatted += '(' + digits.slice(1, 4);
    }
    if (digits.length > 4) {
        formatted += ') ' + digits.slice(4, 7);
    }
    if (digits.length > 7) {
        formatted += '-' + digits.slice(7, 9);
    }
    if (digits.length > 9) {
        formatted += '-' + digits.slice(9, 11);
    }

    return formatted;
};


export default function Navigation() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { user, token, permissionCodes } = useSelector((state) => state.auth);
    const cart = useSelector(selectCart);
    const { adminOrganizationPhone } = useSelector((state) => state.publicInfo);
    const { unreadCount } = useSelector((state) => state.chats);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [closeTimeout, setCloseTimeout] = useState(null);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Helper to check if user has specific permission
    const hasPermission = (code) => {
        return permissionCodes && permissionCodes.includes(code);
    };

    // Fetch admin organization phone on component mount
    useEffect(() => {
        dispatch(fetchAdminOrganizationPhone());
        if (token) {
            dispatch(fetchUnreadCount());
        }
    }, [dispatch, token]);

    const handleLogout = () => {
        dispatch(logout());
        setIsProfileOpen(false);
        setIsMobileMenuOpen(false);
        navigate('/', { replace: true });
    };

    const closeMobileMenu = () => {
        setIsMobileMenuOpen(false);
    };

    const handleMouseEnter = () => {
        if (closeTimeout) {
            clearTimeout(closeTimeout);
            setCloseTimeout(null);
        }
        setIsProfileOpen(true);
    };

    const handleMouseLeave = () => {
        const timeout = setTimeout(() => {
            setIsProfileOpen(false);
        }, 150); // Небольшая задержка для плавности
        setCloseTimeout(timeout);
    };

    // Очистка таймаута при размонтировании
    useEffect(() => {
        return () => {
            if (closeTimeout) {
                clearTimeout(closeTimeout);
            }
        };
    }, [closeTimeout]);

    // Закрытие мобильного меню при клике вне его
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (isMobileMenuOpen && !event.target.closest('header')) {
                setIsMobileMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isMobileMenuOpen]);

    const firstName = user?.first_name || 'Пользователь';
    const fullName = `${user?.last_name || ''} ${user?.first_name || ''} ${user?.patronymic || ''}`.trim();
    // Для директоров и сотрудников показываем только имя, для остальных - название организации или имя
    const displayName = (user?.is_director || user?.is_employee) ? (firstName) : (user?.organization_name || firstName);

    // Расчет данных корзины
    const cartData = React.useMemo(() => {
        if (!cart) {
            return { itemCount: 0, totalPrice: 0 };
        }

        // Подсчет новых запчастей
        const newPartsCount = cart.new_parts_items ?
            cart.new_parts_items.reduce((sum, item) => sum + item.quantity, 0) : 0;
        const newPartsPrice = cart.new_parts_items ?
            cart.new_parts_items.reduce((sum, item) => sum + (item.price * item.quantity), 0) : 0;

        // Подсчет б/у запчастей
        const usedPartsCount = cart.used_parts_items ?
            cart.used_parts_items.reduce((sum, item) => sum + item.quantity, 0) : 0;
        const usedPartsPrice = cart.used_parts_items ?
            cart.used_parts_items.reduce((sum, item) => sum + ((item.price || 0) * item.quantity), 0) : 0;

        // Общие значения
        const itemCount = newPartsCount + usedPartsCount;
        const totalPrice = newPartsPrice + usedPartsPrice;

        return { itemCount, totalPrice };
    }, [cart]);

    const formatPrice = (price) => {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB'
        }).format(price);
    };

    return (
        <header className="bg-white shadow-md">
            {/* Десктопная версия */}
            <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 hidden md:block">
                {/* Верхняя строка: локация + навигация */}
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2">
                        <img
                            src="/img/location_on_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg"
                            alt="Локация"
                            className="filter invert w-5 h-5"
                        />
                        <p className="text-sm sm:text-lg">г. Екатеринбург</p>
                        {adminOrganizationPhone?.organization_phone && (
                            <>
                                <span className="text-sm sm:text-lg text-gray-400 mx-2">|</span>
                                <a
                                    href={`tel:${adminOrganizationPhone.organization_phone.replace(/\D/g, '')}`}
                                    className="text-sm sm:text-lg text-gray-600 hover:text-indigo-600 transition-colors flex items-center gap-1"
                                >
                                    <img
                                        src="/img/telephone-1.svg"
                                        alt="Телефон"
                                        className="w-4 h-4 sm:w-5 sm:h-5"
                                    />
                                    {formatPhoneNumber(adminOrganizationPhone.organization_phone)}
                                </a>
                            </>
                        )}
                    </div>

                    {/* Десктопное меню */}
                    <nav className="flex flex-wrap justify-center gap-4">
                        {/* Всегда видимые пункты */}
                        <NavLink
                            to="/autoparts/new"
                            className={({ isActive }) =>
                                `text-lg transition-colors ease-in-out ${isActive ? 'text-indigo-700 font-medium' : 'text-gray-700 hover:text-indigo-600'
                                }`}
                        >
                            Автозапчасти
                        </NavLink>
                        <NavLink
                            to="/autoservice"
                            className={({ isActive }) =>
                                `text-lg transition-colors ease-in-out ${isActive ? 'text-indigo-700 font-medium' : 'text-gray-700 hover:text-indigo-600'
                                }`}
                        >
                            Сервис
                        </NavLink>
                    </nav>
                </div>

                {/* Основная часть */}
                <div className="flex flex-col lg:flex-row justify-between items-center gap-4 lg:gap-6 pb-4">
                    {/* Логотип + каталог */}
                    <div className="flex items-center gap-6">
                        <NavLink to="/" className="flex items-center gap-3">
                            <img src="/img/LogoWithoutBg.png" alt="Логотип" className="h-10 w-auto" />
                            <div className="flex flex-col text-blue-900">
                                <p className="font-bold">Свой</p>
                                <p className="font-bold">гараж</p>
                            </div>
                        </NavLink>

                        <NavLink to="/catalog">
                            <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition">
                                Каталог
                            </button>
                        </NavLink>
                    </div>

                    {/* Поиск */}
                    <Search />

                    {/* Профиль / Вход */}
                    <div className="flex items-center gap-3 sm:gap-6 relative">
                        {token && user ? (
                            <div
                                className="relative"
                                onMouseEnter={handleMouseEnter}
                                onMouseLeave={handleMouseLeave}
                            >
                                <button
                                    className="flex items-center gap-2 text-sm sm:text-base font-bold text-gray-700 hover:text-indigo-600 whitespace-nowrap"
                                >
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold">
                                        {firstName.charAt(0).toUpperCase()}
                                    </div>
                                </button>

                                {isProfileOpen && (
                                    <div
                                        className="absolute right-0 top-full w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-2"
                                    >
                                        {/* Информация о пользователе */}
                                        <div className="px-4 py-3 border-b border-gray-200">
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold text-lg">
                                                    {firstName.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="font-semibold text-gray-900">{fullName}</p>
                                                </div>
                                            </div>
                                            <div className="text-sm text-gray-600 space-y-1">
                                                {user.phone && (
                                                    <div className="flex items-center gap-2">
                                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                                        </svg>
                                                        <span>{user.phone}</span>
                                                    </div>
                                                )}
                                                {user.email && (
                                                    <div className="flex items-center gap-2">
                                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                                        </svg>
                                                        <span>{user.email}</span>
                                                    </div>
                                                )}
                                                {user.organization_name && (
                                                    <div className="flex items-center gap-2">
                                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                                        </svg>
                                                        <span>{user.organization_name}</span>
                                                    </div>
                                                )}
                                                {user.organization_id && (
                                                    <div className="flex items-center gap-2">
                                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                                                        </svg>
                                                        <span className="text-xs text-gray-500">ID: {user.organization_id}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Выход */}
                                        <button
                                            onClick={handleLogout}
                                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                        >
                                            <div className="flex items-center gap-2">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                                </svg>
                                                <span>Выход</span>
                                            </div>
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <NavLink to="/auth" className="flex flex-col items-center justify-center text-center text-xs sm:text-sm text-gray-700 hover:text-indigo-600">
                                <img src="/img/log-in-1.svg" alt="Войти" className="w-5 h-5 sm:w-6 sm:h-6" />
                                <p className="font-bold">Войти</p>
                            </NavLink>
                        )}

                        {/* Иконка чата */}
                        {token && (
                            <Link to="/chats" className="flex items-center justify-center text-gray-700 hover:text-indigo-600 transition-colors">
                                <div className="relative">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                    </svg>
                                    {unreadCount > 0 && (
                                        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                                            {unreadCount}
                                        </span>
                                    )}
                                </div>
                            </Link>
                        )}

                        <Link to="/cart" className="flex items-center justify-center text-gray-700 hover:text-indigo-600 transition-colors">
                            <div className="relative">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                {cartData.itemCount > 0 && (
                                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                                        {cartData.itemCount}
                                    </span>
                                )}
                            </div>
                        </Link>
                    </div>
                </div>
            </div>

            {/* Мобильная версия - локация и телефон над поиском */}
            <div className="md:hidden bg-white border-b border-gray-200 px-3 py-2">
                <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-1">
                        <img
                            src="/img/location_on_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg"
                            alt="Локация"
                            className="filter invert w-4 h-4"
                        />
                        <p className="text-sm">г. Екатеринбург</p>
                    </div>
                    {adminOrganizationPhone?.organization_phone && (
                        <a
                            href={`tel:${adminOrganizationPhone.organization_phone.replace(/\D/g, '')}`}
                            className="flex items-center gap-1 text-sm text-gray-600 hover:text-indigo-600 transition-colors"
                        >
                            <img
                                src="/img/telephone-1.svg"
                                alt="Телефон"
                                className="w-4 h-4"
                            />
                            <span>{formatPhoneNumber(adminOrganizationPhone.organization_phone)}</span>
                        </a>
                    )}
                </div>
                <Search />
            </div>

            {/* Мобильная нижняя навигация */}
            <MobileBottomNav />
        </header>
    );
}
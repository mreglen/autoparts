// src/pages/Navigation/Navigation.jsx
import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, NavLink } from 'react-router-dom';
import { logout } from '../../redux/slices/AuthSlice';
import { selectCart } from '../../redux/slices/CartSlice';
import Search from './Search/Search';


export default function Navigation() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { user, token } = useSelector((state) => state.auth);
    const cart = useSelector(selectCart);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [closeTimeout, setCloseTimeout] = useState(null);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

    const fullName = `${user?.last_name || ''} ${user?.first_name || ''} ${user?.patronymic || ''}`.trim();
    // Для директоров показываем ФИО, для остальных - название организации или ФИО
    const displayName = user?.is_director ? (fullName || 'Директор') : (user?.organization_name || fullName || 'Пользователь');

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
            <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6">
                {/* Верхняя строка: локация + навигация */}
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2">
                        <img
                            src="/img/location_on_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg"
                            alt="Локация"
                            className="filter invert w-5 h-5"
                        />
                        <p className="text-sm sm:text-lg">г. Екатеринбург</p>
                    </div>

                    {/* Десктопное меню */}
                    <nav className="hidden md:flex flex-wrap justify-center gap-4">
                        {/* Всегда видимые пункты */}
                        <NavLink
                            to="/autoparts"
                            className={({ isActive }) =>
                                `text-lg transition-colors ease-in-out ${
                                    isActive ? 'text-indigo-700 font-medium' : 'text-gray-700 hover:text-indigo-600'
                                }`}
                        >
                            Автозапчасти
                        </NavLink>
                        <NavLink
                            to="/autoservice"
                            className={({ isActive }) =>
                                `text-lg transition-colors ease-in-out ${
                                    isActive ? 'text-indigo-700 font-medium' : 'text-gray-700 hover:text-indigo-600'
                                }`}
                        >
                            Сервис
                        </NavLink>



                    </nav>

                    {/* Мобильное бургер-меню */}
                    <div className="md:hidden">
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="p-2 rounded-md text-gray-700 hover:text-indigo-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
                        >
                            <svg
                                className="h-6 w-6"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                {isMobileMenuOpen ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                )}
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Основная часть */}
                <div className="flex flex-col lg:flex-row justify-between items-center gap-4 lg:gap-6 pb-4">
                    {/* Логотип + каталог */}
                    <div className="flex items-center gap-6">
                        <NavLink to="/" className="flex items-center gap-3">
                            <img src="/img/orig 1.png" alt="Логотип" className="h-10 w-auto" />
                            <div className="flex flex-col">
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
                        {token ? (
                            <div
                                className="relative"
                                onMouseEnter={handleMouseEnter}
                                onMouseLeave={handleMouseLeave}
                            >
                                <button
                                    className="text-xs sm:text-sm font-bold text-gray-700 hover:text-indigo-600 whitespace-nowrap"
                                >
                                    {displayName}
                                </button>

                                {isProfileOpen && (
                                    <div
                                        className="absolute right-0 top-full w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-2"
                                    >
                                        <div className="px-4 py-2 border-b border-gray-200">
                                            <div className="text-xs text-gray-500">
                                                {user.phone && <div>{user.phone}</div>}
                                                {user.email && <div>{user.email}</div>}
                                                {user.organization_name && <div>Название: {user.organization_name}</div>}
                                                {user.organization_id && <div>ID организации: {user.organization_id}</div>}
                                            </div>
                                        </div>

                                        {/* Для продавцов - Главная и Клиенты */}
                                        {user?.is_seller && (
                                            <>
                                                <button
                                                    onClick={() => {
                                                        setIsProfileOpen(false);
                                                        navigate('/dashboard');
                                                    }}
                                                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                                >
                                                    Главная
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setIsProfileOpen(false);
                                                        navigate('/clients');
                                                    }}
                                                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 border-t border-gray-200"
                                                >
                                                    Клиенты
                                                </button>
                                            </>
                                        )}



                                        {/* Покупки */}
                                        <div className="px-4 py-1">
                                            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Покупки</div>
                                            <button
                                                onClick={() => {
                                                    setIsProfileOpen(false);
                                                    navigate('/purchases/orders');
                                                }}
                                                className="block w-full text-left px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded"
                                            >
                                                Заказы
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setIsProfileOpen(false);
                                                    navigate('/purchases/returns');
                                                }}
                                                className="block w-full text-left px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded"
                                            >
                                                Возвраты
                                            </button>
                                        </div>

                                        {/* Для продавцов - Продажи */}
                                        {user?.is_seller && (
                                            <div className="px-4 py-1 border-t border-gray-100">
                                                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Продажи</div>
                                                <button
                                                    onClick={() => {
                                                        setIsProfileOpen(false);
                                                        navigate('/sales/orders');
                                                    }}
                                                    className="block w-full text-left px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded"
                                                >
                                                    Заказы покупателей
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setIsProfileOpen(false);
                                                        navigate('/sales/returns');
                                                    }}
                                                    className="block w-full text-left px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded"
                                                >
                                                    Возвраты покупателей
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setIsProfileOpen(false);
                                                        navigate('/warehouse-sales');
                                                    }}
                                                    className="block w-full text-left px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded"
                                                >
                                                    Продажи со склада
                                                </button>
                                            </div>
                                        )}

                                        {/* Для продавцов - Склад */}
                                        {user?.is_seller && (
                                            <div className="px-4 py-1 border-t border-gray-100">
                                                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Склад</div>
                                                <button
                                                    onClick={() => {
                                                        setIsProfileOpen(false);
                                                        navigate('/my-parts');
                                                    }}
                                                    className="block w-full text-left px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded"
                                                >
                                                    Мои запчасти
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setIsProfileOpen(false);
                                                        navigate('/stock-in');
                                                    }}
                                                    className="block w-full text-left px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded"
                                                >
                                                    Поступление
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setIsProfileOpen(false);
                                                        navigate('/stock-out');
                                                    }}
                                                    className="block w-full text-left px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded"
                                                >
                                                    Расходы
                                                </button>
                                            </div>
                                        )}



                                        {/* Настройки для директоров и продавцов */}
                                        {(user?.is_director || user?.is_seller) && (
                                            <div className="px-4 py-1 border-t border-gray-100">
                                                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Настройки</div>
                                                {user?.is_director && (
                                                    <>
                                                        <button
                                                            onClick={() => {
                                                                setIsProfileOpen(false);
                                                                navigate('/profile');
                                                            }}
                                                            className="block w-full text-left px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded"
                                                        >
                                                            Профиль
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setIsProfileOpen(false);
                                                                navigate('/settings/employees');
                                                            }}
                                                            className="block w-full text-left px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded"
                                                        >
                                                            Сотрудники
                                                        </button>
                                                    </>
                                                )}
                                                <button
                                                    onClick={() => {
                                                        setIsProfileOpen(false);
                                                        navigate('/settings/storage-addresses');
                                                    }}
                                                    className="block w-full text-left px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded"
                                                >
                                                    Адресное хранение
                                                </button>
                                            </div>
                                        )}

                                        {/* Выход */}
                                        <button
                                            onClick={handleLogout}
                                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 border-t border-gray-200"
                                        >
                                            Выход
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <NavLink to="/auth" className="flex flex-col items-center justify-center text-center text-xs sm:text-sm text-gray-700 hover:text-indigo-600">
                                <img src="/img/log-in 1.svg" alt="Войти" className="w-5 h-5 sm:w-6 sm:h-6" />
                                <p className="font-bold">Войти</p>
                            </NavLink>
                        )}

                        <NavLink to="/cart" className="flex flex-col items-center justify-center text-center text-xs sm:text-sm text-gray-700 hover:text-indigo-600">
                            <div className="relative">
                                <img src="/img/cart.svg" alt="Корзина" className="w-5 h-5 sm:w-6 sm:h-6 filter brightness-0" />
                                {cartData.itemCount > 0 && (
                                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center font-bold">
                                        {cartData.itemCount}
                                    </span>
                                )}
                            </div>
                            <p className="font-bold">Корзина</p>
                            {cartData.itemCount > 0 && (
                                <p className="text-xs text-indigo-600 font-medium hidden sm:block">
                                    {formatPrice(cartData.totalPrice)}
                                </p>
                            )}
                        </NavLink>
                    </div>
                </div>
            </div>

            {/* Мобильное меню */}
            {isMobileMenuOpen && (
                <div className="md:hidden bg-white border-t border-gray-200">
                    <div className="px-0.5 py-1 space-y-2">
                        {/* Основные пункты меню */}
                        <NavLink
                            to="/autoparts"
                            onClick={closeMobileMenu}
                            className={({ isActive }) =>
                                `block px-1 py-1 text-lg font-medium rounded-lg min-h-[48px] flex items-center ${
                                    isActive ? 'text-indigo-700 bg-indigo-50' : 'text-gray-700 hover:text-indigo-600 hover:bg-gray-50'
                                }`
                            }
                        >
                            Автозапчасти
                        </NavLink>
                        <NavLink
                            to="/autoservice"
                            onClick={closeMobileMenu}
                            className={({ isActive }) =>
                                `block px-1 py-1 text-lg font-medium rounded-lg min-h-[48px] flex items-center ${
                                    isActive ? 'text-indigo-700 bg-indigo-50' : 'text-gray-700 hover:text-indigo-600 hover:bg-gray-50'
                                }`
                            }
                        >
                            Сервис
                        </NavLink>


                        {/* Дополнительные пункты для всех авторизованных */}
                        {token && (
                            <>
                                <div className="border-t border-gray-200 my-4"></div>
                                <NavLink
                                    to="/profile"
                                    onClick={closeMobileMenu}
                                    className={({ isActive }) =>
                                        `block px-1 py-1 text-lg font-medium rounded-lg min-h-[48px] flex items-center ${
                                            isActive ? 'text-indigo-700 bg-indigo-50' : 'text-gray-700 hover:text-indigo-600 hover:bg-gray-50'
                                        }`
                                    }
                                >
                                    Профиль
                                </NavLink>
                                <button
                                    onClick={handleLogout}
                                    className="block w-full text-left px-1 py-1 text-lg font-medium text-gray-700 hover:text-indigo-600 hover:bg-gray-50 rounded-lg min-h-[48px] flex items-center"
                                >
                                    Выход
                                </button>
                            </>
                        )}

                        {/* Кнопка входа для неавторизованных */}
                        {!token && (
                            <NavLink
                                to="/auth"
                                onClick={closeMobileMenu}
                                className="block px-1 py-1 text-lg font-medium text-gray-700 hover:text-indigo-600 hover:bg-gray-50 rounded-lg min-h-[48px] flex items-center"
                            >
                                Войти
                            </NavLink>
                        )}
                    </div>
                </div>
            )}
        </header>
    );
}
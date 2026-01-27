// src/pages/Navigation/Navigation.jsx
import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, NavLink } from 'react-router-dom';
import { logout } from '../../redux/slices/AuthSlice';
import { selectCart } from '../../redux/slices/CartSlice';
import { fetchAdminOrganizationPhone } from '../../redux/slices/PublicInfoSlice';
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
    const { user, token } = useSelector((state) => state.auth);
    const cart = useSelector(selectCart);
    const { adminOrganizationPhone } = useSelector((state) => state.publicInfo);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [closeTimeout, setCloseTimeout] = useState(null);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Fetch admin organization phone on component mount
    useEffect(() => {
        dispatch(fetchAdminOrganizationPhone());
    }, [dispatch]);

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
                                        src="/img/telephone 1.svg"
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
                        {token && user ? (
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
                                        
                                        {/* Для админов - Продавцы */}
                                        {user?.is_admin && (
                                            <button
                                                onClick={() => {
                                                    setIsProfileOpen(false);
                                                    navigate('/sellers');
                                                }}
                                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 border-t border-gray-200"
                                            >
                                                Продавцы
                                            </button>
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

                                        {/* Модерация для админов */}
                                        {user?.is_admin && (
                                            <div className="px-4 py-1 border-t border-gray-100">
                                                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Модерация</div>
                                                <button
                                                    onClick={() => {
                                                        setIsProfileOpen(false);
                                                        navigate('/moderation/pending-sellers');
                                                    }}
                                                    className="block w-full text-left px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded"
                                                >
                                                    Регистрация продавцов
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setIsProfileOpen(false);
                                                        navigate('/moderation/products');
                                                    }}
                                                    className="block w-full text-left px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded"
                                                >
                                                    Проверка запчастей
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
                                src="/img/telephone 1.svg"
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
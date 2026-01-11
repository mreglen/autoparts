// src/components/SideMenu/SideMenu.jsx
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, NavLink } from 'react-router-dom';
import { logout } from '../../redux/slices/AuthSlice';

const menuItems = [
    { name: 'Клиенты', path: '/clients' },
    { name: 'Сотрудники', path: '/employees' },
];

const sellerMenuItems = [
    { name: 'Мои запчасти', path: '/my-parts' },
    { name: 'Поступление', path: '/stock-in' },
    { name: 'Расходы', path: '/stock-out' },
];

export default function SideMenu({ isOpen, onClose }) {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { user, token } = useSelector((state) => state.auth);

    const handleLogout = () => {
        dispatch(logout());
        onClose();
        navigate('/', { replace: true });
    };

    // Формируем ФИО пользователя
    const fullName = `${user?.last_name || ''} ${user?.first_name || ''} ${user?.patronymic || ''}`.trim();

    // Убираем автозакрытие меню при клике на ссылки

    if (!isOpen || !token) {
        return null;
    }

    return (
        <>
            {/* Overlay для мобильных устройств */}
            <div
                className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
                onClick={onClose}
            />

            {/* Боковое меню */}
            <div className="fixed top-0 left-0 h-full w-80 bg-white shadow-xl z-50 transform transition-transform duration-300 ease-in-out">
                {/* Заголовок меню */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div className="flex flex-col">
                        <h2 className="text-lg font-semibold text-gray-800">
                            {fullName || 'Пользователь'}
                        </h2>
                        {user?.organization_name && (
                            <p className="text-sm text-gray-600 mt-1">
                                {user.organization_name}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <svg
                            className="h-6 w-6"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Содержимое меню */}
                <div className="flex flex-col h-full overflow-y-auto">
                    <nav className="flex-1 px-4 py-6 space-y-2">
                        {/* Пункт Главная */}
                        <NavLink
                            to="/dashboard"
                            className={({ isActive }) =>
                                `block px-4 py-3 text-lg font-medium rounded-lg transition-colors duration-200 ${
                                    isActive ? 'text-indigo-700 bg-indigo-50' : 'text-gray-700 hover:text-indigo-600 hover:bg-gray-50'
                                }`
                            }
                        >
                            Главная
                        </NavLink>

                        {/* Пункт Покупки для всех авторизованных пользователей */}
                        <NavLink
                            to="/purchases"
                            className={({ isActive }) =>
                                `block px-4 py-3 text-lg font-medium rounded-lg transition-colors duration-200 ${
                                    isActive ? 'text-indigo-700 bg-indigo-50' : 'text-gray-700 hover:text-indigo-600 hover:bg-gray-50'
                                }`
                            }
                        >
                            Покупки
                        </NavLink>

                        {/* Пункт Продажи только для админов */}
                        {user?.is_admin && (
                            <NavLink
                                to="/sales"
                                className={({ isActive }) =>
                                    `block px-4 py-3 text-lg font-medium rounded-lg transition-colors duration-200 ${
                                        isActive ? 'text-indigo-700 bg-indigo-50' : 'text-gray-700 hover:text-indigo-600 hover:bg-gray-50'
                                    }`
                                }
                            >
                                Продажи
                            </NavLink>
                        )}

                        {/* Пункты только для продавцов */}
                        {user?.is_seller && sellerMenuItems.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                className={({ isActive }) =>
                                    `block px-4 py-3 text-lg font-medium rounded-lg transition-colors duration-200 ${
                                        isActive ? 'text-indigo-700 bg-indigo-50' : 'text-gray-700 hover:text-indigo-600 hover:bg-gray-50'
                                    }`
                                }
                            >
                                {item.name}
                            </NavLink>
                        ))}

                        {/* Разделитель */}
                        {(menuItems.length > 0 || (user?.is_admin || user?.is_seller)) && (
                            <div className="border-t border-gray-200 my-4"></div>
                        )}

                        {/* Дополнительные пункты для всех авторизованных */}
                        {menuItems.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                className={({ isActive }) =>
                                    `block px-4 py-3 text-lg font-medium rounded-lg transition-colors duration-200 ${
                                        isActive ? 'text-indigo-700 bg-indigo-50' : 'text-gray-700 hover:text-indigo-600 hover:bg-gray-50'
                                    }`
                                }
                            >
                                {item.name}
                            </NavLink>
                        ))}

                        {/* Профиль */}
                        <NavLink
                            to="/profile"
                            className={({ isActive }) =>
                                `block px-4 py-3 text-lg font-medium rounded-lg transition-colors duration-200 ${
                                    isActive ? 'text-indigo-700 bg-indigo-50' : 'text-gray-700 hover:text-indigo-600 hover:bg-gray-50'
                                }`
                            }
                        >
                            Профиль
                        </NavLink>
                    </nav>

                    {/* Кнопка выхода */}
                    <div className="border-t border-gray-200 p-4">
                        <button
                            onClick={handleLogout}
                            className="w-full text-left px-4 py-3 text-lg font-medium text-gray-700 hover:text-indigo-600 hover:bg-gray-50 rounded-lg transition-colors duration-200"
                        >
                            Выход
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}

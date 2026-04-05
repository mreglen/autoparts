// src/components/MobileBottomNav/MobileBottomNav.jsx
import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { isAutopartsNavActive, useAutopartsLandingPath, useShowNewAutoparts } from '../../utils/autopartsPublic';

export default function MobileBottomNav() {
    const { user, token } = useSelector((state) => state.auth);
    const cart = useSelector((state) => state.cart);
    const navigate = useNavigate();
    const location = useLocation();
    const autopartsPath = useAutopartsLandingPath();
    const showNewAutoparts = useShowNewAutoparts();
    const autopartsNavActive = isAutopartsNavActive(location.pathname, showNewAutoparts);

    // Расчет данных корзины
    const cartData = React.useMemo(() => {
        if (!cart) {
            return { itemCount: 0 };
        }

        // Подсчет новых запчастей
        const newPartsCount = cart.new_parts_items ? 
            cart.new_parts_items.reduce((sum, item) => sum + item.quantity, 0) : 0;

        // Подсчет б/у запчастей
        const usedPartsCount = cart.used_parts_items ? 
            cart.used_parts_items.reduce((sum, item) => sum + item.quantity, 0) : 0;

        // Общее количество
        const itemCount = newPartsCount + usedPartsCount;

        return { itemCount };
    }, [cart]);

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
            <div className="grid grid-cols-5 gap-1 p-2">
                {/* Главная */}
                <div className="flex flex-col items-center justify-center py-2">
                    <button 
                        onClick={() => navigate('/')}
                        className="flex flex-col items-center justify-center w-full h-full text-gray-700 hover:text-indigo-600 focus:outline-none"
                    >
                        <div className="w-6 h-6 mb-1">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                        </div>
                        <span className="text-xs font-medium">Главная</span>
                    </button>
                </div>

                {/* Автозапчасти */}
                <div className="flex flex-col items-center justify-center py-2">
                    <NavLink 
                        to={autopartsPath}
                        className={`flex flex-col items-center justify-center w-full h-full ${
                            autopartsNavActive ? 'text-indigo-600' : 'text-gray-700 hover:text-indigo-600'
                        }`}
                    >
                        <div className="w-6 h-6 mb-1">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                            </svg>
                        </div>
                        <span className="text-xs font-medium">Запчасти</span>
                    </NavLink>
                </div>

                {/* Профиль / Вход */}
                <div className="flex flex-col items-center justify-center py-2">
                    {token && user ? (
                        <button 
                            onClick={() => navigate('/profile')}
                            className="flex flex-col items-center justify-center w-full h-full text-gray-700 hover:text-indigo-600 focus:outline-none"
                        >
                            <div className="w-6 h-6 mb-1">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </div>
                            <span className="text-xs font-medium">Профиль</span>
                        </button>
                    ) : (
                        <NavLink 
                            to="/auth" 
                            className="flex flex-col items-center justify-center w-full h-full text-gray-700 hover:text-indigo-600"
                        >
                            <div className="w-6 h-6 mb-1">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                                </svg>
                            </div>
                            <span className="text-xs font-medium">Войти</span>
                        </NavLink>
                    )}
                </div>

                {/* Сервис */}
                <div className="flex flex-col items-center justify-center py-2">
                    <NavLink 
                        to="/autoservice"
                        className={({ isActive }) => 
                            `flex flex-col items-center justify-center w-full h-full ${
                                isActive ? 'text-indigo-600' : 'text-gray-700 hover:text-indigo-600'
                            }`
                        }
                    >
                        <div className="w-6 h-6 mb-1">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </div>
                        <span className="text-xs font-medium">Сервис</span>
                    </NavLink>
                </div>

                {/* Корзина */}
                <div className="flex flex-col items-center justify-center py-2 relative">
                    <NavLink 
                        to="/cart" 
                        className="flex flex-col items-center justify-center w-full h-full text-gray-700 hover:text-indigo-600"
                    >
                        <div className="w-6 h-6 mb-1 relative">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            {cartData.itemCount > 0 && (
                                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                                    {cartData.itemCount}
                                </span>
                            )}
                        </div>
                        <span className="text-xs font-medium">Корзина</span>
                    </NavLink>
                </div>
            </div>
        </div>
    );
}
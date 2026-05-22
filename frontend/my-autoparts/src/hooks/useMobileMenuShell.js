import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
    getActiveTabFromPath,
    getAvailableTabs,
    getPathForTab,
} from '../pages/Profile/menu/profileMenuConfig';

export function useMobileMenuShell(userOverride) {
    const location = useLocation();
    const navigate = useNavigate();
    const { user: authUser, token, permissionCodes } = useSelector((state) => state.auth);
    const user = userOverride ?? authUser;
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const activeTab = getActiveTabFromPath(location.pathname, user);
    const tabs = getAvailableTabs(user, permissionCodes);

    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [location.pathname]);

    const openMenu = useCallback(() => setIsMobileMenuOpen(true), []);
    const closeMenu = useCallback(() => setIsMobileMenuOpen(false), []);

    const handleTabChange = useCallback(
        (tabId) => {
            const path = getPathForTab(tabId);
            if (path) {
                navigate(path);
            }
            setIsMobileMenuOpen(false);
        },
        [navigate]
    );

    const guestContent = useMemo(
        () => (
            <div className="flex flex-col gap-3 p-1">
                <button
                    type="button"
                    onClick={() => {
                        navigate('/auth');
                        setIsMobileMenuOpen(false);
                    }}
                    className="min-h-[44px] w-full rounded-xl bg-indigo-600 py-3 font-bold text-white active:bg-indigo-700"
                >
                    Войти
                </button>
                <button
                    type="button"
                    onClick={() => {
                        navigate('/autoparts/new');
                        setIsMobileMenuOpen(false);
                    }}
                    className="min-h-[44px] w-full rounded-xl border border-gray-200 py-3 font-bold text-gray-800 active:bg-gray-50"
                >
                    Поиск запчастей
                </button>
                <button
                    type="button"
                    onClick={() => {
                        navigate('/autoservice');
                        setIsMobileMenuOpen(false);
                    }}
                    className="min-h-[44px] w-full rounded-xl border border-gray-200 py-3 font-bold text-gray-800 active:bg-gray-50"
                >
                    Сервис
                </button>
            </div>
        ),
        [navigate]
    );

    return {
        token,
        user,
        tabs,
        activeTab,
        isMobileMenuOpen,
        setIsMobileMenuOpen,
        openMenu,
        closeMenu,
        handleTabChange,
        guestContent,
    };
}

export function getPageTitle(pathname) {
    if (pathname === '/') return 'Главная';
    if (pathname.endsWith('/filters') && pathname.startsWith('/autoparts')) return 'Фильтры';
    if (pathname.startsWith('/autoparts')) return 'Поиск';
    if (pathname === '/cart') return 'Корзина';
    if (pathname.startsWith('/chats')) return 'Чаты';
    if (pathname === '/dashboard') return 'Дашборд';
    if (pathname === '/profile') return 'Профиль';
    if (pathname.startsWith('/my-parts')) return 'Мои запчасти';
    if (pathname.startsWith('/settings')) return 'Настройки';
    if (pathname.startsWith('/moderation')) return 'Модерация';
    return 'Свой Гараж';
}

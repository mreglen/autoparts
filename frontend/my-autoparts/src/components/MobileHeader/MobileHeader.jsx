import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { getPageTitle } from '../../hooks/useMobileMenuShell';

export default function MobileHeader({ onMenuClick, showMenuButton = true }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, token } = useSelector((state) => state.auth);

    const pageTitle = getPageTitle(location.pathname);
    const isAutopartsListRoot =
        location.pathname === '/autoparts' ||
        location.pathname === '/autoparts/new' ||
        location.pathname === '/autoparts/used';
    const showBack = location.pathname !== '/' && !isAutopartsListRoot;

    const firstName = user?.first_name || user?.name?.split?.(' ')?.[0] || 'П';
    const profilePath = '/profile';

    const handleBack = () => {
        if (window.history.length > 1) {
            navigate(-1);
        } else {
            navigate('/');
        }
    };

    return (
        <header className="lg:hidden sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 pt-safe-top">
            <div className="flex h-14 items-center gap-2 px-3">
                {showBack ? (
                    <button
                        type="button"
                        onClick={handleBack}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-600 active:bg-gray-100"
                        aria-label="Назад"
                    >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                ) : (
                    <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="На главную">
                        <img src="/img/LogoWithoutBg.png" alt="" className="h-8 w-auto" />
                    </Link>
                )}

                <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold text-gray-900">{pageTitle}</p>
                    {location.pathname === '/' && (
                        <p className="truncate text-xs text-gray-500">Свой Гараж</p>
                    )}
                </div>

                <button
                    type="button"
                    onClick={() => navigate('/autoparts/new')}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-600 active:bg-gray-100"
                    aria-label="Поиск в каталоге"
                >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </button>

                {token && user ? (
                    <Link
                        to={profilePath}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-semibold text-white"
                        aria-label="Профиль"
                    >
                        {firstName.charAt(0).toUpperCase()}
                    </Link>
                ) : (
                    <button
                        type="button"
                        onClick={() => navigate('/auth')}
                        className="shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold text-indigo-600 active:bg-indigo-50"
                    >
                        Войти
                    </button>
                )}

                {showMenuButton && (
                    <button
                        type="button"
                        onClick={onMenuClick}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-700 active:bg-gray-100"
                        aria-label="Открыть меню"
                    >
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                        </svg>
                    </button>
                )}
            </div>
        </header>
    );
}

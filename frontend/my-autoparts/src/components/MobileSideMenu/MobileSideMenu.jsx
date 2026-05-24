import React, { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { logout } from '../../redux/slices/AuthSlice';
import ProfileMenuTabs from '../../pages/Profile/menu/ProfileMenuTabs';

const CLOSE_ANIMATION_MS = 200;

export default function MobileSideMenu({
    isOpen,
    onClose,
    tabs,
    activeTab,
    onTabChange,
    badgeCounts = {},
    guestContent = null,
}) {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { user, token } = useSelector((state) => state.auth);
    const [isVisible, setIsVisible] = useState(false);
    const [isClosing, setIsClosing] = useState(false);

    const requestClose = useCallback(() => {
        onClose();
    }, [onClose]);

    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
            setIsClosing(false);
            return undefined;
        }

        if (!isVisible) return undefined;

        setIsClosing(true);
        const timer = window.setTimeout(() => {
            setIsClosing(false);
            setIsVisible(false);
        }, CLOSE_ANIMATION_MS);

        return () => window.clearTimeout(timer);
    }, [isOpen, isVisible]);

    useEffect(() => {
        if (!isVisible) return undefined;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                requestClose();
            }
        };

        window.addEventListener('keydown', onKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [isVisible, requestClose]);

    if (!isVisible) return null;

    const firstName = user?.first_name || user?.name?.split?.(' ')?.[0] || '';
    const lastName = user?.last_name || '';
    const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'Пользователь';

    const handleLogout = () => {
        dispatch(logout());
        requestClose();
        navigate('/', { replace: true });
    };

    return (
        <div className="fixed inset-0 z-[60] md:hidden" role="dialog" aria-modal="true" aria-label="Меню">
            <button
                type="button"
                aria-label="Закрыть меню"
                className={`absolute inset-0 bg-black/45 ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
                onClick={requestClose}
            />

            <aside
                className={`absolute top-0 right-0 flex h-[100dvh] w-[min(320px,88vw)] flex-col bg-white shadow-2xl ${
                    isClosing ? 'animate-slide-out-right' : 'animate-slide-in-right'
                }`}
            >
                <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 pt-safe-top">
                    <h2 className="text-lg font-bold text-gray-900">Меню</h2>
                    <button
                        type="button"
                        onClick={requestClose}
                        className="flex h-10 w-10 items-center justify-center rounded-full text-gray-500 active:bg-gray-100"
                        aria-label="Закрыть"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {token && user && !guestContent && (
                    <div className="border-b border-gray-100 bg-gradient-to-br from-indigo-50 to-white px-4 py-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-lg font-semibold text-white">
                                {(firstName || 'П').charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="truncate font-semibold text-gray-900">{fullName}</p>
                                {user.organization_name && (
                                    <p className="truncate text-xs text-gray-500">{user.organization_name}</p>
                                )}
                                {user.phone && (
                                    <p className="truncate text-xs text-gray-500">{user.phone}</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto overscroll-contain scroll-pb-24 p-2 pb-6">
                    {guestContent || (
                        <ProfileMenuTabs
                            variant="drawer"
                            tabs={tabs}
                            activeTab={activeTab}
                            onTabChange={onTabChange}
                            badgeCounts={badgeCounts}
                        />
                    )}
                </div>

                {token && user && !guestContent && (
                    <div className="border-t border-gray-200 p-3 pb-safe">
                        <button
                            type="button"
                            onClick={handleLogout}
                            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-700 active:bg-gray-50"
                        >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            Выйти
                        </button>
                    </div>
                )}
            </aside>
        </div>
    );
}

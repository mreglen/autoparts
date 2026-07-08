// src/components/MobileBottomNav/MobileBottomNav.jsx
import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectCartSummary } from '../../redux/slices/CartSlice';

const navItems = [
    {
        id: 'home',
        label: 'Главная',
        to: '/',
        isButton: true,
        match: (path) => path === '/',
        icon: (
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
        ),
    },
    {
        id: 'catalog',
        label: 'Поиск',
        to: '/autoparts/new',
        match: (path) => path.startsWith('/autoparts'),
        icon: (
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
        ),
    },
    {
        id: 'cart',
        label: 'Корзина',
        to: '/cart',
        match: (path) => path === '/cart',
        icon: (
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
            />
        ),
    },
    {
        id: 'chats',
        label: 'Чаты',
        to: '/chats',
        match: (path) => path.startsWith('/chats'),
        authOnly: true,
        icon: (
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
        ),
    },
    {
        id: 'profile',
        label: 'Профиль',
        to: '/profile',
        match: (path) => path.startsWith('/profile'),
        authOnly: true,
        icon: (
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
        ),
    },
];

function NavItemButton({ item, isActive, onClick, badge }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
            className={`flex min-h-[48px] flex-1 items-center justify-center rounded-lg px-1 transition-colors ${
                isActive ? 'text-indigo-600' : 'text-gray-500 active:text-indigo-600'
            }`}
        >
            <span
                className={`relative flex h-8 w-8 items-center justify-center rounded-full ${
                    isActive ? 'bg-indigo-50' : ''
                }`}
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-7 w-7"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={isActive ? 2.25 : 2}
                >
                    {item.icon}
                </svg>
                {badge > 0 && (
                    <span className="absolute -right-1 -top-1 flex min-h-[16px] min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                        {badge > 99 ? '99+' : badge}
                    </span>
                )}
            </span>
        </button>
    );
}

function NavItemLink({ item, isActive, badge }) {
    return (
        <NavLink
            to={item.to}
            aria-label={item.label}
            className={`flex min-h-[48px] flex-1 items-center justify-center rounded-lg px-1 transition-colors ${
                isActive ? 'text-indigo-600' : 'text-gray-500 active:text-indigo-600'
            }`}
        >
            {({ isActive: linkActive }) => {
                const active = isActive || linkActive;
                return (
                    <span
                        className={`relative flex h-8 w-8 items-center justify-center rounded-full ${
                            active ? 'bg-indigo-50' : ''
                        }`}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-7 w-7"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={active ? 2.25 : 2}
                        >
                            {item.icon}
                        </svg>
                        {badge > 0 && (
                            <span className="absolute -right-1 -top-1 flex min-h-[16px] min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                                {badge > 99 ? '99+' : badge}
                            </span>
                        )}
                    </span>
                );
            }}
        </NavLink>
    );
}

export default function MobileBottomNav() {
    const { user, token } = useSelector((state) => state.auth);
    const isAuthenticated = Boolean(token && user);
    const cartData = useSelector(selectCartSummary);
    const { chats } = useSelector((state) => state.chats);
    const { chats: avitoChats } = useSelector((state) => state.avitoChats);
    const navigate = useNavigate();
    const location = useLocation();

    const visibleNavItems = React.useMemo(
        () => (isAuthenticated ? navItems : navItems.filter((item) => !item.authOnly)),
        [isAuthenticated]
    );

    const garageUnreadCount = React.useMemo(() => {
        if (!chats || chats.length === 0) return 0;
        return chats.reduce((total, chat) => {
            if (chat.unread_count) return total + chat.unread_count;
            if (chat.last_message && !chat.last_message.is_read && chat.last_message.sender_id !== user?.id) {
                return total + 1;
            }
            return total;
        }, 0);
    }, [chats, user?.id]);

    const avitoUnreadCount = React.useMemo(() => {
        if (!avitoChats || avitoChats.length === 0) return 0;
        return avitoChats.reduce((total, chat) => {
            if (chat.unread_count) return total + chat.unread_count;
            if (chat.has_unread_messages) return total + 1;
            return total;
        }, 0);
    }, [avitoChats]);

    const totalUnreadCount = garageUnreadCount + avitoUnreadCount;

    const getBadge = (id) => {
        if (id === 'cart') return cartData.itemCount;
        if (id === 'chats') return totalUnreadCount;
        return 0;
    };

    const gridColsClass =
        visibleNavItems.length === 5
            ? 'grid-cols-5'
            : visibleNavItems.length === 4
              ? 'grid-cols-4'
              : 'grid-cols-3';

    return (
        <nav
            className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90 pb-safe"
            aria-label="Основная навигация"
        >
            <div className={`grid gap-0 px-1 pt-1 ${gridColsClass}`}>
                {visibleNavItems.map((item) => {
                    const isActive = item.match(location.pathname);
                    if (item.isButton) {
                        return (
                            <NavItemButton
                                key={item.id}
                                item={item}
                                isActive={isActive}
                                onClick={() => navigate(item.to)}
                                badge={getBadge(item.id)}
                            />
                        );
                    }
                    return (
                        <NavItemLink
                            key={item.id}
                            item={item}
                            isActive={isActive}
                            badge={getBadge(item.id)}
                        />
                    );
                })}
            </div>
        </nav>
    );
}

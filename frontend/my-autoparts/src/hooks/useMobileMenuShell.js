import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
    getActiveTabFromPath,
    getAvailableTabs,
    getPathForTab,
} from '../pages/Profile/menu/profileMenuConfig';
import { selectShowWarehouseInventory } from '../utils/siteReviewsPublic';
import {
    selectShowAutoservice,
    selectAutoserviceOrganizationId,
    isAutoserviceClientPath,
    isAutoserviceStaffPath,
} from '../utils/autoservicePublic';
import {
    ADMIN_MENU_MODE_ADMIN,
    ADMIN_MENU_MODE_USER,
    getAdminMenuMode,
    isAdminOnlyPath,
    setAdminMenuMode as persistAdminMenuMode,
} from '../utils/adminMenuMode';
import {
    SELLER_AUTOSERVICE_MODE_AUTOSERVICE,
    SELLER_AUTOSERVICE_MODE_SELLER,
    getSellerAutoserviceMode,
    setSellerAutoserviceMode as persistSellerAutoserviceMode,
    showSellerAutoserviceSwitch,
} from '../utils/sellerAutoserviceMode';
import { selectIsAutoserviceClient } from '../redux/slices/AutoserviceClientSlice';

export function useMobileMenuShell(userOverride) {
    const location = useLocation();
    const navigate = useNavigate();
    const { user: authUser, token, permissionCodes } = useSelector((state) => state.auth);
    const showWarehouseInventory = useSelector(selectShowWarehouseInventory);
    const showAutoservice = useSelector(selectShowAutoservice);
    const autoserviceOrganizationId = useSelector(selectAutoserviceOrganizationId);
    const isAutoserviceClient = useSelector(selectIsAutoserviceClient);
    const user = userOverride ?? authUser;
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [adminMenuMode, setAdminMenuModeState] = useState(getAdminMenuMode);
    const [sellerAutoserviceMode, setSellerAutoserviceModeState] = useState(getSellerAutoserviceMode);

    useEffect(() => {
        if (!user?.is_admin) return;
        setAdminMenuModeState(getAdminMenuMode());
    }, [user?.id, user?.is_admin]);

    useEffect(() => {
        if (!showSellerAutoserviceSwitch(user)) return;
        setSellerAutoserviceModeState(getSellerAutoserviceMode());
    }, [user?.id, user?.organization_is_autoservice]);

    const activeTab = getActiveTabFromPath(location.pathname, user);
    const tabs = getAvailableTabs(user, permissionCodes, {
        showWarehouseInventory,
        showAutoservice,
        autoserviceOrganizationId,
        isAutoserviceClient,
        adminMenuMode: user?.is_admin ? adminMenuMode : undefined,
        organizationIsAutoservice: Boolean(user?.organization_is_autoservice),
        sellerAutoserviceMode: showSellerAutoserviceSwitch(user) ? sellerAutoserviceMode : undefined,
    });

    const setAdminMenuMode = useCallback(
        (mode) => {
            if (!user?.is_admin) return;
            const nextMode = mode === ADMIN_MENU_MODE_ADMIN ? ADMIN_MENU_MODE_ADMIN : ADMIN_MENU_MODE_USER;
            persistAdminMenuMode(nextMode);
            setAdminMenuModeState(nextMode);
            if (nextMode === ADMIN_MENU_MODE_USER && isAdminOnlyPath(location.pathname)) {
                navigate('/dashboard', { replace: true });
            } else if (nextMode === ADMIN_MENU_MODE_USER && isAutoserviceStaffPath(location.pathname)) {
                navigate('/garage', { replace: true });
            } else if (nextMode === ADMIN_MENU_MODE_ADMIN && isAutoserviceClientPath(location.pathname)) {
                navigate('/autoservice/planner', { replace: true });
            }
        },
        [user?.is_admin, location.pathname, navigate],
    );

    const setSellerAutoserviceMode = useCallback(
        (mode) => {
            if (!showSellerAutoserviceSwitch(user)) return;
            const nextMode =
                mode === SELLER_AUTOSERVICE_MODE_AUTOSERVICE
                    ? SELLER_AUTOSERVICE_MODE_AUTOSERVICE
                    : SELLER_AUTOSERVICE_MODE_SELLER;
            persistSellerAutoserviceMode(nextMode);
            setSellerAutoserviceModeState(nextMode);
            if (nextMode === SELLER_AUTOSERVICE_MODE_SELLER && isAutoserviceStaffPath(location.pathname)) {
                navigate('/dashboard', { replace: true });
            } else if (
                nextMode === SELLER_AUTOSERVICE_MODE_AUTOSERVICE &&
                isAutoserviceClientPath(location.pathname)
            ) {
                navigate('/autoservice/planner', { replace: true });
            }
        },
        [user, location.pathname, navigate],
    );

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
        adminMenuMode,
        setAdminMenuMode,
        showAdminMenuSwitch: Boolean(user?.is_admin),
        sellerAutoserviceMode,
        setSellerAutoserviceMode,
        showSellerAutoserviceSwitch: showSellerAutoserviceSwitch(user),
    };
}

export function getPageTitle(pathname) {
    const exact = {
        '/': 'Главная',
        '/catalog': 'Каталог',
        '/about': 'О компании',
        '/delivery': 'Доставка',
        '/payment': 'Оплата',
        '/organizations': 'Организации',
        '/reviews': 'Отзывы',
        '/cart': 'Корзина',
        '/dashboard': 'Обзор',
        '/profile': 'Профиль',
        '/profile/favorites': 'Избранное',
        '/profile/views': 'Просмотры',
        '/profile/subscriptions': 'Подписки',
        '/profile/notifications': 'Уведомления',
        '/chats': 'Сообщения',
        '/my-parts': 'Мои запчасти',
        '/vehicles': 'Автомобили',
        '/stock-in': 'Поступление',
        '/stock-out': 'Расходы',
        '/warehouse-sales': 'Продажи со склада',
        '/warehouse/inventory': 'Инвентаризация',
        '/warehouse/scan': 'Сканировать QR',
        '/finance': 'Финансы',
        '/clients': 'Клиенты',
        '/sellers': 'Продавцы',
        '/sales/orders': 'Заказы',
        '/purchases/orders': 'Мои заказы',
        '/settings/organization': 'Организация',
        '/settings/employees': 'Сотрудники',
        '/settings/storage-addresses': 'Адресное хранение',
        '/settings/printers': 'Печать',
        '/settings/integration': 'Интеграции',
        '/moderation/pending-sellers': 'Регистрация продавцов',
        '/moderation/autoservice-applications': 'Регистрация автосервиса',
        '/moderation/products': 'Модерация',
        '/admin-settings': 'Настройки',
        '/admin/audit-log': 'Журнал событий',
        '/admin/users': 'Пользователи',
        '/admin/rossko': 'Rossko',
        '/admin/analytics': 'Аналитика',
        '/autoservice/welcome': 'Автосервис',
        '/autoservice/repair-booking': 'Запись на ремонт',
        '/autoservice/planner': 'Планировщик',
        '/autoservice/clients': 'Клиенты автосервиса',
        '/autoservice/orders': 'Заказ-наряды',
        '/autoservice/warehouse': 'Склад автосервиса',
        '/autoservice/warehouse/receipts': 'Поступления',
        '/autoservice/warehouse/expenses': 'Расходы',
        '/autoservice/inspections': 'Записи',
        '/autoservice/settings': 'Настройки автосервиса',
        '/garage': 'Мои авто',
        '/garage/repairs': 'История ремонтов',
    };

    if (exact[pathname]) return exact[pathname];
    if (pathname.endsWith('/filters') && pathname.startsWith('/autoparts')) return 'Фильтры';
    if (pathname.startsWith('/autoparts')) return 'Поиск';
    if (pathname.startsWith('/organizations/')) return 'Организация';
    if (pathname.startsWith('/chats')) return 'Сообщения';
    if (pathname.startsWith('/my-parts')) return 'Мои запчасти';
    if (pathname.startsWith('/settings')) return 'Настройки';
    if (pathname.startsWith('/moderation')) return 'Модерация';
    if (pathname.startsWith('/admin/analytics')) return 'Аналитика';
    if (pathname.startsWith('/admin/')) return exact[pathname] || 'Админ';
    if (pathname.startsWith('/sales')) return 'Продажи';
    if (pathname.startsWith('/purchases')) return 'Покупки';
    return 'Свой гараж';
}

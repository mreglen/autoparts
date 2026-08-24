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
    isPathAllowedInCabinet,
} from '../utils/autoservicePublic';
import {
    CABINET_MODE_ADMIN,
    CABINET_MODE_AUTOSERVICE,
    CABINET_MODE_BUYER,
    CABINET_MODE_SELLER,
    getAvailableCabinetModes,
    getDefaultPathForCabinetMode,
    getCabinetMode,
    resolveCabinetMode,
    setCabinetMode as persistCabinetMode,
    showCabinetModeSwitch,
} from '../utils/cabinetMode';
import { selectIsAutoserviceClient } from '../redux/slices/AutoserviceClientSlice';

function resolveRedirectOnCabinetChange(pathname, nextMode, user) {
    if (!user) return null;

    if (user.is_admin && !isPathAllowedInCabinet(pathname, nextMode, user)) {
        return getDefaultPathForCabinetMode(nextMode);
    }

    if (nextMode === CABINET_MODE_ADMIN) {
        if (
            pathname.startsWith('/dashboard') ||
            pathname.startsWith('/sales') ||
            pathname.startsWith('/purchases') ||
            pathname.startsWith('/finance') ||
            pathname.startsWith('/clients') ||
            pathname.startsWith('/my-parts') ||
            pathname.startsWith('/vehicles') ||
            pathname.startsWith('/stock-') ||
            pathname.startsWith('/warehouse-sales') ||
            pathname.startsWith('/warehouse/') ||
            pathname.startsWith('/chats') ||
            pathname.startsWith('/garage') ||
            pathname.startsWith('/autoservice/welcome') ||
            pathname.startsWith('/autoservice/repair-booking')
        ) {
            return '/sellers';
        }
    }

    if (nextMode === CABINET_MODE_BUYER) {
        if (
            pathname.startsWith('/sellers') ||
            pathname.startsWith('/moderation/') ||
            pathname.startsWith('/admin/') ||
            pathname.startsWith('/admin-settings') ||
            pathname.startsWith('/design-system') ||
            pathname.startsWith('/autoservice/planner') ||
            pathname.startsWith('/autoservice/clients') ||
            pathname.startsWith('/autoservice/orders') ||
            pathname.startsWith('/autoservice/settings') ||
            pathname.startsWith('/autoservice/inspections') ||
            pathname.startsWith('/autoservice/finance') ||
            pathname.startsWith('/autoservice/payroll') ||
            pathname.startsWith('/autoservice/reports') ||
            pathname.startsWith('/autoservice/warehouse') ||
            pathname.startsWith('/dashboard') ||
            pathname.startsWith('/sales') ||
            pathname.startsWith('/finance') ||
            pathname.startsWith('/clients') ||
            pathname.startsWith('/my-parts') ||
            pathname.startsWith('/vehicles') ||
            pathname.startsWith('/stock-') ||
            pathname.startsWith('/warehouse-sales') ||
            pathname.startsWith('/warehouse/inventory')
        ) {
            return '/purchases/orders';
        }
    }

    if (nextMode === CABINET_MODE_SELLER) {
        if (
            pathname.startsWith('/sellers') ||
            pathname.startsWith('/moderation/') ||
            pathname.startsWith('/admin/') ||
            pathname.startsWith('/admin-settings') ||
            pathname.startsWith('/design-system') ||
            pathname.startsWith('/autoservice/planner') ||
            pathname.startsWith('/autoservice/clients') ||
            pathname.startsWith('/autoservice/orders') ||
            pathname.startsWith('/autoservice/settings') ||
            pathname.startsWith('/autoservice/inspections') ||
            pathname.startsWith('/autoservice/finance') ||
            pathname.startsWith('/autoservice/payroll') ||
            pathname.startsWith('/autoservice/reports') ||
            pathname.startsWith('/autoservice/warehouse') ||
            pathname.startsWith('/garage') ||
            pathname.startsWith('/autoservice/welcome') ||
            pathname.startsWith('/autoservice/repair-booking')
        ) {
            return '/dashboard';
        }
    }

    if (nextMode === CABINET_MODE_AUTOSERVICE) {
        if (
            pathname.startsWith('/sellers') ||
            pathname.startsWith('/moderation/') ||
            pathname.startsWith('/admin/') ||
            pathname.startsWith('/admin-settings') ||
            pathname.startsWith('/design-system') ||
            pathname.startsWith('/garage') ||
            pathname.startsWith('/autoservice/welcome') ||
            pathname.startsWith('/autoservice/repair-booking') ||
            pathname.startsWith('/sales') ||
            pathname.startsWith('/finance') ||
            pathname.startsWith('/clients') ||
            pathname.startsWith('/my-parts') ||
            pathname.startsWith('/vehicles') ||
            pathname.startsWith('/stock-') ||
            pathname.startsWith('/warehouse-sales') ||
            pathname.startsWith('/warehouse/inventory') ||
            pathname.startsWith('/chats')
        ) {
            return '/autoservice/planner';
        }
    }

    return null;
}

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

    const cabinetOptions = useMemo(
        () => ({ autoserviceOrganizationId }),
        [autoserviceOrganizationId],
    );

    const [cabinetMode, setCabinetModeState] = useState(() =>
        getCabinetMode(user, cabinetOptions),
    );
    const [availableCabinetModes, setAvailableCabinetModes] = useState(() =>
        getAvailableCabinetModes(user, cabinetOptions),
    );

    useEffect(() => {
        if (!user) return;
        const modes = getAvailableCabinetModes(user, cabinetOptions);
        setAvailableCabinetModes(modes);
        setCabinetModeState(resolveCabinetMode(user, cabinetOptions));
    }, [
        user?.id,
        user?.is_admin,
        user?.is_seller,
        user?.is_employee,
        user?.organization_is_autoservice,
        cabinetOptions,
    ]);

    const activeTab = getActiveTabFromPath(location.pathname, user);
    const tabs = getAvailableTabs(user, permissionCodes, {
        showWarehouseInventory,
        showAutoservice,
        autoserviceOrganizationId,
        isAutoserviceClient,
        cabinetMode,
        organizationIsAutoservice: Boolean(user?.organization_is_autoservice),
    });

    const setCabinetMode = useCallback(
        (mode) => {
            if (!user) return;
            const modes = getAvailableCabinetModes(user, cabinetOptions);
            if (!modes.includes(mode)) return;

            persistCabinetMode(mode);
            setCabinetModeState(mode);

            const redirect = resolveRedirectOnCabinetChange(location.pathname, mode, user);
            if (redirect) {
                navigate(redirect, { replace: true });
            }
        },
        [user, cabinetOptions, location.pathname, navigate],
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
        cabinetMode,
        setCabinetMode,
        availableCabinetModes,
        showCabinetModeSwitch: showCabinetModeSwitch(user, cabinetOptions),
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
        '/dashboard': 'Сводка',
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
        '/autoservice/inspections': 'Заявки',
        '/autoservice/finance': 'Финансы',
        '/autoservice/payroll': 'Зарплата',
        '/autoservice/reports': 'Отчёты',
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

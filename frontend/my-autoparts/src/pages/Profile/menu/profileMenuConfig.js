import {
    canAccessAutoserviceStaffMenu,
    canAccessAutoserviceSettings,
    canAccessAutoserviceClientMenu,
} from '../../../utils/autoservicePublic';
import { resolveMenuUser } from '../../../utils/adminMenuMode';

export const TAB_PATH_MAP = {
    dashboard: '/dashboard',
    'admin-panel': '/admin-settings',
    'design-system': '/design-system',
    profile: '/profile',
    'settings-notifications': '/profile/notifications',
    'purchases-orders': '/purchases/orders',
    'purchases-returns': '/purchases/returns',
    'sales-orders': '/sales/orders',
    'sales-returns': '/sales/returns',
    'warehouse-sales': '/warehouse-sales',
    finance: '/finance',
    parts: '/my-parts',
    vehicles: '/vehicles',
    receipts: '/stock-in',
    expenses: '/stock-out',
    'warehouse-inventory': '/warehouse/inventory',
    'settings-storage-addresses': '/settings/storage-addresses',
    'settings-organization': '/settings/organization',
    'settings-printers': '/settings/printers',
    'settings-integration': '/settings/integration',
    clients: '/clients',
    sellers: '/sellers',
    'settings-employees': '/settings/employees',
    'pending-sellers': '/moderation/pending-sellers',
    'product-moderation': '/moderation/products',
    'audit-log': '/admin/audit-log',
    'admin-users': '/admin/users',
    'admin-rossko': '/admin/rossko',
    'site-payments': '/admin/site-payments',
    analytics: '/admin/analytics',
    chats: '/chats',
    'autoservice-welcome': '/autoservice/welcome',
    'autoservice-garage': '/garage',
    'autoservice-repair-booking': '/autoservice/repair-booking',
    'autoservice-repair-history': '/garage/repairs',
    'autoservice-planner': '/autoservice/planner',
    'autoservice-clients': '/autoservice/clients',
    'autoservice-orders': '/autoservice/orders',
    'autoservice-inspections': '/autoservice/inspections',
    'autoservice-settings': '/autoservice/settings',
};

const buildPurchasesSubmenu = () => [
    { id: 'purchases-orders', label: 'Заказы' },
    { id: 'purchases-returns', label: 'Возвраты' },
];

const buildGlobalSettingsTab = (menuUser, hasPermission) => {
    if (menuUser.is_employee && !menuUser.is_admin) {
        const settingsSubmenu = [
            { id: 'profile', label: 'Профиль' },
        ];
        if (hasPermission('storage-addresses')) {
            settingsSubmenu.push({ id: 'settings-storage-addresses', label: 'Адресное хранение' });
        }
        if (menuUser.organization_id && hasPermission('settings.printers')) {
            settingsSubmenu.push({ id: 'settings-printers', label: 'Печать' });
        }
        if (menuUser.organization_id && hasPermission('settings.integration.avito')) {
            settingsSubmenu.push({ id: 'settings-integration', label: 'Интеграция' });
        }
        return { id: 'settings', label: 'Настройки', submenu: settingsSubmenu };
    }
    if (menuUser.is_director) {
        return {
            id: 'settings',
            label: 'Настройки',
            submenu: [
                { id: 'profile', label: 'Профиль' },
                { id: 'settings-employees', label: 'Сотрудники' },
                { id: 'settings-storage-addresses', label: 'Адресное хранение' },
                { id: 'settings-organization', label: 'Организация' },
                { id: 'settings-printers', label: 'Печать' },
                { id: 'settings-integration', label: 'Интеграция' },
            ],
        };
    }
    if (menuUser.is_seller) {
        const settingsSubmenu = [
            { id: 'profile', label: 'Профиль' },
        ];
        if (menuUser.organization_id) {
            settingsSubmenu.push({ id: 'settings-organization', label: 'Организация' });
            settingsSubmenu.push({ id: 'settings-printers', label: 'Печать' });
            settingsSubmenu.push({ id: 'settings-integration', label: 'Интеграция' });
        }
        return { id: 'settings', label: 'Настройки', submenu: settingsSubmenu };
    }
    if (menuUser.is_admin) {
        return {
            id: 'settings',
            label: 'Настройки',
            submenu: [
                { id: 'profile', label: 'Профиль' },
            ],
        };
    }
    return {
        id: 'settings',
        label: 'Настройки',
        submenu: [
            { id: 'profile', label: 'Профиль' },
        ],
    };
};

const buildAutoserviceClientTab = (isClient) => {
    if (!isClient) {
        return { id: 'autoservice-welcome', label: 'Автосервис' };
    }
    return {
        id: 'autoservice',
        label: 'Автосервис',
        submenu: [
            { id: 'autoservice-garage', label: 'Мои авто' },
            { id: 'autoservice-repair-booking', label: 'Запись на ремонт' },
            { id: 'autoservice-repair-history', label: 'История ремонтов' },
        ],
    };
};

const buildAutoserviceStaffTab = (user, options) => {
    const submenu = [
        { id: 'autoservice-planner', label: 'Планировщик' },
        { id: 'autoservice-orders', label: 'Заказ-наряд' },
        { id: 'autoservice-clients', label: 'Клиенты' },
        { id: 'autoservice-inspections', label: 'Записи' },
    ];
    if (canAccessAutoserviceSettings(user, options)) {
        submenu.push({ id: 'autoservice-settings', label: 'Настройки' });
    }
    return { id: 'autoservice-staff', label: 'Сервис', submenu };
};

const PATH_TAB_MAP = Object.fromEntries(
    Object.entries(TAB_PATH_MAP).map(([tabId, path]) => [path, tabId]),
);

export const getActiveTabFromPath = (path, user) => {
    if (path.startsWith('/my-parts') || path.startsWith('/warehouse/scan')) return 'parts';
    if (
        path.startsWith('/profile/favorites') ||
        path.startsWith('/profile/views') ||
        path.startsWith('/profile/subscriptions') ||
        path.startsWith('/profile/notifications')
    ) {
        return 'profile';
    }
    if (path.startsWith('/vehicles/edit')) return 'vehicles';
    if (path.startsWith('/sellers')) return 'sellers';
    if (path.startsWith('/moderation/products')) return 'product-moderation';
    if (path.startsWith('/design-system')) return 'design-system';
    if (path.startsWith('/admin/analytics')) return 'analytics';
    if (path.startsWith('/admin/users')) return 'admin-users';
    if (path.startsWith('/admin/rossko')) return 'admin-rossko';
    if (path.startsWith('/admin/site-payments')) return 'site-payments';
    if (path.startsWith('/garage/repairs') || path.startsWith('/garage/orders')) {
        return 'autoservice-repair-history';
    }
    if (path.startsWith('/garage')) return 'autoservice-garage';
    if (path.startsWith('/autoservice/welcome')) return 'autoservice-welcome';
    if (path.startsWith('/autoservice/repair-booking')) return 'autoservice-repair-booking';
    if (path.startsWith('/autoservice/planner')) return 'autoservice-planner';
    if (path.startsWith('/autoservice/clients')) return 'autoservice-clients';
    if (path.startsWith('/autoservice/orders')) return 'autoservice-orders';
    if (path.startsWith('/autoservice/inspections')) return 'autoservice-inspections';
    if (path.startsWith('/autoservice/settings')) return 'autoservice-settings';
    return PATH_TAB_MAP[path] || (user?.is_seller ? 'dashboard' : 'profile');
};

export const getAvailableTabs = (user, permissionCodes, options = {}) => {
    const menuUser = resolveMenuUser(user, options.adminMenuMode);
    const hasPermission = (code) => permissionCodes && permissionCodes.includes(code);
    const showWarehouseInventory = options.showWarehouseInventory === true;
    const showAutoservice = options.showAutoservice === true;
    const autoserviceOrganizationId = options.autoserviceOrganizationId || null;
    const autoserviceAccessOptions = {
        showAutoservice,
        autoserviceOrganizationId,
        adminMenuMode: options.adminMenuMode,
    };

    if (!menuUser) return [];

    let baseTabs = [];

    if (menuUser.is_admin) {
        baseTabs = [
            { id: 'dashboard', label: 'Главная' },
            { id: 'clients', label: 'Клиенты' },
            { id: 'chats', label: 'Сообщения' },
            {
                id: 'purchases',
                label: 'Покупки',
                submenu: buildPurchasesSubmenu(),
            },
        ];
    } else if (menuUser.is_seller) {
        baseTabs = [
            { id: 'dashboard', label: 'Главная' },
            { id: 'clients', label: 'Клиенты' },
            { id: 'chats', label: 'Сообщения' },
            {
                id: 'purchases',
                label: 'Покупки',
                submenu: buildPurchasesSubmenu(),
            },
        ];
    } else {
        baseTabs = [
            {
                id: 'purchases',
                label: 'Покупки',
                submenu: buildPurchasesSubmenu(),
            },
            { id: 'chats', label: 'Сообщения' },
        ];
    }

    if (menuUser.is_seller || menuUser.is_admin || menuUser.is_employee) {
        const salesSubmenu = [];

        if (menuUser.is_seller || menuUser.is_admin || hasPermission('sales.orders')) {
            salesSubmenu.push({ id: 'sales-orders', label: 'Заказы покупателей' });
        }
        if (menuUser.is_seller || menuUser.is_admin || hasPermission('sales.returns')) {
            salesSubmenu.push({ id: 'sales-returns', label: 'Возвраты покупателей' });
        }
        if (menuUser.is_seller || menuUser.is_admin || hasPermission('warehouse-sales')) {
            salesSubmenu.push({ id: 'warehouse-sales', label: 'Продажи со склада' });
        }

        if (salesSubmenu.length > 0) {
            baseTabs.push({ id: 'sales', label: 'Продажи', submenu: salesSubmenu });
        }
    }

    if (menuUser.is_seller || menuUser.is_admin || hasPermission('finance.reports')) {
        baseTabs.push({ id: 'finance', label: 'Финансы' });
    }

    if (menuUser.is_seller || menuUser.is_admin || menuUser.is_employee) {
        const warehouseSubmenu = [];

        if (menuUser.is_seller || menuUser.is_admin || hasPermission('my-parts')) {
            warehouseSubmenu.push({ id: 'parts', label: 'Мои запчасти' });
        }
        if (
            menuUser.is_seller ||
            menuUser.is_admin ||
            hasPermission('vehicles') ||
            hasPermission('my-parts') ||
            hasPermission('stock-in')
        ) {
            warehouseSubmenu.push({ id: 'vehicles', label: 'Автомобили' });
        }
        if (menuUser.is_seller || menuUser.is_admin || hasPermission('stock-in')) {
            warehouseSubmenu.push({ id: 'receipts', label: 'Поступление' });
        }
        if (menuUser.is_seller || menuUser.is_admin || hasPermission('stock-out')) {
            warehouseSubmenu.push({ id: 'expenses', label: 'Расходы' });
        }
        if (
            showWarehouseInventory &&
            (menuUser.is_seller || menuUser.is_admin || menuUser.is_director || hasPermission('inventory.view'))
        ) {
            warehouseSubmenu.push({ id: 'warehouse-inventory', label: 'Инвентаризация' });
        }

        if (warehouseSubmenu.length > 0) {
            baseTabs.push({ id: 'warehouse', label: 'Склад', submenu: warehouseSubmenu });
        }
    }

    if (menuUser.is_employee && !menuUser.is_admin) {
        baseTabs = [
            { id: 'dashboard', label: 'Главная' },
            {
                id: 'purchases',
                label: 'Покупки',
                submenu: buildPurchasesSubmenu(),
            },
        ];

        const salesSubmenu = [];
        if (hasPermission('sales.orders')) {
            salesSubmenu.push({ id: 'sales-orders', label: 'Заказы покупателей' });
        }
        if (hasPermission('sales.returns')) {
            salesSubmenu.push({ id: 'sales-returns', label: 'Возвраты покупателей' });
        }
        if (hasPermission('warehouse-sales')) {
            salesSubmenu.push({ id: 'warehouse-sales', label: 'Продажи со склада' });
        }
        if (salesSubmenu.length > 0) {
            baseTabs.push({ id: 'sales', label: 'Продажи', submenu: salesSubmenu });
        }

        const warehouseSubmenu = [];
        if (hasPermission('my-parts')) {
            warehouseSubmenu.push({ id: 'parts', label: 'Мои запчасти' });
        }
        if (hasPermission('vehicles') || hasPermission('my-parts') || hasPermission('stock-in')) {
            warehouseSubmenu.push({ id: 'vehicles', label: 'Автомобили' });
        }
        if (hasPermission('stock-in')) {
            warehouseSubmenu.push({ id: 'receipts', label: 'Поступление' });
        }
        if (hasPermission('stock-out')) {
            warehouseSubmenu.push({ id: 'expenses', label: 'Расходы' });
        }
        if (showWarehouseInventory && hasPermission('inventory.view')) {
            warehouseSubmenu.push({ id: 'warehouse-inventory', label: 'Инвентаризация' });
        }
        if (warehouseSubmenu.length > 0) {
            baseTabs.push({ id: 'warehouse', label: 'Склад', submenu: warehouseSubmenu });
        }
    }

    if (canAccessAutoserviceClientMenu(user, autoserviceAccessOptions)) {
        baseTabs.push(buildAutoserviceClientTab(options.isAutoserviceClient === true));
    }

    if (canAccessAutoserviceStaffMenu(user, autoserviceAccessOptions)) {
        baseTabs.push(buildAutoserviceStaffTab(user, autoserviceAccessOptions));
    }

    const auditSubmenuItem = { id: 'audit-log', label: 'Журнал событий' };
    if (menuUser.is_admin) {
        baseTabs.push({
            id: 'administration',
            label: 'Админка',
            submenu: [
                { id: 'sellers', label: 'Продавцы' },
                { id: 'pending-sellers', label: 'Регистрация продавцов' },
                { id: 'product-moderation', label: 'Проверка запчастей' },
                { id: 'analytics', label: 'Аналитика' },
                { id: 'admin-panel', label: 'Настройки' },
                { id: 'design-system', label: 'Дизайн-система' },
                { id: 'admin-users', label: 'Пользователи' },
                { id: 'admin-rossko', label: 'Rossko' },
                { id: 'site-payments', label: 'Оплата сайта' },
                auditSubmenuItem,
            ],
        });
    } else if (hasPermission('admin.audit')) {
        baseTabs.push({
            id: 'administration',
            label: 'Админка',
            submenu: [auditSubmenuItem],
        });
    }

    baseTabs.push(buildGlobalSettingsTab(menuUser, hasPermission));

    return baseTabs;
};

export const getPathForTab = (tabId) => TAB_PATH_MAP[tabId] || null;

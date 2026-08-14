import {
    canAccessAutoserviceSettings,
    canAccessAutoserviceClientMenu,
} from '../../../utils/autoservicePublic';
import {
    CABINET_MODE_ADMIN,
    CABINET_MODE_AUTOSERVICE,
    CABINET_MODE_BUYER,
    CABINET_MODE_SELLER,
    resolveCabinetMode,
} from '../../../utils/cabinetMode';

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
    'autoservice-applications': '/moderation/autoservice-applications',
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
    'autoservice-finance': '/autoservice/finance',
    'autoservice-inspections': '/autoservice/inspections',
    'autoservice-settings': '/autoservice/settings',
    'autoservice-warehouse': '/autoservice/warehouse',
    'autoservice-warehouse-receipts': '/autoservice/warehouse/receipts',
    'autoservice-warehouse-expenses': '/autoservice/warehouse/expenses',
};

const buildPurchasesSubmenu = () => [
    { id: 'purchases-orders', label: 'Заказы' },
    { id: 'purchases-returns', label: 'Возвраты' },
];

const buildGlobalSettingsTab = (menuUser, hasPermission, cabinetMode) => {
    if (cabinetMode === CABINET_MODE_ADMIN || cabinetMode === CABINET_MODE_BUYER) {
        return {
            id: 'settings',
            label: 'Настройки',
            submenu: [{ id: 'profile', label: 'Профиль' }],
        };
    }

    if (menuUser.is_employee && !menuUser.is_admin) {
        const settingsSubmenu = [{ id: 'profile', label: 'Профиль' }];
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
    if (menuUser.is_seller || menuUser.is_admin) {
        const settingsSubmenu = [{ id: 'profile', label: 'Профиль' }];
        if (menuUser.organization_id) {
            settingsSubmenu.push({ id: 'settings-organization', label: 'Организация' });
            settingsSubmenu.push({ id: 'settings-printers', label: 'Печать' });
            settingsSubmenu.push({ id: 'settings-integration', label: 'Интеграция' });
        }
        return { id: 'settings', label: 'Настройки', submenu: settingsSubmenu };
    }
    return {
        id: 'settings',
        label: 'Настройки',
        submenu: [{ id: 'profile', label: 'Профиль' }],
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
        {
            id: 'autoservice-warehouse-group',
            label: 'Склад',
            submenu: [
                { id: 'autoservice-warehouse', label: 'Склад автосервиса' },
                { id: 'autoservice-warehouse-receipts', label: 'Поступления' },
                { id: 'autoservice-warehouse-expenses', label: 'Расходы' },
            ],
        },
        { id: 'autoservice-finance', label: 'Финансы' },
        { id: 'autoservice-clients', label: 'Клиенты' },
        { id: 'autoservice-inspections', label: 'Записи' },
    ];
    if (canAccessAutoserviceSettings(user, options)) {
        submenu.push({ id: 'autoservice-settings', label: 'Настройки' });
    }
    return { id: 'autoservice-staff', label: 'Сервис', submenu };
};

const buildSalesSubmenu = (menuUser, hasPermission) => {
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
    return salesSubmenu;
};

const buildWarehouseSubmenu = (menuUser, hasPermission, showWarehouseInventory) => {
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
    return warehouseSubmenu;
};

const buildBuyerTabs = (user, hasPermission, options) => {
    const tabs = [
        {
            id: 'purchases',
            label: 'Покупки',
            submenu: buildPurchasesSubmenu(),
        },
        { id: 'chats', label: 'Сообщения' },
    ];

    if (canAccessAutoserviceClientMenu(user, options)) {
        tabs.push(buildAutoserviceClientTab(options.isAutoserviceClient === true));
    }

    tabs.push(buildGlobalSettingsTab(user, hasPermission, CABINET_MODE_BUYER));
    return tabs;
};

const buildSellerTabs = (user, hasPermission, options) => {
    const showWarehouseInventory = options.showWarehouseInventory === true;
    const tabs = [
        { id: 'dashboard', label: 'Сводка' },
        {
            id: 'purchases',
            label: 'Покупки',
            submenu: buildPurchasesSubmenu(),
        },
    ];

    const salesSubmenu = buildSalesSubmenu(user, hasPermission);
    if (salesSubmenu.length > 0) {
        tabs.push({ id: 'sales', label: 'Продажи', submenu: salesSubmenu });
    }

    if (user.is_seller || user.is_admin) {
        tabs.push({ id: 'clients', label: 'Клиенты' });
    }

    if (user.is_seller || user.is_admin || hasPermission('finance.reports')) {
        tabs.push({ id: 'finance', label: 'Финансы' });
    }

    const warehouseSubmenu = buildWarehouseSubmenu(user, hasPermission, showWarehouseInventory);
    if (warehouseSubmenu.length > 0) {
        tabs.push({ id: 'warehouse', label: 'Склад', submenu: warehouseSubmenu });
    }

    if (user.is_seller || user.is_admin) {
        tabs.push({ id: 'chats', label: 'Сообщения' });
    }

    tabs.push(buildGlobalSettingsTab(user, hasPermission, CABINET_MODE_SELLER));
    return tabs;
};

const buildAutoserviceTabs = (user, hasPermission, options) => {
    const tabs = [
        { id: 'dashboard', label: 'Сводка' },
        {
            id: 'purchases',
            label: 'Покупки',
            submenu: buildPurchasesSubmenu(),
        },
        buildAutoserviceStaffTab(user, options),
    ];

    tabs.push(buildGlobalSettingsTab(user, hasPermission, CABINET_MODE_AUTOSERVICE));
    return tabs;
};

const buildAdminTabs = (user, hasPermission) => {
    const tabs = [
        { id: 'sellers', label: 'Продавцы' },
        { id: 'pending-sellers', label: 'Регистрация продавцов' },
        { id: 'autoservice-applications', label: 'Регистрация автосервиса' },
        { id: 'product-moderation', label: 'Проверка запчастей' },
        { id: 'analytics', label: 'Аналитика' },
        { id: 'admin-panel', label: 'Настройки' },
        { id: 'design-system', label: 'Дизайн-система' },
        { id: 'admin-users', label: 'Пользователи' },
        { id: 'admin-rossko', label: 'Rossko' },
        { id: 'site-payments', label: 'Оплата сайта' },
        { id: 'audit-log', label: 'Журнал событий' },
    ];

    if (!user.is_admin && hasPermission('admin.audit')) {
        return [
            { id: 'audit-log', label: 'Журнал событий' },
            buildGlobalSettingsTab(user, hasPermission, CABINET_MODE_ADMIN),
        ];
    }

    tabs.push(buildGlobalSettingsTab(user, hasPermission, CABINET_MODE_ADMIN));
    return tabs;
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
    if (path.startsWith('/moderation/autoservice-applications')) return 'autoservice-applications';
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
    if (path.startsWith('/autoservice/warehouse/receipts')) return 'autoservice-warehouse-receipts';
    if (path.startsWith('/autoservice/warehouse/expenses')) return 'autoservice-warehouse-expenses';
    if (path.startsWith('/autoservice/warehouse')) return 'autoservice-warehouse';
    if (path.startsWith('/autoservice/finance')) return 'autoservice-finance';
    if (path.startsWith('/autoservice/inspections')) return 'autoservice-inspections';
    if (path.startsWith('/autoservice/settings')) return 'autoservice-settings';
    return PATH_TAB_MAP[path] || (user?.is_seller ? 'dashboard' : 'profile');
};

export const getAvailableTabs = (user, permissionCodes, options = {}) => {
    const hasPermission = (code) => permissionCodes && permissionCodes.includes(code);
    const showWarehouseInventory = options.showWarehouseInventory === true;
    const showAutoservice = options.showAutoservice === true;
    const autoserviceOrganizationId = options.autoserviceOrganizationId || null;
    const cabinetMode = options.cabinetMode || resolveCabinetMode(user, { autoserviceOrganizationId });

    const autoserviceAccessOptions = {
        showAutoservice,
        autoserviceOrganizationId,
        cabinetMode,
        organizationIsAutoservice: options.organizationIsAutoservice === true,
    };

    if (!user) return [];

    switch (cabinetMode) {
        case CABINET_MODE_SELLER:
            return buildSellerTabs(user, hasPermission, {
                showWarehouseInventory,
                ...autoserviceAccessOptions,
            });
        case CABINET_MODE_AUTOSERVICE:
            return buildAutoserviceTabs(user, hasPermission, autoserviceAccessOptions);
        case CABINET_MODE_ADMIN:
            return buildAdminTabs(user, hasPermission);
        case CABINET_MODE_BUYER:
        default:
            return buildBuyerTabs(user, hasPermission, {
                ...autoserviceAccessOptions,
                isAutoserviceClient: options.isAutoserviceClient === true,
            });
    }
};

export const getPathForTab = (tabId) => TAB_PATH_MAP[tabId] || null;

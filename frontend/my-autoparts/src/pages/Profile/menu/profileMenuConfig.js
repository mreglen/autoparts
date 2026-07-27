import {
    canAccessAutoserviceStaffMenu,
    canAccessAutoserviceSettings,
} from '../../../utils/autoservicePublic';

export const TAB_PATH_MAP = {
    dashboard: '/dashboard',
    'admin-panel': '/admin-settings',
    profile: '/profile',
    'settings-notifications': '/profile/notifications',
    'purchases-orders': '/purchases/orders',
    'purchases-garage': '/garage',
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
    'settings-label': '/settings/label',
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
    'autoservice-inspections': '/autoservice/inspections',
    'autoservice-clients': '/autoservice/clients',
    'autoservice-orders': '/autoservice/orders',
    'autoservice-settings': '/autoservice/settings',
};

const buildPurchasesSubmenu = (showAutoservice) => {
    const submenu = [{ id: 'purchases-orders', label: 'Заказы' }];
    if (showAutoservice) {
        submenu.push({ id: 'purchases-garage', label: 'Гараж' });
    }
    submenu.push({ id: 'purchases-returns', label: 'Возвраты' });
    return submenu;
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
    if (path.startsWith('/admin/analytics')) return 'analytics';
    if (path.startsWith('/admin/users')) return 'admin-users';
    if (path.startsWith('/admin/rossko')) return 'admin-rossko';
    if (path.startsWith('/admin/site-payments')) return 'site-payments';
    if (path.startsWith('/garage')) return 'purchases-garage';
    if (path.startsWith('/autoservice/inspections')) return 'autoservice-inspections';
    if (path.startsWith('/autoservice/clients')) return 'autoservice-clients';
    if (path.startsWith('/autoservice/orders')) return 'autoservice-orders';
    if (path.startsWith('/autoservice/settings')) return 'autoservice-settings';
    return PATH_TAB_MAP[path] || (user?.is_seller ? 'dashboard' : 'profile');
};

export const getAvailableTabs = (user, permissionCodes, options = {}) => {
    const hasPermission = (code) => permissionCodes && permissionCodes.includes(code);
    const showWarehouseInventory = options.showWarehouseInventory === true;
    const showAutoservice = options.showAutoservice === true;
    const autoserviceOrganizationId = options.autoserviceOrganizationId || null;

    if (!user) return [];

    let baseTabs = [];

    if (user.is_admin) {
        baseTabs = [
            { id: 'dashboard', label: 'Главная' },
            { id: 'clients', label: 'Клиенты' },
            { id: 'chats', label: 'Сообщения' },
            {
                id: 'purchases',
                label: 'Покупки',
                submenu: buildPurchasesSubmenu(showAutoservice),
            },
        ];
    } else if (user.is_seller) {
        baseTabs = [
            { id: 'dashboard', label: 'Главная' },
            { id: 'clients', label: 'Клиенты' },
            { id: 'chats', label: 'Сообщения' },
            {
                id: 'purchases',
                label: 'Покупки',
                submenu: buildPurchasesSubmenu(showAutoservice),
            },
        ];
    } else {
        baseTabs = [
            {
                id: 'purchases',
                label: 'Покупки',
                submenu: buildPurchasesSubmenu(showAutoservice),
            },
            { id: 'chats', label: 'Сообщения' },
            {
                id: 'settings',
                label: 'Настройки',
                submenu: [
                    { id: 'profile', label: 'Профиль' },
                ],
            },
        ];
    }

    if (user.is_seller || user.is_admin || user.is_employee) {
        const salesSubmenu = [];

        if (user.is_seller || user.is_admin || hasPermission('sales.orders')) {
            salesSubmenu.push({ id: 'sales-orders', label: 'Заказы покупателей' });
        }
        if (user.is_seller || user.is_admin || hasPermission('sales.returns')) {
            salesSubmenu.push({ id: 'sales-returns', label: 'Возвраты покупателей' });
        }
        if (user.is_seller || user.is_admin || hasPermission('warehouse-sales')) {
            salesSubmenu.push({ id: 'warehouse-sales', label: 'Продажи со склада' });
        }

        if (salesSubmenu.length > 0) {
            baseTabs.push({ id: 'sales', label: 'Продажи', submenu: salesSubmenu });
        }
    }

    if (user.is_seller || user.is_admin || hasPermission('finance.reports')) {
        baseTabs.push({ id: 'finance', label: 'Финансы' });
    }

    if (user.is_seller || user.is_admin || user.is_employee) {
        const warehouseSubmenu = [];

        if (user.is_seller || user.is_admin || hasPermission('my-parts')) {
            warehouseSubmenu.push({ id: 'parts', label: 'Мои запчасти' });
        }
        if (
            user.is_seller ||
            user.is_admin ||
            hasPermission('vehicles') ||
            hasPermission('my-parts') ||
            hasPermission('stock-in')
        ) {
            warehouseSubmenu.push({ id: 'vehicles', label: 'Автомобили' });
        }
        if (user.is_seller || user.is_admin || hasPermission('stock-in')) {
            warehouseSubmenu.push({ id: 'receipts', label: 'Поступление' });
        }
        if (user.is_seller || user.is_admin || hasPermission('stock-out')) {
            warehouseSubmenu.push({ id: 'expenses', label: 'Расходы' });
        }
        if (
            showWarehouseInventory &&
            (user.is_seller || user.is_admin || user.is_director || hasPermission('inventory.view'))
        ) {
            warehouseSubmenu.push({ id: 'warehouse-inventory', label: 'Инвентаризация' });
        }

        if (warehouseSubmenu.length > 0) {
            baseTabs.push({ id: 'warehouse', label: 'Склад', submenu: warehouseSubmenu });
        }
    }

    if (user.is_employee && !user.is_admin) {
        baseTabs = [
            { id: 'dashboard', label: 'Главная' },
            {
                id: 'purchases',
                label: 'Покупки',
                submenu: buildPurchasesSubmenu(showAutoservice),
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

        const settingsSubmenu = [
            { id: 'profile', label: 'Профиль' },
        ];
        if (hasPermission('storage-addresses')) {
            settingsSubmenu.push({ id: 'settings-storage-addresses', label: 'Адресное хранение' });
        }
        if (user.organization_id && hasPermission('settings.printers')) {
            settingsSubmenu.push({ id: 'settings-printers', label: 'Печать' });
        }
        if (user.organization_id && hasPermission('settings.integration.avito')) {
            settingsSubmenu.push({ id: 'settings-integration', label: 'Интеграция' });
        }

        baseTabs.push({ id: 'settings', label: 'Настройки', submenu: settingsSubmenu });
    } else if (user.is_director) {
        baseTabs.push({
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
        });
    } else if (user.is_seller) {
        const settingsSubmenu = [
            { id: 'profile', label: 'Профиль' },
        ];
        if (user.organization_id) {
            settingsSubmenu.push({ id: 'settings-organization', label: 'Организация' });
            settingsSubmenu.push({ id: 'settings-printers', label: 'Печать' });
            settingsSubmenu.push({ id: 'settings-integration', label: 'Интеграция' });
        }
        baseTabs.push({ id: 'settings', label: 'Настройки', submenu: settingsSubmenu });
    } else if (user.is_admin) {
        baseTabs.push({
            id: 'settings',
            label: 'Настройки',
            submenu: [
                { id: 'profile', label: 'Профиль' },
            ],
        });
    }

    const auditSubmenuItem = { id: 'audit-log', label: 'Журнал событий' };
    if (user.is_admin) {
        baseTabs.push({
            id: 'administration',
            label: 'Админка',
            submenu: [
                { id: 'sellers', label: 'Продавцы' },
                { id: 'pending-sellers', label: 'Регистрация продавцов' },
                { id: 'product-moderation', label: 'Проверка запчастей' },
                { id: 'analytics', label: 'Аналитика' },
                { id: 'admin-panel', label: 'Настройки' },
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

    if (
        canAccessAutoserviceStaffMenu(user, {
            showAutoservice,
            autoserviceOrganizationId,
        })
    ) {
        const autoserviceSubmenu = [
            { id: 'autoservice-inspections', label: 'Записи на тех осмотр' },
            { id: 'autoservice-clients', label: 'Клиенты' },
            { id: 'autoservice-orders', label: 'Записи' },
        ];
        if (
            canAccessAutoserviceSettings(user, {
                showAutoservice,
                autoserviceOrganizationId,
            })
        ) {
            autoserviceSubmenu.push({ id: 'autoservice-settings', label: 'Настройки' });
        }
        baseTabs.push({
            id: 'autoservice',
            label: 'Автосервис',
            submenu: autoserviceSubmenu,
        });
    }

    return baseTabs;
};

export const getPathForTab = (tabId) => TAB_PATH_MAP[tabId] || null;

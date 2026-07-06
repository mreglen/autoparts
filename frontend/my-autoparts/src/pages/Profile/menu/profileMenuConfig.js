export const TAB_PATH_MAP = {
    dashboard: '/dashboard',
    'admin-panel': '/admin-settings',
    profile: '/profile',
    'settings-notifications': '/profile/notifications',
    'purchases-orders': '/purchases/orders',
    'sales-orders': '/sales/orders',
    'warehouse-sales': '/warehouse-sales',
    finance: '/finance',
    parts: '/my-parts',
    vehicles: '/vehicles',
    receipts: '/stock-in',
    expenses: '/stock-out',
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
    analytics: '/admin/analytics',
    chats: '/chats',
};

const PATH_TAB_MAP = Object.fromEntries(
    Object.entries(TAB_PATH_MAP).map(([tabId, path]) => [path, tabId])
);

export const getActiveTabFromPath = (path, user) => {
    if (path.startsWith('/my-parts')) return 'parts';
    if (path.startsWith('/profile/notifications')) return 'settings-notifications';
    if (path.startsWith('/vehicles/edit')) return 'vehicles';
    if (path.startsWith('/sellers')) return 'sellers';
    if (path.startsWith('/moderation/products')) return 'product-moderation';
    if (path.startsWith('/admin/analytics')) return 'analytics';
    if (path.startsWith('/admin/users')) return 'admin-users';
    if (path.startsWith('/admin/rossko')) return 'admin-rossko';
    return PATH_TAB_MAP[path] || (user?.is_seller ? 'dashboard' : 'profile');
};

export const getAvailableTabs = (user, permissionCodes) => {
    const hasPermission = (code) => permissionCodes && permissionCodes.includes(code);

    if (!user) return [];

    let baseTabs = [];

    if (user.is_admin) {
        baseTabs = [
            { id: 'dashboard', label: 'Главная' },
            { id: 'sellers', label: 'Продавцы' },
            { id: 'clients', label: 'Клиенты' },
            { id: 'chats', label: 'Сообщения' },
            {
                id: 'purchases',
                label: 'Покупки',
                submenu: [
                    { id: 'purchases-orders', label: 'Заказы' },
                ],
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
                submenu: [
                    { id: 'purchases-orders', label: 'Заказы' },
                ],
            },
        ];
    } else {
        baseTabs = [
            {
                id: 'purchases',
                label: 'Покупки',
                submenu: [
                    { id: 'purchases-orders', label: 'Заказы' },
                ],
            },
            { id: 'chats', label: 'Сообщения' },
            {
                id: 'settings',
                label: 'Настройки',
                submenu: [
                    { id: 'profile', label: 'Профиль' },
                    { id: 'settings-notifications', label: 'Уведомления' },
                ],
            },
        ];
    }

    if (user.is_seller || user.is_admin || user.is_employee) {
        const salesSubmenu = [];

        if (user.is_seller || user.is_admin || hasPermission('sales.orders')) {
            salesSubmenu.push({ id: 'sales-orders', label: 'Заказы покупателей' });
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
                submenu: [
                    { id: 'purchases-orders', label: 'Заказы' },
                ],
            },
        ];

        const salesSubmenu = [];
        if (hasPermission('sales.orders')) {
            salesSubmenu.push({ id: 'sales-orders', label: 'Заказы покупателей' });
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
        if (warehouseSubmenu.length > 0) {
            baseTabs.push({ id: 'warehouse', label: 'Склад', submenu: warehouseSubmenu });
        }

        const settingsSubmenu = [
            { id: 'profile', label: 'Профиль' },
            { id: 'settings-notifications', label: 'Уведомления' },
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
                { id: 'settings-notifications', label: 'Уведомления' },
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
            { id: 'settings-notifications', label: 'Уведомления' },
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
                { id: 'settings-notifications', label: 'Уведомления' },
            ],
        });
    }

    const auditSubmenuItem = { id: 'audit-log', label: 'Журнал событий' };
    if (user.is_admin) {
        baseTabs.push({
            id: 'administration',
            label: 'Админка',
            submenu: [
                { id: 'pending-sellers', label: 'Регистрация продавцов' },
                { id: 'product-moderation', label: 'Проверка запчастей' },
                { id: 'analytics', label: 'Аналитика' },
                { id: 'admin-panel', label: 'Настройки' },
                { id: 'admin-users', label: 'Пользователи' },
                { id: 'admin-rossko', label: 'Rossko' },
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

    return baseTabs;
};

export const getPathForTab = (tabId) => TAB_PATH_MAP[tabId] || null;

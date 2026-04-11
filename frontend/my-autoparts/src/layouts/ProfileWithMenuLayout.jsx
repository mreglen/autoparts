// src/layouts/ProfileWithMenuLayout.jsx
import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { fetchPendingProducts } from '../redux/slices/ModerationProductsSlice';
import { fetchPendingSellers } from '../redux/slices/ModerationSlice';
import Navigation from '../pages/Navigation/Navigation';
import MobileBottomNav from '../components/MobileBottomNav/MobileBottomNav';
import ProfileMenuTabs from '../pages/Profile/menu/ProfileMenuTabs';

export default function ProfileWithMenuLayout() {
    const dispatch = useDispatch();
    const user = useSelector((state) => state.auth.user);
    const permissionCodes = useSelector((state) => state.auth.permissionCodes);
    const moderationProducts = useSelector((state) => state.moderationProducts);
    const moderation = useSelector((state) => state.moderation);
    const location = useLocation();
    const navigate = useNavigate();
    
    // Detect if we're in a chat page (either list or specific chat)
    // /chats or /chats/123 - hide navigation on mobile, show full-screen
    const isChatPage = /^\/chats(\/\d+)?$/.test(location.pathname);
    const isSpecificChatPage = /^\/chats\/\d+/.test(location.pathname);
    
    // Helper to check if user has specific permission
    const hasPermission = (code) => {
        return permissionCodes && permissionCodes.includes(code);
    };

    const [activeTab, setActiveTab] = useState(() => {
        const path = location.pathname;
        if (path.startsWith('/vehicles/edit')) return 'vehicles';
        const pathMap = {
            '/dashboard': 'dashboard',
            '/admin': 'admin-panel',
            '/admin-settings': 'admin-panel',
            '/clients': 'clients',
            '/sellers': 'sellers',
            '/profile': 'profile',
            '/purchases/orders': 'purchases-orders',
            '/purchases/returns': 'purchases-returns',
            '/sales/orders': 'sales-orders',
            '/sales/returns': 'sales-returns',
            '/warehouse-sales': 'warehouse-sales',
            '/my-parts': 'parts',
            '/vehicles': 'vehicles',
            '/vehicles/add': 'vehicles',
            '/stock-in': 'receipts',
            '/stock-out': 'expenses',
            '/settings/storage-addresses': 'settings-storage-addresses',
            '/settings/organization': 'settings-organization',
            '/settings/printers': 'settings-printers',
            '/settings/integration': 'settings-integration',
            '/settings/label': 'settings-label',
            '/settings/employees': 'settings-employees',
            '/moderation/products': 'product-moderation',
            '/moderation/pending-sellers': 'pending-sellers',
            '/chats': 'chats'
        };
        return pathMap[path] || (user?.is_seller ? 'dashboard' : 'profile');
    });

    // Обновляем активную вкладку при изменении пути
    useEffect(() => {
        const getActiveTabFromPath = (path) => {
            if (path.startsWith('/vehicles/edit')) return 'vehicles';
            const pathMap = {
                '/dashboard': 'dashboard',
                '/admin': 'admin-panel',
                '/admin-settings': 'admin-panel',
                '/clients': 'clients',
                '/sellers': 'sellers',
                '/profile': 'profile',
                '/purchases/orders': 'purchases-orders',
                '/purchases/returns': 'purchases-returns',
                '/sales/orders': 'sales-orders',
                '/sales/returns': 'sales-returns',
                '/warehouse-sales': 'warehouse-sales',
                '/my-parts': 'parts',
                '/vehicles': 'vehicles',
                '/vehicles/add': 'vehicles',
                '/stock-in': 'receipts',
                '/stock-out': 'expenses',
                '/settings/storage-addresses': 'settings-storage-addresses',
                '/settings/organization': 'settings-organization',
                '/settings/printers': 'settings-printers',
                '/settings/integration': 'settings-integration',
                '/settings/label': 'settings-label',
                '/settings/employees': 'settings-employees',
                '/moderation/products': 'product-moderation',
                '/moderation/pending-sellers': 'pending-sellers',
                '/chats': 'chats'
            };
            return pathMap[path] || (user?.is_seller ? 'dashboard' : 'profile');
        };
        
        setActiveTab(getActiveTabFromPath(location.pathname));
    }, [location.pathname, user?.is_seller, user?.is_employee]);

    // Определяем доступные вкладки в зависимости от роли пользователя
    const getAvailableTabs = () => {
        let baseTabs = [];

        // Для админов добавляем Главную, Продавцы, Клиенты, Сообщения и Покупки
        if (user?.is_admin) {
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
                        { id: 'purchases-returns', label: 'Возвраты' }
                    ]
                }
            ];
        }
        // Для продавцов добавляем Главную, Клиенты, Сообщения и Покупки
        else if (user?.is_seller) {
            baseTabs = [
                { id: 'dashboard', label: 'Главная' },
                { id: 'clients', label: 'Клиенты' },
                { id: 'chats', label: 'Сообщения' },
                {
                    id: 'purchases',
                    label: 'Покупки',
                    submenu: [
                        { id: 'purchases-orders', label: 'Заказы' },
                        { id: 'purchases-returns', label: 'Возвраты' }
                    ]
                }
            ];
        }
        // Для обычных пользователей (покупателей) - только Покупки, Сообщения и Настройки (Профиль)
        else {
            baseTabs = [
                {
                    id: 'purchases',
                    label: 'Покупки',
                    submenu: [
                        { id: 'purchases-orders', label: 'Заказы' },
                        { id: 'purchases-returns', label: 'Возвраты' }
                    ]
                },
                { id: 'chats', label: 'Сообщения' },
                {
                    id: 'settings',
                    label: 'Настройки',
                    submenu: [
                        { id: 'profile', label: 'Профиль' }
                    ]
                }
            ];
        }

        // Для продавцов, админов и сотрудников добавляем продажи
        if (user?.is_seller || user?.is_admin || user?.is_employee) {
            const salesSubmenu = [];
            
            // Заказы покупателей - только для продавцов, админов или сотрудников с правом sales.orders
            if (user?.is_seller || user?.is_admin || hasPermission('sales.orders')) {
                salesSubmenu.push({ id: 'sales-orders', label: 'Заказы покупателей' });
            }
            
            // Возвраты покупателей - только для продавцов, админов или сотрудников с правом sales.returns
            if (user?.is_seller || user?.is_admin || hasPermission('sales.returns')) {
                salesSubmenu.push({ id: 'sales-returns', label: 'Возвраты покупателей' });
            }
            
            // Продажи со склада - только для продавцов, админов или сотрудников с правом warehouse-sales
            if (user?.is_seller || user?.is_admin || hasPermission('warehouse-sales')) {
                salesSubmenu.push({ id: 'warehouse-sales', label: 'Продажи со склада' });
            }
            
            // Добавляем раздел Продажи только если есть хотя бы один пункт
            if (salesSubmenu.length > 0) {
                baseTabs.push({
                    id: 'sales',
                    label: 'Продажи',
                    submenu: salesSubmenu
                });
            }
        }

        // Для продавцов, админов и сотрудников добавляем вкладку склад с подменю
        if (user?.is_seller || user?.is_admin || user?.is_employee) {
            const warehouseSubmenu = [];
            
            // Мои запчасти - только для продавцов, админов или сотрудников с правом my-parts
            if (user?.is_seller || user?.is_admin || hasPermission('my-parts')) {
                warehouseSubmenu.push({ id: 'parts', label: 'Мои запчасти' });
            }

            if (
                user?.is_seller ||
                user?.is_admin ||
                hasPermission('vehicles') ||
                hasPermission('my-parts') ||
                hasPermission('stock-in')
            ) {
                warehouseSubmenu.push({ id: 'vehicles', label: 'Автомобили' });
            }
            
            // Поступление - только для продавцов, админов или сотрудников с правом stock-in
            if (user?.is_seller || user?.is_admin || hasPermission('stock-in')) {
                warehouseSubmenu.push({ id: 'receipts', label: 'Поступление' });
            }
            
            // Расходы - только для продавцов, админов или сотрудников с правом stock-out
            if (user?.is_seller || user?.is_admin || hasPermission('stock-out')) {
                warehouseSubmenu.push({ id: 'expenses', label: 'Расходы' });
            }
            
            // Добавляем раздел Склад только если есть хотя бы один пункт
            if (warehouseSubmenu.length > 0) {
                baseTabs.push({
                    id: 'warehouse',
                    label: 'Склад',
                    submenu: warehouseSubmenu
                });
            }
        }

        // Для сотрудников только Главная, Покупки и Настройки (Профиль)
        // Плюс Продажи если есть соответствующие права
        if (user?.is_employee) {
            baseTabs = [
                { id: 'dashboard', label: 'Главная' },
                {
                    id: 'purchases',
                    label: 'Покупки',
                    submenu: [
                        { id: 'purchases-orders', label: 'Заказы' },
                        { id: 'purchases-returns', label: 'Возвраты' }
                    ]
                }
            ];
            
            // Добавляем Продажи для сотрудников с соответствующими правами
            const salesSubmenu = [];
            
            // Заказы покупателей - только для сотрудников с правом sales.orders
            if (hasPermission('sales.orders')) {
                salesSubmenu.push({ id: 'sales-orders', label: 'Заказы покупателей' });
            }
            
            // Возвраты покупателей - только для сотрудников с правом sales.returns
            if (hasPermission('sales.returns')) {
                salesSubmenu.push({ id: 'sales-returns', label: 'Возвраты покупателей' });
            }
            
            // Продажи со склада - только для сотрудников с правом warehouse-sales
            if (hasPermission('warehouse-sales')) {
                salesSubmenu.push({ id: 'warehouse-sales', label: 'Продажи со склада' });
            }
            
            // Добавляем раздел Продажи только если есть хотя бы один пункт
            if (salesSubmenu.length > 0) {
                baseTabs.push({
                    id: 'sales',
                    label: 'Продажи',
                    submenu: salesSubmenu
                });
            }
            
            // Добавляем раздел Склад для сотрудников с соответствующими правами
            const warehouseSubmenu = [];
            
            // Мои запчасти - только для сотрудников с правом my-parts
            if (hasPermission('my-parts')) {
                warehouseSubmenu.push({ id: 'parts', label: 'Мои запчасти' });
            }

            if (
                hasPermission('vehicles') ||
                hasPermission('my-parts') ||
                hasPermission('stock-in')
            ) {
                warehouseSubmenu.push({ id: 'vehicles', label: 'Автомобили' });
            }
            
            // Поступление - только для сотрудников с правом stock-in
            if (hasPermission('stock-in')) {
                warehouseSubmenu.push({ id: 'receipts', label: 'Поступление' });
            }
            
            // Расходы - только для сотрудников с правом stock-out
            if (hasPermission('stock-out')) {
                warehouseSubmenu.push({ id: 'expenses', label: 'Расходы' });
            }
            
            // Добавляем раздел Склад только если есть хотя бы один пункт
            if (warehouseSubmenu.length > 0) {
                baseTabs.push({
                    id: 'warehouse',
                    label: 'Склад',
                    submenu: warehouseSubmenu
                });
            }
            
            // Добавляем Настройки для сотрудников
            const settingsSubmenu = [
                { id: 'profile', label: 'Профиль' }
            ];
            
            // Адресное хранение - только для сотрудников с правом storage-addresses
            if (hasPermission('storage-addresses')) {
                settingsSubmenu.push({ id: 'settings-storage-addresses', label: 'Адресное хранение' });
            }
            
            // Печать - для сотрудников с организацией
            if (user?.organization_id && hasPermission('settings.printers')) {
                settingsSubmenu.push({ id: 'settings-printers', label: 'Печать' });
            }

            if (user?.organization_id) {
                settingsSubmenu.push({ id: 'settings-integration', label: 'Интеграция' });
            }
            
            baseTabs.push({
                id: 'settings',
                label: 'Настройки',
                submenu: settingsSubmenu
            });
        }
        // Для директора добавляем Настройки с Профилем, Сотрудниками, Адресным хранением и Печатью
        else if (user?.is_director) {
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
                ]
            });
        }
        // For sellers, add Settings with Profile, Organization and Print
        else if (user?.is_seller) {
            const settingsSubmenu = [
                { id: 'profile', label: 'Профиль' }
            ];
            
            // Add organization if user has organization
            if (user?.organization_id) {
                settingsSubmenu.push({ id: 'settings-organization', label: 'Организация' });
                settingsSubmenu.push({ id: 'settings-printers', label: 'Печать' });
                settingsSubmenu.push({ id: 'settings-integration', label: 'Интеграция' });
            }
            
            baseTabs.push({
                id: 'settings',
                label: 'Настройки',
                submenu: settingsSubmenu
            });
        }
        // Для админов добавляем Настройки только с Профилем
        else if (user?.is_admin) {
            baseTabs.push({
                id: 'settings',
                label: 'Настройки',
                submenu: [
                    { id: 'profile', label: 'Профиль' }
                ]
            });
        }

        // Для админов: «Админка» (модерация + настройки /admin-settings)
        if (user?.is_admin) {
            baseTabs.push({
                id: 'administration',
                label: 'Админка',
                submenu: [
                    { id: 'pending-sellers', label: 'Регистрация продавцов' },
                    { id: 'product-moderation', label: 'Проверка запчастей' },
                    { id: 'admin-panel', label: 'Настройки' },
                ],
            });
        }

        return baseTabs;
    };

    const tabs = getAvailableTabs();

    // Load pending products and pending sellers count when component mounts and user is admin
    useEffect(() => {
        if (user?.is_admin) {
            dispatch(fetchPendingProducts());
            dispatch(fetchPendingSellers());
        }
    }, [dispatch, user?.is_admin]);

    const handleTabChange = (tabId) => {
        setActiveTab(tabId);

        // Маппинг id вкладок на пути
        const tabPathMap = {
            'dashboard': '/dashboard',
            'admin-panel': '/admin-settings',
            'profile': '/profile',
            'purchases-orders': '/purchases/orders',
            'purchases-returns': '/purchases/returns',
            'sales-orders': '/sales/orders',
            'sales-returns': '/sales/returns',
            'warehouse-sales': '/warehouse-sales',
            'parts': '/my-parts',
            'vehicles': '/vehicles',
            'receipts': '/stock-in',
            'expenses': '/stock-out',
            'settings-storage-addresses': '/settings/storage-addresses',
            'settings-organization': '/settings/organization',
            'settings-printers': '/settings/printers',
            'settings-integration': '/settings/integration',
            'settings-label': '/settings/label',
            'clients': '/clients',
            'sellers': '/sellers',
            'settings-employees': '/settings/employees',
            'pending-sellers': '/moderation/pending-sellers',
            'product-moderation': '/moderation/products',
            'chats': '/chats'
        };

        const path = tabPathMap[tabId];
        if (path) {
            navigate(path);
        }
    };

    return (
        <div className={`min-h-screen bg-gray-50 ${!isSpecificChatPage && !isChatPage ? 'pb-24 md:pb-0' : 'pb-0'}`}>
            <div className={isChatPage ? 'max-md:hidden' : ''}>
                <Navigation />
            </div>
            <main
                className={`mx-auto ${isSpecificChatPage ? 'max-w-full p-0 md:max-w-7xl md:px-3 md:sm:px-5 md:lg:px-7 md:py-6 md:sm:py-8' : 'max-w-7xl px-3 sm:px-5 lg:px-7 py-6 sm:py-8'} ${isChatPage ? 'max-md:p-0 max-md:py-0' : ''}`}
            >
                {isSpecificChatPage ? (
                    // Mobile: Full-screen specific chat
                    // Desktop: Two-column layout with sidebar
                    <div className="grid grid-cols-1 lg:grid-cols-6 gap-6">
                        {/* Left column - menu */}
                        <div className={`lg:col-span-1 ${isChatPage ? 'max-md:hidden' : ''}`}>
                            <ProfileMenuTabs
                                tabs={tabs}
                                activeTab={activeTab}
                                onTabChange={handleTabChange}
                                badgeCounts={{
                                    'product-moderation': moderationProducts?.pendingProducts?.length || 0,
                                    'pending-sellers': moderation?.pendingSellers?.length || 0,
                                    'administration': ((moderationProducts?.pendingProducts?.length || 0) + (moderation?.pendingSellers?.length || 0))
                                }}
                            />
                        </div>

                        {/* Right column - content */}
                        <div className="lg:col-span-5">
                            <Outlet />
                        </div>
                    </div>
                ) : (
                    // Two-column layout: menu on left, content on right
                    <div className="grid grid-cols-1 lg:grid-cols-6 gap-6">
                        {/* Left column - menu */}
                        <div className={`lg:col-span-1 ${isChatPage ? 'max-md:hidden' : ''}`}>
                            <ProfileMenuTabs
                                tabs={tabs}
                                activeTab={activeTab}
                                onTabChange={handleTabChange}
                                badgeCounts={{
                                    'product-moderation': moderationProducts?.pendingProducts?.length || 0,
                                    'pending-sellers': moderation?.pendingSellers?.length || 0,
                                    'administration': ((moderationProducts?.pendingProducts?.length || 0) + (moderation?.pendingSellers?.length || 0))
                                }}
                            />
                        </div>

                        {/* Right column - content */}
                        <div className="lg:col-span-5">
                            <Outlet />
                        </div>
                    </div>
                )}
            </main>
            <div className={isChatPage ? 'max-md:hidden' : ''}>
                {!isSpecificChatPage && <MobileBottomNav />}
            </div>
        </div>
    );
}

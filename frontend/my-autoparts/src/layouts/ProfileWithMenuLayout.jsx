// src/layouts/ProfileWithMenuLayout.jsx
import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { fetchPendingProducts } from '../redux/slices/ModerationProductsSlice';
import { fetchPendingSellers } from '../redux/slices/ModerationSlice';
import Navigation from '../pages/Navigation/Navigation';
import ProfileMenuTabs from '../pages/Profile/menu/ProfileMenuTabs';

export default function ProfileWithMenuLayout() {
    const dispatch = useDispatch();
    const user = useSelector((state) => state.auth.user);
    const permissionCodes = useSelector((state) => state.auth.permissionCodes);
    const moderationProducts = useSelector((state) => state.moderationProducts);
    const moderation = useSelector((state) => state.moderation);
    const location = useLocation();
    const navigate = useNavigate();
    
    // Helper to check if user has specific permission
    const hasPermission = (code) => {
        return permissionCodes && permissionCodes.includes(code);
    };

    const [activeTab, setActiveTab] = useState(() => {
        const pathMap = {
            '/dashboard': 'dashboard',
            '/clients': 'clients',
            '/sellers': 'sellers',
            '/profile': 'profile',
            '/purchases/orders': 'purchases-orders',
            '/purchases/returns': 'purchases-returns',
            '/sales/orders': 'sales-orders',
            '/sales/returns': 'sales-returns',
            '/warehouse-sales': 'warehouse-sales',
            '/my-parts': 'parts',
            '/stock-in': 'receipts',
            '/stock-out': 'expenses',
            '/settings/storage-addresses': 'settings-storage-addresses',
            '/settings/organization': 'settings-organization',
            '/settings/printers': 'settings-printers',
            '/settings/label': 'settings-label',
            '/settings/employees': 'settings-employees',
            '/moderation/products': 'product-moderation',
            '/moderation/pending-sellers': 'pending-sellers'
        };
        return pathMap[location.pathname] || (user?.is_seller ? 'dashboard' : 'profile');
    });

    // Обновляем активную вкладку при изменении пути
    useEffect(() => {
        const getActiveTabFromPath = (path) => {
            const pathMap = {
                '/dashboard': 'dashboard',
                '/clients': 'clients',
                '/sellers': 'sellers',
                '/profile': 'profile',
                '/purchases/orders': 'purchases-orders',
                '/purchases/returns': 'purchases-returns',
                '/sales/orders': 'sales-orders',
                '/sales/returns': 'sales-returns',
                '/warehouse-sales': 'warehouse-sales',
                '/my-parts': 'parts',
                '/stock-in': 'receipts',
                '/stock-out': 'expenses',
                '/settings/storage-addresses': 'settings-storage-addresses',
                '/settings/organization': 'settings-organization',
                '/settings/printers': 'settings-printers',
                '/settings/label': 'settings-label',
                '/settings/employees': 'settings-employees',
                '/moderation/products': 'product-moderation',
                '/moderation/pending-sellers': 'pending-sellers'
            };
            return pathMap[path] || (user?.is_seller ? 'dashboard' : 'profile');
        };
        
        setActiveTab(getActiveTabFromPath(location.pathname));
    }, [location.pathname, user?.is_seller, user?.is_employee]);

    // Определяем доступные вкладки в зависимости от роли пользователя
    const getAvailableTabs = () => {
        let baseTabs = [];

        // Для админов добавляем Главную, Продавцы и Клиенты
        if (user?.is_admin) {
            baseTabs = [
                { id: 'dashboard', label: 'Главная' },
                { id: 'sellers', label: 'Продавцы' },
                { id: 'clients', label: 'Клиенты' },
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
        // Для продавцов добавляем Главную, Клиенты и Покупки
        else if (user?.is_seller) {
            baseTabs = [
                { id: 'dashboard', label: 'Главная' },
                { id: 'clients', label: 'Клиенты' },
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
        // Для обычных пользователей (покупателей) - только Покупки и Настройки (Профиль)
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
                    { id: 'settings-printers', label: 'Печать' }
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

        // Для админов добавляем вкладку Модерация
        if (user?.is_admin) {
            baseTabs.push({
                id: 'moderation',
                label: 'Модерация',
                submenu: [
                    { id: 'pending-sellers', label: 'Регистрация продавцов' },
                    { id: 'product-moderation', label: 'Проверка запчастей' }
                ]
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
            'profile': '/profile',
            'purchases-orders': '/purchases/orders',
            'purchases-returns': '/purchases/returns',
            'sales-orders': '/sales/orders',
            'sales-returns': '/sales/returns',
            'warehouse-sales': '/warehouse-sales',
            'parts': '/my-parts',
            'receipts': '/stock-in',
            'expenses': '/stock-out',
            'settings-storage-addresses': '/settings/storage-addresses',
            'settings-organization': '/settings/organization',
            'settings-printers': '/settings/printers',
            'settings-label': '/settings/label',
            'clients': '/clients',
            'sellers': '/sellers',
            'settings-employees': '/settings/employees',
            'pending-sellers': '/moderation/pending-sellers',
            'product-moderation': '/moderation/products'
        };

        const path = tabPathMap[tabId];
        if (path) {
            navigate(path);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-24 md:pb-0">
            <Navigation />
            <main className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-7 py-6 sm:py-8">
                {/* Двухколоночный layout: меню слева, контент справа */}
                <div className="grid grid-cols-1 lg:grid-cols-6 gap-6">
                    {/* Левая колонка - меню */}
                    <div className="lg:col-span-1">
                        <ProfileMenuTabs
                            tabs={tabs}
                            activeTab={activeTab}
                            onTabChange={handleTabChange}
                            badgeCounts={{
                                'product-moderation': moderationProducts?.pendingProducts?.length || 0,
                                'pending-sellers': moderation?.pendingSellers?.length || 0,
                                'moderation': ((moderationProducts?.pendingProducts?.length || 0) + (moderation?.pendingSellers?.length || 0))
                            }}
                        />
                    </div>

                    {/* Правая колонка - контент */}
                    <div className="lg:col-span-5">
                        <Outlet />
                    </div>
                </div>
            </main>
        </div>
    );
}

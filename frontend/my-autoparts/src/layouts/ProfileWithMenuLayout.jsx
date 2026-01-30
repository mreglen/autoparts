// src/layouts/ProfileWithMenuLayout.jsx
import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Navigation from '../pages/Navigation/Navigation';
import ProfileMenuTabs from '../pages/Profile/menu/ProfileMenuTabs';

export default function ProfileWithMenuLayout() {
    const user = useSelector((state) => state.auth.user);
    const location = useLocation();
    const navigate = useNavigate();

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

        // Для админов добавляем Главную и Продавцы
        if (user?.is_admin) {
            baseTabs = [
                { id: 'dashboard', label: 'Главная' },
                { id: 'sellers', label: 'Продавцы' },
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
        // Для обычных пользователей только Покупки
        else {
            baseTabs = [
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

        // Для продавцов, админов и сотрудников добавляем продажи
        if (user?.is_seller || user?.is_admin || user?.is_employee) {
            baseTabs.push({
                id: 'sales',
                label: 'Продажи',
                submenu: [
                    { id: 'sales-orders', label: 'Заказы покупателей' },
                    { id: 'sales-returns', label: 'Возвраты покупателей' },
                    { id: 'warehouse-sales', label: 'Продажи со склада' }
                ]
            });
        }

        // Для продавцов, админов и сотрудников добавляем вкладку склад с подменю
        if (user?.is_seller || user?.is_admin || user?.is_employee) {
            baseTabs.push({
                id: 'warehouse',
                label: 'Склад',
                submenu: [
                    { id: 'parts', label: 'Мои запчасти' },
                    { id: 'receipts', label: 'Поступление' },
                    { id: 'expenses', label: 'Расходы' }
                ]
            });
        }

        // Для продавцов и админов (не директоров) добавляем настройки
        if ((user?.is_seller || user?.is_admin) && !user?.is_director) {
            baseTabs.push({
                id: 'settings',
                label: 'Настройки',
                submenu: [
                    { id: 'profile', label: 'Профиль' },
                    { id: 'settings-storage-addresses', label: 'Адресное хранение' }
                ]
            });
        }

        // Для директоров добавляем вкладку Настройки (без клиентов)
        if (user?.is_director) {
            baseTabs.push({
                id: 'settings',
                label: 'Настройки',
                submenu: [
                    { id: 'profile', label: 'Профиль' },
                    { id: 'settings-employees', label: 'Сотрудники' },
                    { id: 'settings-storage-addresses', label: 'Адресное хранение' }
                ]
            });
        }

        // Для сотрудников добавляем настройки без сотрудников
        if (user?.is_employee) {
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
            
            // Добавляем продажи для сотрудников
            baseTabs.push({
                id: 'sales',
                label: 'Продажи',
                submenu: [
                    { id: 'sales-orders', label: 'Заказы покупателей' },
                    { id: 'sales-returns', label: 'Возвраты покупателей' },
                    { id: 'warehouse-sales', label: 'Продажи со склада' }
                ]
            });
            
            // Добавляем склад для сотрудников
            baseTabs.push({
                id: 'warehouse',
                label: 'Склад',
                submenu: [
                    { id: 'parts', label: 'Мои запчасти' },
                    { id: 'receipts', label: 'Поступление' },
                    { id: 'expenses', label: 'Расходы' }
                ]
            });
            
            baseTabs.push({
                id: 'settings',
                label: 'Настройки',
                submenu: [
                    { id: 'profile', label: 'Профиль' },
                    { id: 'settings-storage-addresses', label: 'Адресное хранение' }
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
            'clients': '/clients',
            'sellers': '/sellers',
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

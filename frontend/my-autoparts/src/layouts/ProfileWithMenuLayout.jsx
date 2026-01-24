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
                '/settings/employees': 'settings-employees',
                '/settings/storage-addresses': 'settings-storage-addresses',
                '/moderation/products': 'product-moderation',
                '/moderation/pending-sellers': 'pending-sellers'
            };
            return pathMap[path] || (user?.is_seller ? 'dashboard' : 'profile');
        };
        
        setActiveTab(getActiveTabFromPath(location.pathname));
    }, [location.pathname, user?.is_seller]);

    // Определяем доступные вкладки в зависимости от роли пользователя
    const getAvailableTabs = () => {
        const baseTabs = [
            {
                id: 'purchases',
                label: 'Покупки',
                submenu: [
                    { id: 'purchases-orders', label: 'Заказы' },
                    { id: 'purchases-returns', label: 'Возвраты' }
                ]
            }
        ];

        // Для продавцов добавляем отдельные вкладки Главная, Клиенты и Продавцы
        if (user?.is_seller) {
            baseTabs.unshift(
                { id: 'dashboard', label: 'Главная' },
                { id: 'clients', label: 'Клиенты' },
                { id: 'sellers', label: 'Продавцы' }
            );
        }

        // Для продавцов добавляем продажи
        if (user?.is_seller) {
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

        // Для продавцов добавляем вкладку склад с подменю
        if (user?.is_seller) {
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
            'settings-employees': '/settings/employees',
            'clients': '/clients',
            'sellers': '/sellers',
            'settings-storage-addresses': '/settings/storage-addresses',
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

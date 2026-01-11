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

    // Определяем активную вкладку на основе текущего пути
    const getActiveTabFromPath = (path) => {
        const pathMap = {
            '/profile': 'profile',
            '/purchases': 'purchases',
            '/sales': 'sales',
            '/my-parts': 'parts',
            '/stock-in': 'receipts',
            '/stock-out': 'expenses'
        };
        return pathMap[path] || 'profile';
    };

    const [activeTab, setActiveTab] = useState(getActiveTabFromPath(location.pathname));

    // Обновляем активную вкладку при изменении пути
    useEffect(() => {
        setActiveTab(getActiveTabFromPath(location.pathname));
    }, [location.pathname]);

    // Определяем доступные вкладки в зависимости от роли пользователя
    const getAvailableTabs = () => {
        const baseTabs = [
            { id: 'profile', label: 'Профиль' },
            { id: 'purchases', label: 'Покупки' },
        ];

        // Для админов добавляем продажи
        if (user?.is_admin) {
            baseTabs.push({ id: 'sales', label: 'Продажи' });
        }

        // Для продавцов добавляем их специфические вкладки
        if (user?.is_seller) {
            baseTabs.push(
                { id: 'parts', label: 'Мои запчасти' },
                { id: 'receipts', label: 'Поступление' },
                { id: 'expenses', label: 'Расходы' }
            );
        }

        return baseTabs;
    };

    const tabs = getAvailableTabs();

    const handleTabChange = (tabId) => {
        setActiveTab(tabId);
        // Маппинг id вкладок на пути
        const tabPathMap = {
            'profile': '/profile',
            'purchases': '/purchases',
            'sales': '/sales',
            'parts': '/my-parts',
            'receipts': '/stock-in',
            'expenses': '/stock-out'
        };

        const path = tabPathMap[tabId];
        if (path) {
            navigate(path);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
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

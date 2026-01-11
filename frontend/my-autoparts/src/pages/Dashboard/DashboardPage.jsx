// src/pages/Dashboard/DashboardPage.jsx
import React from 'react';
import { useSelector } from 'react-redux';

export default function DashboardPage() {
    const { user } = useSelector((state) => state.auth);
    const { items: products } = useSelector((state) => state.products);

    // Формируем ФИО пользователя
    const fullName = `${user?.last_name || ''} ${user?.first_name || ''} ${user?.patronymic || ''}`.trim();

    // Расчет общей суммы и количества товаров пользователя (как в Мои запчасти)
    const userStats = React.useMemo(() => {
        if (!products || products.length === 0) {
            return { totalValue: 0, totalQuantity: 0 };
        }

        const totalValue = products.reduce((sum, product) => sum + (product.price * product.quantity), 0);
        const totalQuantity = products.reduce((sum, product) => sum + product.quantity, 0);

        return { totalValue, totalQuantity };
    }, [products]);


    return (
        <div className="max-w-4xl mx-auto px-3 sm:px-5 lg:px-7 py-8">
            {/* Заголовок */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Главная</h1>
            </div>

            {/* Сетка: личная информация + статистика */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Личная информация */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-md border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Личная информация
                    </h2>
                    <div className="space-y-4">
                        <div className="flex items-start gap-3">
                            <div className="bg-indigo-50 text-indigo-600 rounded-full p-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">ФИО</p>
                                <p className="font-medium text-gray-900">{fullName || '—'}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="bg-indigo-50 text-indigo-600 rounded-full p-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Организация</p>
                                <p className="font-medium text-gray-900">{user?.organization_name || '—'}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="bg-indigo-50 text-indigo-600 rounded-full p-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 7.89a2 2 0 002.828 0L21 8M5 12v6a2 2 0 002 2h8a2 2 0 002-2v-6M5 12h14" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Email</p>
                                <p className="font-medium text-gray-900">{user?.email || '—'}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="bg-indigo-50 text-indigo-600 rounded-full p-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.848.535l6.44 6.44a1 1 0 01.536.848v6.28a2 2 0 01-2 2H5a2 2 0 01-2-2V5z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7v6m0 0v6m0-6h6m-6 6H9" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Телефон</p>
                                <p className="font-medium text-gray-900">{user?.phone || '—'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Статистика */}
                <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        Статистика
                    </h2>
                    <div className="space-y-4">
                        <div className="flex items-start gap-3">
                            <div className="bg-indigo-50 text-indigo-600 rounded-full p-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Общая стоимость</p>
                                <p className="font-bold text-gray-900 text-lg">{userStats.totalValue.toLocaleString('ru-RU')} ₽</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="bg-blue-50 text-blue-600 rounded-full p-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a.997.997 0 01-1.414 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Общее количество</p>
                                <p className="font-bold text-gray-900 text-lg">{userStats.totalQuantity.toLocaleString('ru-RU')} шт.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="bg-green-50 text-green-600 rounded-full p-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Баланс</p>
                                <p className="font-bold text-gray-900 text-lg">0 ₽</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

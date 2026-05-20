import React from 'react';

export default function SellerDashboardModal({ isOpen, onClose, seller, stats, loading }) {
    if (!isOpen) return null;

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB'
        }).format(amount || 0);
    };

    const formatNumber = (num) => {
        return new Intl.NumberFormat('ru-RU').format(num || 0);
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Backdrop */}
            <div 
                className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
                onClick={onClose}
            />
            
            {/* Modal */}
            <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
                <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full max-w-[98vw] lg:max-w-full">
                    {/* Header */}
                    <div className="bg-gray-50 px-4 py-3 sm:px-6 flex justify-between items-center border-b border-gray-200">
                        <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-semibold text-gray-900 truncate">
                                Дашборд продавца
                            </h3>
                            {seller && (
                                <p className="text-sm text-gray-500 mt-1 truncate">
                                    {seller.last_name} {seller.first_name}{seller.patronymic ? ` ${seller.patronymic}` : ''}
                                    {seller.organization_name && ` • ${seller.organization_name}`}
                                </p>
                            )}
                        </div>
                        <button
                            onClick={onClose}
                            className="ml-2 text-gray-400 hover:text-gray-500 focus:outline-none flex-shrink-0"
                        >
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Content */}
                    <div className="px-4 py-5 sm:p-6 max-h-[85vh]">
                        {loading ? (
                            <div className="flex justify-center items-center h-64">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                            </div>
                        ) : stats ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                {/* Order Statistics */}
                                <div className="lg:col-span-2 bg-white rounded-xl shadow-md border border-gray-200 p-4 sm:p-6">
                                    <div className="flex items-center justify-between mb-4 sm:mb-6">
                                        <h3 className="text-base sm:text-lg font-bold text-gray-900">Статистика заказов</h3>
                                        <div className="p-2 bg-blue-50 rounded-lg text-blue-600 flex-shrink-0">
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                            </svg>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
                                        <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                                            <p className="text-[10px] sm:text-xs font-medium text-blue-600 uppercase mb-1">Активные</p>
                                            <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.activeOrders || 0}</p>
                                        </div>
                                        <div className="p-3 bg-yellow-50 rounded-xl border border-yellow-100">
                                            <p className="text-[10px] sm:text-xs font-medium text-yellow-600 uppercase mb-1">Ожидают</p>
                                            <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.pendingOrders || 0}</p>
                                        </div>
                                        <div className="p-3 bg-green-50 rounded-xl border border-green-100">
                                            <p className="text-[10px] sm:text-xs font-medium text-green-600 uppercase mb-1">Новые</p>
                                            <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.newOrders || 0}</p>
                                        </div>
                                        <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                                            <p className="text-[10px] sm:text-xs font-medium text-indigo-600 uppercase mb-1">Завершенные</p>
                                            <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.completedOrders || 0}</p>
                                        </div>
                                        <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
                                            <p className="text-[10px] sm:text-xs font-medium text-purple-600 uppercase mb-1">Продажи</p>
                                            <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.warehouseSalesCount || 0}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Total Sales - Now spans 2 columns instead of 1 */}
                                <div className="lg:col-span-2 bg-gradient-to-br from-indigo-600 to-blue-700 rounded-xl shadow-lg p-4 sm:p-6 text-white">
                                    <div className="flex items-center mb-3 sm:mb-4">
                                        <div className="p-2 sm:p-3 bg-white bg-opacity-20 rounded-lg mr-3 sm:mr-4 text-white flex-shrink-0">
                                            <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                            </svg>
                                        </div>
                                        <p className="text-xs sm:text-sm font-medium text-indigo-100 flex-1 min-w-0">
                                            Фактические продажи со склада
                                        </p>
                                    </div>
                                    <p className="text-xl sm:text-2xl md:text-3xl font-bold leading-tight break-all">{formatCurrency(stats.totalSales)}</p>
                                    <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-indigo-500 border-opacity-30">
                                        <p className="text-xs sm:text-sm text-indigo-100 opacity-80">Включая Авито после закрытия заказа</p>
                                    </div>
                                </div>

                                {/* Warehouse Overview */}
                                <div className="lg:col-span-2 bg-white rounded-xl shadow-md border border-gray-200 p-4 sm:p-6">
                                    <div className="flex items-center justify-between mb-4 sm:mb-6">
                                        <h3 className="text-base sm:text-lg font-bold text-gray-900">Обзор склада</h3>
                                        <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600 flex-shrink-0">
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2z" />
                                            </svg>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <div className="flex items-center p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                                            <div className="p-3 bg-white rounded-lg shadow-sm mr-4 text-emerald-600">
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-emerald-700">Стоимость товаров</p>
                                                <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.totalWarehouseValue)} ₽</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center p-4 bg-orange-50 rounded-xl border border-orange-100">
                                            <div className="p-3 bg-white rounded-lg shadow-sm mr-4 text-orange-600">
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                                </svg>
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-orange-700">Общее количество</p>
                                                <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.totalWarehouseQuantity)} шт.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Product variety - Now spans 2 columns instead of 1 */}
                                <div className="lg:col-span-2 bg-white rounded-xl shadow-md border border-gray-200 p-6">
                                    <div className="flex flex-col h-full justify-between">
                                        <div className="flex items-center mb-4">
                                            <div className="p-3 bg-purple-100 rounded-lg mr-4 text-purple-600">
                                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                                </svg>
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-600">Номенклатура</p>
                                                <p className="text-xs text-gray-400">Уникальных позиций</p>
                                            </div>
                                        </div>
                                        <div className="mt-auto">
                                            <p className="text-4xl font-black text-gray-900">{stats.totalProducts || 0}</p>
                                            <p className="text-sm text-gray-500 mt-2">Наименований запчастей</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <p className="text-gray-500">Не удалось загрузить данные дашборда</p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="bg-gray-50 px-4 py-3 sm:px-6 flex flex-col sm:flex-row sm:flex-row-reverse sm:items-center sm:justify-between gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex justify-center rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 w-full sm:w-auto"
                        >
                            Закрыть
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

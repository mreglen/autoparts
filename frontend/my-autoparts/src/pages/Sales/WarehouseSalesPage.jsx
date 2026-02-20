import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchWarehouseSales } from '../../redux/slices/StockOutSlice';
import { fetchStorageLocations } from '../../redux/slices/OrganizationSlice';
import { useNavigate, Navigate } from 'react-router-dom';
import ImageModal from '../../components/ImageModal/ImageModal';
import PhotoThumbnail from '../../components/PhotoGallery/PhotoThumbnail';

const WarehouseSalesPage = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { salesItems, salesLoading, error } = useSelector((state) => state.stockOut);
    const { storageLocations } = useSelector((state) => state.organization);
    const { user, permissionCodes } = useSelector((state) => state.auth);
    const [expandedDocId, setExpandedDocId] = useState(null);
    const [imageModalOpen, setImageModalOpen] = useState(false);
    const [selectedImages, setSelectedImages] = useState({ photos: [], initialIndex: 0 });
    const [searchQuery, setSearchQuery] = useState('');
    const [authChecked, setAuthChecked] = useState(false);

    const handleImageClick = (photos, initialIndex) => {
        setSelectedImages({ photos, initialIndex });
        setImageModalOpen(true);
    };

    // Check if user has permission to view this page
    // Admin and sellers always have access
    // Employees need 'warehouse-sales' permission code
    const hasPermission = user?.is_admin || user?.is_seller || 
        (user?.is_employee && permissionCodes && permissionCodes.includes('warehouse-sales'));

    // Проверка прав доступа - делаем проверку только когда user загружен
    useEffect(() => {
        // Если user еще не загружен (null), ждем
        if (user === undefined || user === null) {
            // Проверяем есть ли токен - если есть, ждем загрузки профиля
            const token = localStorage.getItem('token');
            if (token) {
                return; // Ждем пока загрузится профиль
            }
        }
        
        // Отмечаем что проверка auth выполнена
        setAuthChecked(true);
        
        if (!hasPermission) {
            navigate('/', { replace: true });
        }
    }, [user, permissionCodes, hasPermission, navigate]);

    useEffect(() => {
        if (hasPermission && (user?.is_seller || user?.is_employee) && user.organization_id) {
            dispatch(fetchWarehouseSales());
            dispatch(fetchStorageLocations(user.organization_id));
        }
    }, [dispatch, user, hasPermission]);

    // Показываем загрузку пока auth данные загружаются
    if (!authChecked) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!user) return <Navigate to="/auth" replace />;
    if (!hasPermission) return <Navigate to="/" replace />;

    const toggleExpand = (id) => {
        setExpandedDocId(expandedDocId === id ? null : id);
    };

    const getStorageAddress = (locationId) => {
        if (!locationId) return '—';
        const loc = storageLocations.find(l => l.id === locationId);
        return loc ? (loc.address || `Склад #${locationId}`) : `Склад #${locationId}`;
    };

    // Фильтрация продаж по поисковому запросу
    const filteredSales = salesItems.filter(sale => {
        if (!searchQuery.trim()) return true;

        const query = searchQuery.toLowerCase().replace(/\s+/g, '');
        return (
            (sale.product?.article && sale.product.article.toLowerCase().replace(/\s+/g, '').includes(query)) ||
            (sale.product?.internal_code && sale.product.internal_code.toLowerCase().replace(/\s+/g, '').includes(query)) ||
            (sale.product?.name && sale.product.name.toLowerCase().includes(query)) ||
            (sale.product?.brand && sale.product.brand.toLowerCase().includes(query))
        );
    });

    // Расчет общей суммы продаж и количества
    const totalRevenue = filteredSales.reduce((sum, sale) => sum + (sale.sale_price * sale.quantity), 0);
    const totalQuantity = filteredSales.reduce((sum, sale) => sum + sale.quantity, 0);

    return (
        <div className="mt-4 sm:mt-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
                <div className="mb-6 sm:mb-8">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Продажи со склада</h1>
                    <p className="mt-2 text-gray-600 text-base sm:text-base">Продажи со склада проведённые через страницу "Мои запчасти"</p>
                </div>
                <div className="text-left sm:text-right">
                    <div className="text-xl sm:text-2xl font-bold text-gray-700">
                        {totalRevenue.toLocaleString('ru-RU')} ₽
                    </div>
                    <div className="text-sm text-gray-500">Общая выручка</div>
                    <div className="text-lg font-semibold text-gray-700 mt-1">
                        {totalQuantity.toLocaleString('ru-RU')} шт.
                    </div>
                    <div className="text-sm text-gray-500">Общее количество проданных запчастей</div>
                </div>
            </div>

            {/* Поисковое поле */}
            <div className="mb-6">
                <div className="max-w-md">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            placeholder="Поиск по номеру, внутр. коду, названию или бренду..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-base"
                        />
                        {searchQuery && (
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="text-gray-400 hover:text-gray-600 focus:outline-none"
                                >
                                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {salesLoading ? (
                <div className="text-center py-16 px-6">
                    <div className="bg-gray-100 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                        <svg className="animate-spin h-10 w-10 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    </div>
                    <h2 className="text-xl font-medium text-gray-900 mb-2">Загрузка продаж...</h2>
                    <p className="text-gray-600 text-base">Пожалуйста, подождите</p>
                </div>
            ) : error ? (
                <div className="text-center py-16 px-6">
                    <div className="bg-red-100 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-medium text-gray-900 mb-2">Ошибка загрузки продаж</h2>
                    <p className="text-gray-500 mb-6 text-base">{typeof error === 'object' ? JSON.stringify(error) : error}</p>
                    <button
                        onClick={() => dispatch(fetchWarehouseSales())}
                        className="inline-flex items-center px-5 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 min-h-[48px]"
                    >
                        Попробовать снова
                    </button>
                </div>
            ) : filteredSales.length === 0 ? (
                <div className="text-center py-16 px-6">
                    <div className="bg-gray-100 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                        <svg className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">
                        {searchQuery ? 'Ничего не найдено' : 'Продажи отсутствуют'}
                    </h2>
                    <p className="text-gray-600 text-base">
                        {searchQuery
                            ? `По запросу "${searchQuery}" ничего не найдено. Попробуйте изменить поисковый запрос.`
                            : 'Здесь будут отображаться записи о проданных запчастях со склада'
                        }
                    </p>
                </div>
            ) : (
                <>
                    {/* Десктопная версия - таблица */}
                    <div className="hidden md:block w-full">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Бренд</th>
                                    <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Номер</th>
                                    <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Внутр. код</th>
                                    <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Наименование</th>
                                    <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Кол-во</th>
                                    <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Цена, ₽</th>
                                    <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Сумма, ₽</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredSales.map((sale) => (
                                    <React.Fragment key={sale.id}>
                                        <tr
                                            className="cursor-pointer hover:bg-gray-50"
                                            onClick={() => toggleExpand(sale.id)}
                                        >
                                            <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{sale.product?.brand || '—'}</td>
                                            <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sale.product?.article || '—'}</td>
                                            <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-700">
                                                {sale.product?.internal_code || '—'}
                                            </td>
                                            <td className="px-2 sm:px-6 py-4 text-sm text-gray-500">{sale.product?.name || '—'}</td>
                                            <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sale.quantity} шт.</td>
                                            <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sale.sale_price ? `${parseFloat(sale.sale_price).toFixed(2)} ₽` : '—'}</td>
                                            <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {(sale.sale_price * sale.quantity).toFixed(2)} ₽
                                            </td>
                                        </tr>

                                        {/* Раскрывающаяся карточка */}
                                        {expandedDocId === sale.id && (
                                            <tr className="bg-gray-50">
                                                <td colSpan="7" className="px-6 py-4 border-t">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {/* Фото */}
                                                        <div>
                                                            <PhotoThumbnail photos={sale.product?.photos || []} onImageClick={handleImageClick} />
                                                        </div>

                                                        {/* Описание и информация */}
                                                        <div className="space-y-4">
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                <div>
                                                                    <span className="text-xs text-gray-500">Описание</span>
                                                                    <div className="font-medium mt-1">
                                                                        {sale.product?.description || '—'}
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <span className="text-xs text-gray-500">Дата продажи</span>
                                                                    <div className="font-medium mt-1">{sale.movement_date}</div>
                                                                </div>
                                                            </div>

                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div>
                                                                    <span className="text-xs text-gray-500">Склад</span>
                                                                    <div className="font-medium mt-1">{getStorageAddress(sale.storage_location_id)}</div>
                                                                </div>
                                                                <div>
                                                                    <span className="text-xs text-gray-500">Состояние</span>
                                                                    <div className="font-medium mt-1">
                                                                        {sale.product?.is_new ? (
                                                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                                                                                Новый
                                                                            </span>
                                                                        ) : (
                                                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                                                                                Б/у
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <span className="text-xs text-gray-500">Ответственный</span>
                                                                    <div className="font-medium mt-1">
                                                                        {sale.user ? `${sale.user.last_name} ${sale.user.first_name}${sale.user.patronymic ? ` ${sale.user.patronymic}` : ''}` : '—'}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Автомобиль(и) */}
                                                            {sale.product?.compatible_vehicles && sale.product.compatible_vehicles.length > 0 && (
                                                                <div>
                                                                    <span className="text-xs text-gray-500">Автомобиль</span>
                                                                    <div className="mt-2 space-y-3">
                                                                        {sale.product.compatible_vehicles.map((vehicle) => (
                                                                            <div
                                                                                key={vehicle.id}
                                                                                className="grid grid-cols-1 md:grid-cols-2 gap-2 p-3 bg-white rounded border"
                                                                            >
                                                                                <div>
                                                                                    <span className="text-xs text-gray-500">Марка</span>
                                                                                    <div className="font-medium">{vehicle.brand}</div>
                                                                                </div>
                                                                                <div>
                                                                                    <span className="text-xs text-gray-500">Модель</span>
                                                                                    <div className="font-medium">{vehicle.model}</div>
                                                                                </div>
                                                                                <div>
                                                                                    <span className="text-xs text-gray-500">Поколение</span>
                                                                                    <div className="font-medium">{vehicle.generation || '—'}</div>
                                                                                </div>
                                                                                <div>
                                                                                    <span className="text-xs text-gray-500">Двигатель</span>
                                                                                    <div className="font-medium">{vehicle.engine || '—'}</div>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Мобильная версия - карточки */}
                    <div className="md:hidden space-y-4">
                        {filteredSales.map((sale) => (
                            <div key={sale.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1 pr-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-base font-semibold text-gray-900">{sale.product?.brand || '—'}</span>
                                            <span className="text-sm text-gray-400">•</span>
                                            <span className="text-sm text-gray-500 font-mono">{sale.product?.article || '—'}</span>
                                        </div>
                                        <h3 className="text-base font-medium text-gray-800 mb-2 leading-tight">{sale.product?.name || '—'}</h3>
                                        {sale.product?.internal_code && (
                                            <div className="text-xs text-gray-500 font-mono mb-2">{sale.product.internal_code}</div>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-bold text-gray-700 mb-1">
                                            {(sale.sale_price * sale.quantity).toFixed(2)} ₽
                                        </div>
                                        <div className="text-sm text-gray-600">{sale.quantity} шт. × {parseFloat(sale.sale_price).toFixed(2)} ₽</div>
                                    </div>
                                </div>

                                <div className="pt-3 border-t border-gray-100">
                                    <button
                                        onClick={() => toggleExpand(sale.id)}
                                        className="w-full text-indigo-600 text-sm font-medium hover:text-indigo-800 transition-colors py-2"
                                    >
                                        {expandedDocId === sale.id ? 'Скрыть детали' : 'Показать детали'}
                                    </button>
                                </div>

                                {expandedDocId === sale.id && (
                                    <div className="mt-4 pt-4 border-t border-gray-200">
                                        <div className="grid grid-cols-1 gap-4">
                                            <div>
                                                <PhotoThumbnail photos={sale.product?.photos || []} onImageClick={handleImageClick} />
                                            </div>

                                            <div className="space-y-4">
                                                <div>
                                                    <span className="text-sm text-gray-500 block mb-1">Описание</span>
                                                    <div className="text-base text-gray-900">{sale.product?.description || '—'}</div>
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <div>
                                                        <span className="text-sm text-gray-500 block mb-1">Состояние</span>
                                                        <div className="text-base font-medium text-gray-900">
                                                            {sale.product?.is_new ? (
                                                                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                                                                    Новый
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                                                                    Б/у
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <span className="text-sm text-gray-500 block mb-1">Дата продажи</span>
                                                        <div className="text-base font-medium text-gray-900">{sale.movement_date}</div>
                                                    </div>
                                                    <div>
                                                        <span className="text-sm text-gray-500 block mb-1">Склад</span>
                                                        <div className="text-base font-medium text-gray-900">{getStorageAddress(sale.storage_location_id)}</div>
                                                    </div>
                                                    <div>
                                                        <span className="text-sm text-gray-500 block mb-1">Ответственный</span>
                                                        <div className="text-base font-medium text-gray-900">
                                                            {sale.user ? `${sale.user.last_name} ${sale.user.first_name}${sale.user.patronymic ? ` ${sale.user.patronymic}` : ''}` : '—'}
                                                        </div>
                                                    </div>
                                                </div>

                                                {sale.product?.compatible_vehicles && sale.product.compatible_vehicles.length > 0 && (
                                                    <div>
                                                        <span className="text-sm text-gray-500 block mb-2">Автомобиль</span>
                                                        <div className="space-y-3">
                                                            {sale.product.compatible_vehicles.map((vehicle) => (
                                                                <div
                                                                    key={vehicle.id}
                                                                    className="grid grid-cols-2 gap-2 p-3 bg-gray-50 rounded border text-sm"
                                                                >
                                                                    <div>
                                                                        <span className="text-gray-500">Марка:</span>
                                                                        <div className="font-medium">{vehicle.brand}</div>
                                                                    </div>
                                                                    <div>
                                                                        <span className="text-gray-500">Модель:</span>
                                                                        <div className="font-medium">{vehicle.model}</div>
                                                                    </div>
                                                                    <div>
                                                                        <span className="text-gray-500">Поколение:</span>
                                                                        <div className="font-medium">{vehicle.generation || '—'}</div>
                                                                    </div>
                                                                    <div>
                                                                        <span className="text-gray-500">Двигатель:</span>
                                                                        <div className="font-medium">{vehicle.engine || '—'}</div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </>
            )}

            <ImageModal
                isOpen={imageModalOpen}
                onClose={() => setImageModalOpen(false)}
                photos={selectedImages.photos}
                initialIndex={selectedImages.initialIndex}
                alt="Фото товара"
            />
        </div>
    );
};

export default WarehouseSalesPage;

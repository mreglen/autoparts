import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
    clearWorkspace,
    fetchSellerEmployees,
    fetchSellerProducts,
    fetchSellerProduct,
    fetchSellerStockIns,
    fetchSellerStockOuts,
    fetchSellerStorageLocations,
    fetchSellerVehicles,
    fetchSellerWarehouseSales,
    fetchSellerWorkspace,
} from '../../redux/slices/SellerSlice';
import { setAdminSellerMarkupContext } from '../../redux/slices/PublicInfoSlice';
import MediaModal from '../../components/MediaModal/MediaModal';
import { normalizeImageUrl } from '../../utils/apiClient';
import { SellerPartDetailModal, SellerVehicleDetailModal } from './SellerWorkspaceDetailModals';
import SellerWorkspaceClientsTab from './SellerWorkspaceClientsTab';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';

const TABS = [
    { id: 'overview', label: 'Обзор' },
    { id: 'parts', label: 'Склад' },
    { id: 'stock-in', label: 'Поступления' },
    { id: 'stock-out', label: 'Расходы' },
    { id: 'sales', label: 'Продажи' },
    { id: 'clients', label: 'Клиенты' },
    { id: 'vehicles', label: 'Автомобили' },
    { id: 'settings', label: 'Настройки' },
];

const formatCurrency = (amount) =>
    new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(amount || 0);

function LoadingBlock() {
    return (
        <div className="flex justify-center items-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
        </div>
    );
}

export default function SellerWorkspacePage() {
    const { sellerId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const backPath = location.state?.from || '/sellers';
    const backLabel = backPath.startsWith('/moderation/products') ? '← К модерации запчастей' : '← К списку продавцов';
    const dispatch = useDispatch();
    const { isReady, user } = useAuthReady();
    const {
        workspace,
        workspaceLoading,
        workspaceError,
        products,
        productsLoading,
        vehicles,
        vehiclesLoading,
        storageLocations,
        stockIns,
        stockInsLoading,
        stockOuts,
        stockOutsLoading,
        warehouseSales,
        warehouseSalesLoading,
        employees,
        employeesLoading,
    } = useSelector((state) => state.sellers);

    const [activeTab, setActiveTab] = useState('overview');
    const [partsSearch, setPartsSearch] = useState('');
    const [storageFilter, setStorageFilter] = useState('');
    const [selectedPart, setSelectedPart] = useState(null);
    const [selectedVehicle, setSelectedVehicle] = useState(null);
    const [mediaModalOpen, setMediaModalOpen] = useState(false);
    const [currentMediaItems, setCurrentMediaItems] = useState([]);
    const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
    const numericSellerId = Number(sellerId);

    useEffect(() => {
        if (!user?.is_admin || !numericSellerId) return undefined;
        dispatch(fetchSellerWorkspace(numericSellerId));
        dispatch(fetchSellerStorageLocations(numericSellerId));
        return () => {
            dispatch(clearWorkspace());
            dispatch(setAdminSellerMarkupContext(null));
        };
    }, [dispatch, user?.is_admin, numericSellerId]);

    useEffect(() => {
        if (!workspace || !numericSellerId) return;
        dispatch(setAdminSellerMarkupContext({
            sellerId: numericSellerId,
            organizationId: workspace.organization_id,
            markupPercent: workspace.new_parts_markup_percent,
        }));
    }, [workspace, dispatch, numericSellerId]);

    useEffect(() => {
        if (!numericSellerId) return;
        if (activeTab === 'parts') {
            dispatch(fetchSellerProducts({
                sellerId: numericSellerId,
                storageLocationId: storageFilter || undefined,
            }));
        } else if (activeTab === 'vehicles') {
            dispatch(fetchSellerVehicles(numericSellerId));
        } else if (activeTab === 'stock-in') {
            dispatch(fetchSellerStockIns(numericSellerId));
        } else if (activeTab === 'stock-out') {
            dispatch(fetchSellerStockOuts(numericSellerId));
        } else if (activeTab === 'sales') {
            dispatch(fetchSellerWarehouseSales(numericSellerId));
        } else if (activeTab === 'settings') {
            dispatch(fetchSellerEmployees(numericSellerId));
        }
    }, [activeTab, numericSellerId, storageFilter, dispatch]);

    const getStorageAddress = (storageLocationId) => {
        const loc = storageLocations.find((l) => l.id === storageLocationId);
        return loc?.address || null;
    };

    const itemToPartSnapshot = (item) => ({
        id: item.product_id,
        brand: item.brand || '—',
        article: item.partnumber || '—',
        name: item.name || '—',
        price: item.price,
        quantity: item.quantity,
        photos: [],
        videos: [],
        is_new: item.order_type === 'new',
    });

    const handleOpenClientOrderItem = async (item) => {
        const productId = item?.product_id;
        if (!productId) {
            setSelectedPart(itemToPartSnapshot(item));
            return;
        }
        const fromWarehouse = products.find((p) => p.id === productId);
        if (fromWarehouse) {
            setSelectedPart(fromWarehouse);
            return;
        }
        try {
            const full = await dispatch(fetchSellerProduct({
                sellerId: numericSellerId,
                productId,
            })).unwrap();
            setSelectedPart(full);
        } catch {
            setSelectedPart(itemToPartSnapshot(item));
        }
    };

    const openProductModal = async (row) => {
        const productId = row?.product?.id ?? row?.product_id;
        if (!productId) return;

        const fromWarehouse = products.find((p) => p.id === productId);
        if (fromWarehouse) {
            setSelectedPart(fromWarehouse);
            return;
        }

        const embedded = row?.product;
        if (embedded?.photos !== undefined && embedded?.brand) {
            setSelectedPart(embedded);
            return;
        }

        try {
            const full = await dispatch(fetchSellerProduct({
                sellerId: numericSellerId,
                productId,
            })).unwrap();
            setSelectedPart(full);
        } catch {
            if (embedded) setSelectedPart(embedded);
        }
    };

    const handleOpenMediaModal = (mediaItems, initialIndex = 0) => {
        const formattedMedia = mediaItems.map((item) => {
            const url = typeof item === 'string' ? item : (item.full_url || item.photo_url || item.video_url || '');
            const normalizedUrl = normalizeImageUrl(url);
            const isVideo = normalizedUrl.toLowerCase().match(/\.(mp4|webm|ogg|mov)$/);
            return { type: isVideo ? 'video' : 'image', src: normalizedUrl };
        });
        setCurrentMediaItems(formattedMedia);
        setCurrentMediaIndex(initialIndex);
        setMediaModalOpen(true);
    };

    const filteredProducts = useMemo(() => {
        const q = partsSearch.trim().toLowerCase();
        if (!q) return products;
        return products.filter((part) =>
            (part.article || '').toLowerCase().includes(q)
            || (part.name || '').toLowerCase().includes(q)
            || (part.brand || '').toLowerCase().includes(q)
            || (part.internal_code || '').toLowerCase().includes(q)
        );
    }, [products, partsSearch]);

    if (!isReady) {
        return <AuthLoadingScreen className="min-h-[16rem]" />;
    }

    if (!user?.is_admin) {
        return <Navigate to="/" replace />;
    }

    const stats = workspace?.stats;

    return (
        <div className="mt-4 sm:mt-5 px-4 sm:px-0">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <button
                        type="button"
                        onClick={() => navigate(backPath)}
                        className="text-sm text-indigo-600 hover:text-indigo-800 mb-2"
                    >
                        {backLabel}
                    </button>
                    <h1 className="text-2xl font-bold text-gray-900">
                        {workspaceLoading ? 'Загрузка…' : workspace?.seller_name || 'Рабочий стол продавца'}
                    </h1>
                    {workspace?.organization_name && (
                        <p className="text-sm text-gray-600 mt-1">{workspace.organization_name}</p>
                    )}
                </div>
            </div>

            {workspaceError && (
                <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
                    {workspaceError}
                </div>
            )}

            <div className="mb-6 border-b border-gray-200 overflow-x-auto">
                <div className="flex gap-6 min-w-max">
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={`pb-2 text-sm font-medium whitespace-nowrap border-b-4 ${
                                activeTab === tab.id
                                    ? 'border-indigo-500 text-gray-900'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {workspaceLoading && !workspace ? (
                <LoadingBlock />
            ) : (
                <>
                    {activeTab === 'overview' && workspace && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="bg-white rounded-xl border p-4">
                                    <p className="text-xs text-gray-500 uppercase">Позиций на складе</p>
                                    <p className="text-2xl font-bold mt-1">{stats?.totalProducts ?? 0}</p>
                                </div>
                                <div className="bg-white rounded-xl border p-4">
                                    <p className="text-xs text-gray-500 uppercase">Стоимость склада</p>
                                    <p className="text-2xl font-bold mt-1">{formatCurrency(stats?.totalWarehouseValue)}</p>
                                </div>
                                <div className="bg-white rounded-xl border p-4">
                                    <p className="text-xs text-gray-500 uppercase">Количество</p>
                                    <p className="text-2xl font-bold mt-1">{stats?.totalWarehouseQuantity ?? 0} шт.</p>
                                </div>
                                <div className="bg-white rounded-xl border p-4">
                                    <p className="text-xs text-gray-500 uppercase">Фактические продажи со склада</p>
                                    <p className="text-2xl font-bold mt-1">{formatCurrency(stats?.totalSales)}</p>
                                    <p className="text-xs text-gray-500 mt-1">Включая Авито после закрытия заказа</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="bg-white rounded-xl border p-6">
                                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Профиль и организация</h2>
                                    <dl className="space-y-2 text-sm">
                                        <div><dt className="text-gray-500 inline">Email: </dt><dd className="inline text-gray-900">{workspace.email}</dd></div>
                                        <div><dt className="text-gray-500 inline">Телефон: </dt><dd className="inline text-gray-900">{workspace.phone || '—'}</dd></div>
                                        <div><dt className="text-gray-500 inline">Адрес: </dt><dd className="inline text-gray-900">{workspace.organization_address || '—'}</dd></div>
                                        <div><dt className="text-gray-500 inline">Сотрудников: </dt><dd className="inline text-gray-900">{workspace.employees_count}</dd></div>
                                        <div><dt className="text-gray-500 inline">Клиентов: </dt><dd className="inline text-gray-900">{workspace.clients_count}</dd></div>
                                        <div><dt className="text-gray-500 inline">Автомобилей: </dt><dd className="inline text-gray-900">{workspace.vehicles_count}</dd></div>
                                        <div><dt className="text-gray-500 inline">Складов: </dt><dd className="inline text-gray-900">{workspace.storage_locations_count}</dd></div>
                                    </dl>
                                </div>

                                {/* Редактирование наценки убрано: наценка «на новые» управляется только в `/admin/rossko/markup-settings`. */}
                            </div>
                        </div>
                    )}

                    {activeTab === 'parts' && (
                        <div>
                            <div className="mb-4 flex flex-col md:flex-row gap-3">
                                <input
                                    type="text"
                                    placeholder="Поиск по артикулу, названию, бренду..."
                                    value={partsSearch}
                                    onChange={(e) => setPartsSearch(e.target.value)}
                                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
                                />
                                <select
                                    value={storageFilter}
                                    onChange={(e) => setStorageFilter(e.target.value)}
                                    className="md:w-64 border border-gray-300 rounded-md px-3 py-2 text-sm"
                                >
                                    <option value="">Все склады</option>
                                    {storageLocations.map((loc) => (
                                        <option key={loc.id} value={loc.id}>{loc.address}</option>
                                    ))}
                                </select>
                            </div>
                            {productsLoading ? (
                                <LoadingBlock />
                            ) : filteredProducts.length === 0 ? (
                                <p className="text-gray-500 py-8 text-center">Нет запчастей</p>
                            ) : (
                                <>
                                    <div className="md:hidden space-y-3">
                                        {filteredProducts.map((part) => (
                                            <button
                                                key={part.id}
                                                type="button"
                                                onClick={() => setSelectedPart(part)}
                                                className="w-full rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm active:bg-gray-50"
                                            >
                                                <p className="font-medium text-gray-900">{part.brand} · {part.article}</p>
                                                <p className="mt-1 text-sm text-gray-600">{part.name}</p>
                                                <div className="mt-2 flex justify-between text-sm">
                                                    <span className="text-gray-500">Остаток: <span className="font-medium text-gray-900">{part.quantity ?? 0}</span></span>
                                                    <span className="font-semibold text-gray-900">
                                                        {part.price != null ? `${Number(part.price).toLocaleString('ru-RU')} ₽` : '—'}
                                                    </span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                    <div className="hidden md:block bg-white border rounded-xl overflow-hidden">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Запчасть</th>
                                                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Остаток</th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Цена</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {filteredProducts.map((part) => (
                                                    <tr
                                                        key={part.id}
                                                        className="hover:bg-gray-50 cursor-pointer"
                                                        onClick={() => setSelectedPart(part)}
                                                    >
                                                        <td className="px-4 py-3">
                                                            <div className="font-medium text-gray-900">{part.brand} · {part.article}</div>
                                                            <div className="text-sm text-gray-600 line-clamp-1">{part.name}</div>
                                                        </td>
                                                        <td className="px-4 py-3 text-center text-sm">{part.quantity ?? 0}</td>
                                                        <td className="px-4 py-3 text-sm font-medium">
                                                            {part.price != null ? `${Number(part.price).toLocaleString('ru-RU')} ₽` : '—'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {activeTab === 'stock-in' && (
                        stockInsLoading ? <LoadingBlock /> : (
                            <SimpleTable
                                rows={stockIns}
                                columns={[
                                    {
                                        key: 'product',
                                        label: 'Товар',
                                        render: (r) => (
                                            r.product?.brand
                                                ? `${r.product.brand} · ${r.product.article || ''} — ${r.product.name || ''}`
                                                : (r.product?.name || r.product_id)
                                        ),
                                    },
                                    { key: 'quantity', label: 'Кол-во', render: (r) => r.quantity },
                                    { key: 'price', label: 'Цена', render: (r) => formatCurrency(r.sale_price) },
                                ]}
                                emptyText="Нет поступлений"
                                onRowClick={openProductModal}
                            />
                        )
                    )}

                    {activeTab === 'stock-out' && (
                        stockOutsLoading ? <LoadingBlock /> : (
                            <SimpleTable
                                rows={stockOuts}
                                columns={[
                                    {
                                        key: 'product',
                                        label: 'Товар',
                                        render: (r) => (
                                            r.product?.brand
                                                ? `${r.product.brand} · ${r.product.article || ''} — ${r.product.name || ''}`
                                                : (r.product?.name || r.product_id)
                                        ),
                                    },
                                    { key: 'quantity', label: 'Кол-во', render: (r) => r.quantity },
                                    { key: 'reason', label: 'Причина', render: (r) => r.reason || ((r.sale_price > 0 || r.sale_channel === 'avito') ? 'Продажа' : '—') },
                                ]}
                                emptyText="Нет расходов"
                                onRowClick={openProductModal}
                            />
                        )
                    )}

                    {activeTab === 'sales' && (
                        <>
                            <p className="text-sm text-gray-600 mb-4">
                                Только движения с ценой продажи (ручные и Авито после списания). Журнал всех движений — вкладка «Расходы».
                            </p>
                        {warehouseSalesLoading ? <LoadingBlock /> : (
                            <SimpleTable
                                rows={warehouseSales}
                                columns={[
                                    {
                                        key: 'product',
                                        label: 'Товар',
                                        render: (r) => (
                                            r.product?.brand
                                                ? `${r.product.brand} · ${r.product.article || ''} — ${r.product.name || ''}`
                                                : r.product_id
                                        ),
                                    },
                                    { key: 'quantity', label: 'Кол-во', render: (r) => r.quantity },
                                    { key: 'price', label: 'Цена', render: (r) => formatCurrency(r.sale_price) },
                                    { key: 'date', label: 'Дата', render: (r) => r.movement_date || '—' },
                                ]}
                                emptyText="Нет продаж"
                                onRowClick={openProductModal}
                            />
                        )}
                        </>
                    )}

                    {activeTab === 'clients' && (
                        <SellerWorkspaceClientsTab
                            sellerId={numericSellerId}
                            onOpenItem={handleOpenClientOrderItem}
                            onImageClick={handleOpenMediaModal}
                            selectedPart={selectedPart}
                            onClosePart={() => setSelectedPart(null)}
                        />
                    )}

                    {activeTab === 'vehicles' && (
                        vehiclesLoading ? <LoadingBlock /> : (
                            <SimpleTable
                                rows={vehicles}
                                columns={[
                                    { key: 'brand', label: 'Марка', render: (r) => r.brand },
                                    { key: 'model', label: 'Модель', render: (r) => r.model },
                                    { key: 'generation', label: 'Поколение', render: (r) => r.generation || '—' },
                                ]}
                                emptyText="Нет автомобилей"
                                onRowClick={(row) => setSelectedVehicle(row)}
                            />
                        )
                    )}

                    {activeTab === 'settings' && workspace && (
                        <div className="space-y-6">
                            <section className="bg-white rounded-xl border p-6">
                                <h2 className="text-lg font-semibold mb-3">Склады</h2>
                                {storageLocations.length === 0 ? (
                                    <p className="text-sm text-gray-500">Нет складов</p>
                                ) : (
                                    <ul className="space-y-2 text-sm">
                                        {storageLocations.map((loc) => (
                                            <li key={loc.id} className="text-gray-800">{loc.address}</li>
                                        ))}
                                    </ul>
                                )}
                            </section>
                            <section className="bg-white rounded-xl border p-6">
                                <h2 className="text-lg font-semibold mb-3">Сотрудники</h2>
                                {employeesLoading ? <LoadingBlock /> : employees.length === 0 ? (
                                    <p className="text-sm text-gray-500">Нет сотрудников</p>
                                ) : (
                                    <ul className="space-y-2 text-sm">
                                        {employees.map((emp) => (
                                            <li key={emp.id}>
                                                {emp.last_name} {emp.first_name} — {emp.email}
                                                {emp.is_employee && <span className="ml-2 text-xs text-gray-500">(сотрудник)</span>}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </section>
                            <section className="bg-white rounded-xl border p-6">
                                <h2 className="text-lg font-semibold mb-3">Интеграции</h2>
                                <p className="text-sm text-gray-600 mb-3">
                                    Управление интеграциями для организации <strong>{workspace.organization_id}</strong> доступно администратору через API организации.
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    <Link
                                        to={`/settings/integration/avito?org_id=${workspace.organization_id}`}
                                        className="px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
                                    >
                                        Avito
                                    </Link>
                                    <Link
                                        to={`/settings/integration/drom?org_id=${workspace.organization_id}`}
                                        className="px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
                                    >
                                        Drom
                                    </Link>
                                </div>
                            </section>
                        </div>
                    )}
                </>
            )}

            <SellerPartDetailModal
                part={selectedPart}
                isOpen={Boolean(selectedPart)}
                onClose={() => setSelectedPart(null)}
                getStorageAddress={getStorageAddress}
                onImageClick={handleOpenMediaModal}
            />
            <SellerVehicleDetailModal
                vehicle={selectedVehicle}
                isOpen={Boolean(selectedVehicle)}
                onClose={() => setSelectedVehicle(null)}
                getStorageAddress={getStorageAddress}
                onImageClick={handleOpenMediaModal}
            />
            <MediaModal
                isOpen={mediaModalOpen}
                onClose={() => setMediaModalOpen(false)}
                mediaItems={currentMediaItems}
                initialIndex={currentMediaIndex}
            />
        </div>
    );
}

function SimpleTable({ rows, columns, emptyText, onRowClick }) {
    if (!rows?.length) {
        return <p className="text-gray-500 py-8 text-center">{emptyText}</p>;
    }

    const CardWrapper = onRowClick ? 'button' : 'div';
    const cardProps = onRowClick
        ? { type: 'button', className: 'w-full rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm active:bg-gray-50' }
        : { className: 'rounded-xl border border-gray-200 bg-white p-4 shadow-sm' };

    return (
        <>
            <div className="md:hidden space-y-3">
                {rows.map((row, idx) => (
                    <CardWrapper
                        key={row.id ?? idx}
                        {...cardProps}
                        onClick={onRowClick ? () => onRowClick(row) : undefined}
                    >
                        <div className="space-y-2">
                            {columns.map((col) => (
                                <div key={col.key} className="flex justify-between gap-3 text-sm">
                                    <span className="shrink-0 text-gray-500">{col.label || col.key}</span>
                                    <span className="min-w-0 text-right font-medium text-gray-900 break-words">
                                        {col.render(row)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </CardWrapper>
                ))}
            </div>
            <div className="hidden md:block bg-white border rounded-xl overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <tbody className="divide-y divide-gray-100">
                        {rows.map((row, idx) => (
                            <tr
                                key={row.id ?? idx}
                                className={`hover:bg-gray-50 ${onRowClick ? 'cursor-pointer' : ''}`}
                                onClick={onRowClick ? () => onRowClick(row) : undefined}
                            >
                                {columns.map((col) => (
                                    <td key={col.key} className="px-4 py-3 text-sm text-gray-800">
                                        {col.render(row)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </>
    );
}

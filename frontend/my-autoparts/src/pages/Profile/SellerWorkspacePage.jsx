import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
    clearWorkspace,
    fetchSellerClients,
    fetchSellerEmployees,
    fetchSellerProducts,
    fetchSellerProduct,
    fetchSellerStockIns,
    fetchSellerStockOuts,
    fetchSellerStorageLocations,
    fetchSellerVehicles,
    fetchSellerWarehouseSales,
    fetchSellerWorkspace,
    resetSellerMarkup,
    updateSellerMarkup,
} from '../../redux/slices/SellerSlice';
import { setAdminSellerMarkupContext } from '../../redux/slices/PublicInfoSlice';
import MediaModal from '../../components/MediaModal/MediaModal';
import { normalizeImageUrl } from '../../utils/apiClient';
import { SellerPartDetailModal, SellerVehicleDetailModal } from './SellerWorkspaceDetailModals';
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
        clients,
        clientsLoading,
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
        markupSaving,
    } = useSelector((state) => state.sellers);

    const [activeTab, setActiveTab] = useState('overview');
    const [markupInput, setMarkupInput] = useState('');
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
        setMarkupInput(String(workspace.new_parts_markup_percent ?? ''));
    }, [workspace, dispatch, numericSellerId]);

    useEffect(() => {
        if (!numericSellerId) return;
        if (activeTab === 'parts') {
            dispatch(fetchSellerProducts({
                sellerId: numericSellerId,
                storageLocationId: storageFilter || undefined,
            }));
        } else if (activeTab === 'clients') {
            dispatch(fetchSellerClients(numericSellerId));
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

    const handleSaveMarkup = async () => {
        const n = parseFloat(String(markupInput).replace(',', '.'));
        if (!Number.isFinite(n) || n < 0 || n > 500) return;
        await dispatch(updateSellerMarkup({ sellerId: numericSellerId, new_parts_markup_percent: n })).unwrap();
    };

    const handleResetMarkup = async () => {
        const result = await dispatch(resetSellerMarkup(numericSellerId)).unwrap();
        setMarkupInput(String(result.new_parts_markup_percent ?? ''));
    };

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
                                    <p className="text-xs text-gray-500 uppercase">Продажи со склада</p>
                                    <p className="text-2xl font-bold mt-1">{formatCurrency(stats?.totalSales)}</p>
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

                                <div className="bg-white rounded-xl border p-6">
                                    <h2 className="text-lg font-semibold text-gray-900 mb-1">Наценка на новые запчасти</h2>
                                    <p className="text-sm text-gray-500 mb-4">
                                        Глобальная: {workspace.global_new_parts_markup_percent}%
                                        {workspace.new_parts_markup_manual ? ' · у этого продавца задана вручную' : ' · наследуется глобальная'}
                                    </p>
                                    <div className="flex flex-wrap items-end gap-3">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Наценка, %</label>
                                            <input
                                                type="number"
                                                min={0}
                                                max={500}
                                                step="0.01"
                                                value={markupInput}
                                                onChange={(e) => setMarkupInput(e.target.value)}
                                                className="block w-36 rounded-md border border-gray-300 px-3 py-2 text-sm"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            disabled={markupSaving}
                                            onClick={handleSaveMarkup}
                                            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                                        >
                                            Сохранить
                                        </button>
                                        <button
                                            type="button"
                                            disabled={markupSaving}
                                            onClick={handleResetMarkup}
                                            className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50"
                                        >
                                            Как глобальная
                                        </button>
                                    </div>
                                </div>
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
                                <div className="bg-white border rounded-xl overflow-hidden">
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
                                        render: (r) => (
                                            r.product?.brand
                                                ? `${r.product.brand} · ${r.product.article || ''} — ${r.product.name || ''}`
                                                : (r.product?.name || r.product_id)
                                        ),
                                    },
                                    { key: 'quantity', render: (r) => r.quantity },
                                    { key: 'price', render: (r) => formatCurrency(r.sale_price) },
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
                                        render: (r) => (
                                            r.product?.brand
                                                ? `${r.product.brand} · ${r.product.article || ''} — ${r.product.name || ''}`
                                                : (r.product?.name || r.product_id)
                                        ),
                                    },
                                    { key: 'quantity', render: (r) => r.quantity },
                                    { key: 'reason', render: (r) => r.reason || (r.sale_price > 0 ? 'Продажа' : '—') },
                                ]}
                                emptyText="Нет расходов"
                                onRowClick={openProductModal}
                            />
                        )
                    )}

                    {activeTab === 'sales' && (
                        warehouseSalesLoading ? <LoadingBlock /> : (
                            <SimpleTable
                                rows={warehouseSales}
                                columns={[
                                    {
                                        key: 'product',
                                        render: (r) => (
                                            r.product?.brand
                                                ? `${r.product.brand} · ${r.product.article || ''} — ${r.product.name || ''}`
                                                : r.product_id
                                        ),
                                    },
                                    { key: 'quantity', render: (r) => r.quantity },
                                    { key: 'price', render: (r) => formatCurrency(r.sale_price) },
                                    { key: 'date', render: (r) => r.movement_date || '—' },
                                ]}
                                emptyText="Нет продаж"
                                onRowClick={openProductModal}
                            />
                        )
                    )}

                    {activeTab === 'clients' && (
                        clientsLoading ? <LoadingBlock /> : (
                            <SimpleTable
                                rows={clients}
                                columns={[
                                    { key: 'name', render: (r) => `${r.last_name || ''} ${r.first_name || ''}`.trim() },
                                    { key: 'email', render: (r) => r.email },
                                    { key: 'phone', render: (r) => r.phone },
                                ]}
                                emptyText="Нет клиентов"
                            />
                        )
                    )}

                    {activeTab === 'vehicles' && (
                        vehiclesLoading ? <LoadingBlock /> : (
                            <SimpleTable
                                rows={vehicles}
                                columns={[
                                    { key: 'brand', render: (r) => r.brand },
                                    { key: 'model', render: (r) => r.model },
                                    { key: 'generation', render: (r) => r.generation || '—' },
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
    return (
        <div className="bg-white border rounded-xl overflow-x-auto">
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
    );
}

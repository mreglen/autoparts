import { useState, useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
    fetchClients,
    fetchClientBuyerOrders,
    deleteClient,
    clearError,
    clearBuyerOrders,
    selectClients,
    selectClientsLoading,
    selectClientsError,
    selectDeletingClient,
    selectBuyerOrders,
    selectBuyerOrdersLoading,
} from '../../redux/slices/ClientSlice';
import ClientOrdersModal from './ClientOrdersModal';
import MediaModal from '../../components/MediaModal/MediaModal';
import Modal, { ConfirmDialog } from '../../components/UI/Modal';
import { apiAxios, normalizeImageUrl } from '../../utils/apiClient';
import {
    autoserviceListMobileWrapClass,
    autoserviceListTableClass,
    autoserviceListTableWrapClass,
    autoserviceListTbodyClass,
    autoserviceListTdClass,
    autoserviceListTdRightClass,
    autoserviceListThClass,
    autoserviceListThRightClass,
    autoserviceListTheadRowClass,
    autoserviceListTrClickableClass,
    warehouseEmptyShellClass,
    warehousePageClass,
    warehousePillControlClass,
    warehousePrimaryButtonClass,
    warehouseSecondaryButtonClass,
} from '../../utils/warehouseListUi';

function clientFullName(client) {
    return `${client.last_name || ''} ${client.first_name || ''}${client.patronymic ? ` ${client.patronymic}` : ''}`.trim();
}

function itemToPartSnapshot(item) {
    return {
        id: item.product_id,
        brand: item.brand || '—',
        article: item.partnumber || '—',
        name: item.name || '—',
        price: item.price,
        quantity: item.quantity,
        photos: [],
        videos: [],
        is_new: item.order_type === 'new',
    };
}

export default function ClientsPage() {
    const dispatch = useDispatch();
    const clients = useSelector(selectClients);
    const loading = useSelector(selectClientsLoading);
    const error = useSelector(selectClientsError);
    const deleting = useSelector(selectDeletingClient);
    const buyerOrders = useSelector(selectBuyerOrders);
    const buyerOrdersLoading = useSelector(selectBuyerOrdersLoading);
    const user = useSelector((state) => state.auth.user);

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedClient, setSelectedClient] = useState(null);
    const [deleteConfirmClient, setDeleteConfirmClient] = useState(null);
    const [ordersClient, setOrdersClient] = useState(null);
    const [selectedPart, setSelectedPart] = useState(null);
    const [mediaModalOpen, setMediaModalOpen] = useState(false);
    const [currentMediaItems, setCurrentMediaItems] = useState([]);
    const [currentMediaIndex, setCurrentMediaIndex] = useState(0);

    useEffect(() => {
        if (user?.organization_id) {
            dispatch(fetchClients());
        }
    }, [dispatch, user?.organization_id]);

    useEffect(() => {
        if (error) dispatch(clearError());
    }, [error, dispatch]);

    const filteredClients = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return clients;
        return clients.filter((client) => {
            const fullName = clientFullName(client).toLowerCase();
            return (
                fullName.includes(q)
                || (client.email || '').toLowerCase().includes(q)
                || (client.phone || '').toLowerCase().includes(q)
            );
        });
    }, [clients, searchQuery]);

    const clientRowKey = (client) => client.id ?? `${client.email}-${client.phone}`;

    const handleOpenOrders = (client) => {
        setSelectedClient(null);
        setOrdersClient(client);
        dispatch(fetchClientBuyerOrders({
            clientId: client.id ?? undefined,
            email: client.email,
            phone: client.phone,
        }));
    };

    const handleCloseOrders = () => {
        setOrdersClient(null);
        setSelectedPart(null);
        dispatch(clearBuyerOrders());
    };

    const handleDelete = (client) => {
        if (!client.id) return;
        setDeleteConfirmClient(client);
    };

    const handleDeleteConfirm = async () => {
        if (!deleteConfirmClient?.id) return;
        const result = await dispatch(deleteClient(deleteConfirmClient.id));
        if (deleteClient.fulfilled.match(result)) {
            setDeleteConfirmClient(null);
            setSelectedClient(null);
            dispatch(fetchClients());
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

    const handleOpenItem = async (item) => {
        if (item.product_id) {
            try {
                const response = await apiAxios.get(`/products/${item.product_id}`);
                setSelectedPart(response.data);
                return;
            } catch {
                /* fallback to snapshot */
            }
        }
        setSelectedPart(itemToPartSnapshot(item));
    };

    if (!user?.organization_id) {
        return (
            <div className={warehousePageClass}>
                <p className={`${warehouseEmptyShellClass} text-sm text-gray-600`}>
                    Раздел доступен только для организации продавца.
                </p>
            </div>
        );
    }

    if (loading && clients.length === 0) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
            </div>
        );
    }

    return (
        <div className={`${warehousePageClass} min-w-0 space-y-4`}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <h1 className="text-2xl font-bold text-gray-900 sm:text-[1.75rem]">Клиенты</h1>
                <p className="text-sm text-gray-500">
                    Покупателей: <span className="font-semibold tabular-nums text-gray-900">{clients.length}</span>
                </p>
            </div>

            <div className="max-w-md">
                <input
                    type="search"
                    placeholder="ФИО, email, телефон"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={warehousePillControlClass}
                />
            </div>

            {error && (
                <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200 text-sm">
                    {typeof error === 'string' ? error : 'Ошибка загрузки'}
                </div>
            )}

            {filteredClients.length === 0 ? (
                <div className="mt-12 text-center py-16 px-6">
                    <div className="bg-gray-100 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                        <svg className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">
                        {searchQuery ? 'Ничего не найдено' : 'Пока нет клиентов с заказами'}
                    </h2>
                    <p className="text-gray-600 text-sm">
                        Здесь отображаются только покупатели, оформившие заказ у вашей организации.
                    </p>
                </div>
            ) : (
                <>
                    <div className={autoserviceListTableWrapClass}>
                        <table className={autoserviceListTableClass}>
                            <thead>
                                <tr className={autoserviceListTheadRowClass}>
                                    <th className={`w-2/5 ${autoserviceListThClass}`}>Клиент</th>
                                    <th className={`w-1/4 ${autoserviceListThClass}`}>Email</th>
                                    <th className={`w-1/4 ${autoserviceListThClass}`}>Телефон</th>
                                    <th className={`w-20 ${autoserviceListThRightClass}`}>Заказов</th>
                                </tr>
                            </thead>
                            <tbody className={autoserviceListTbodyClass}>
                                {filteredClients.map((client) => (
                                    <tr
                                        key={clientRowKey(client)}
                                        onClick={() => setSelectedClient(client)}
                                        className={autoserviceListTrClickableClass}
                                    >
                                        <td className={`min-w-0 ${autoserviceListTdClass}`}>
                                            <div className="w-0 min-w-full truncate font-semibold text-ink">
                                                {clientFullName(client) || '—'}
                                            </div>
                                        </td>
                                        <td className={`min-w-0 ${autoserviceListTdClass}`}>
                                            <div className="w-0 min-w-full truncate text-ink-muted">{client.email || '—'}</div>
                                        </td>
                                        <td className={`${autoserviceListTdClass} whitespace-nowrap text-ink-muted`}>
                                            {client.phone || '—'}
                                        </td>
                                        <td className={`${autoserviceListTdRightClass} tabular-nums font-semibold text-ink`}>
                                            {client.orders_count ?? 0}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className={autoserviceListMobileWrapClass}>
                        {filteredClients.map((client) => (
                            <button
                                key={clientRowKey(client)}
                                type="button"
                                onClick={() => setSelectedClient(client)}
                                className="w-full border-b border-line-soft py-2 text-left last:border-0"
                            >
                                <div className="flex justify-between gap-2">
                                    <span className="truncate font-medium text-ink">{clientFullName(client) || '—'}</span>
                                    <span className="shrink-0 tabular-nums text-ink-muted">{client.orders_count ?? 0}</span>
                                </div>
                                <p className="mt-1 truncate text-xs text-ink-muted">
                                    {[client.phone, client.email].filter(Boolean).join(' · ') || '—'}
                                </p>
                            </button>
                        ))}
                    </div>
                </>
            )}

            <Modal
                open={Boolean(selectedClient)}
                onClose={() => setSelectedClient(null)}
                title={selectedClient ? clientFullName(selectedClient) || 'Клиент' : 'Клиент'}
                size="md"
            >
                {selectedClient ? (
                    <div className="space-y-5">
                        <dl className="grid gap-4 text-sm sm:grid-cols-2">
                            <div>
                                <dt className="text-ink-muted">Email</dt>
                                <dd className="mt-0.5 font-medium text-ink">{selectedClient.email || '—'}</dd>
                            </div>
                            <div>
                                <dt className="text-ink-muted">Телефон</dt>
                                <dd className="mt-0.5 font-medium text-ink">{selectedClient.phone || '—'}</dd>
                            </div>
                            <div>
                                <dt className="text-ink-muted">Количество заказов</dt>
                                <dd className="mt-0.5 font-semibold tabular-nums text-ink">
                                    {selectedClient.orders_count ?? 0}
                                </dd>
                            </div>
                        </dl>
                        <div className="flex flex-wrap justify-end gap-2">
                            {selectedClient.id ? (
                                <button
                                    type="button"
                                    onClick={() => handleDelete(selectedClient)}
                                    disabled={deleting}
                                    className="inline-flex min-h-11 items-center justify-center rounded-sg-sm bg-danger-600 px-4 text-sm font-semibold text-white transition hover:bg-danger-700 disabled:opacity-60"
                                >
                                    Удалить из справочника
                                </button>
                            ) : null}
                            <button
                                type="button"
                                onClick={() => setSelectedClient(null)}
                                className={warehouseSecondaryButtonClass}
                            >
                                Закрыть
                            </button>
                            <button
                                type="button"
                                onClick={() => handleOpenOrders(selectedClient)}
                                className={warehousePrimaryButtonClass}
                            >
                                Просмотреть заказы
                            </button>
                        </div>
                    </div>
                ) : null}
            </Modal>

            <ConfirmDialog
                open={Boolean(deleteConfirmClient)}
                onClose={() => {
                    if (!deleting) setDeleteConfirmClient(null);
                }}
                onConfirm={handleDeleteConfirm}
                title="Удалить клиента?"
                message="Карточка клиента будет удалена из справочника. Оформленные заказы сохранятся."
                confirmLabel="Удалить"
                danger
                loading={deleting}
            />

            <ClientOrdersModal
                isOpen={Boolean(ordersClient)}
                onClose={handleCloseOrders}
                buyerOrders={buyerOrders}
                loading={buyerOrdersLoading}
                onOpenItem={handleOpenItem}
                selectedPart={selectedPart}
                onClosePart={() => setSelectedPart(null)}
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

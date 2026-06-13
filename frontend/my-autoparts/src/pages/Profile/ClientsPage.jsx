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
import { apiAxios, normalizeImageUrl } from '../../utils/apiClient';
import ActionsDropdown, { ActionsDropdownItem } from '../../components/ActionsDropdown/ActionsDropdown';

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
    const [openActionsId, setOpenActionsId] = useState(null);
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

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (!e.target.closest('.actions-dropdown')) {
                setOpenActionsId(null);
            }
        };
        if (openActionsId) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [openActionsId]);

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

    const lastClientRowKey = useMemo(() => {
        if (filteredClients.length === 0) return null;
        return clientRowKey(filteredClients[filteredClients.length - 1]);
    }, [filteredClients]);

    const handleOpenOrders = (client) => {
        setOpenActionsId(null);
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
        setOpenActionsId(null);
        if (window.confirm('Удалить карточку клиента из справочника? Заказы сохранятся.')) {
            dispatch(deleteClient(client.id)).then((result) => {
                if (deleteClient.fulfilled.match(result)) {
                    dispatch(fetchClients());
                }
            });
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
            <div className="mt-4 px-4 sm:px-0">
                <p className="text-gray-600">Раздел доступен только для организации продавца.</p>
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
        <div className="mt-4 sm:mt-5 px-4 sm:px-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
                <h1 className="text-2xl font-bold text-gray-800">Клиенты</h1>
                <p className="text-sm text-gray-500">
                    Покупатели с заказами: <span className="font-semibold text-gray-900">{clients.length}</span>
                </p>
            </div>

            <div className="mb-6 flex-1 max-w-md">
                <label className="block text-sm font-medium text-gray-700 mb-1">Поиск</label>
                <div className="relative">
                    <input
                        type="text"
                        placeholder="ФИО, email, телефон..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                </div>
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
                    <div
                        className={`hidden md:block w-full rounded-xl border border-gray-200 bg-white ${
                            openActionsId ? 'overflow-visible' : 'overflow-x-auto overflow-hidden'
                        }`}
                    >
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Клиент</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Контакты</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Заказов</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Действия</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredClients.map((client) => {
                                    const rowKey = clientRowKey(client);
                                    const isMenuOpen = openActionsId === rowKey;
                                    return (
                                        <tr
                                            key={rowKey}
                                            className={`hover:bg-gray-50/50 ${isMenuOpen ? 'relative z-30' : ''}`}
                                        >
                                            <td className="px-4 py-4">
                                                <div className="text-sm font-semibold text-gray-900">
                                                    {clientFullName(client) || '—'}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-sm text-gray-600">
                                                <div>{client.email}</div>
                                                <div className="text-gray-500">{client.phone}</div>
                                            </td>
                                            <td className="px-4 py-4 text-center text-sm font-medium text-gray-900">
                                                {client.orders_count ?? 0}
                                            </td>
                                            <td className={`px-4 py-4 text-right ${isMenuOpen ? 'relative z-30' : ''}`}>
                                                <ActionsDropdown
                                                    isOpen={isMenuOpen}
                                                    onOpenChange={(next) => setOpenActionsId(next ? rowKey : null)}
                                                    menuClassName="w-56 z-50"
                                                    estimatedMenuHeight={client.id ? 120 : 56}
                                                    preferOpenUp={rowKey === lastClientRowKey}
                                                >
                                                    <ActionsDropdownItem onClick={() => handleOpenOrders(client)}>
                                                        Просмотреть заказы
                                                    </ActionsDropdownItem>
                                                    {client.id && (
                                                        <ActionsDropdownItem
                                                            danger
                                                            disabled={deleting}
                                                            onClick={() => handleDelete(client)}
                                                        >
                                                            Удалить из справочника
                                                        </ActionsDropdownItem>
                                                    )}
                                                </ActionsDropdown>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="md:hidden space-y-3">
                        {filteredClients.map((client) => (
                            <div key={clientRowKey(client)} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                                <div className="flex justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <h3 className="font-semibold text-gray-900">{clientFullName(client) || '—'}</h3>
                                        <p className="text-sm text-gray-500 mt-1">{client.email}</p>
                                        <p className="text-sm text-gray-500">{client.phone}</p>
                                        <p className="text-sm mt-2 text-gray-700">
                                            Заказов: <span className="font-medium">{client.orders_count ?? 0}</span>
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleOpenOrders(client)}
                                        className="flex-shrink-0 px-3 py-2 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50"
                                    >
                                        Заказы
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

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

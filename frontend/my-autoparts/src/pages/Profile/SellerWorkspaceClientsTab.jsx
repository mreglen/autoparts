import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    clearSellerBuyerOrders,
    fetchSellerClientBuyerOrders,
    fetchSellerClients,
} from '../../redux/slices/SellerSlice';
import ClientOrdersModal from './ClientOrdersModal';
import ActionsDropdown, { ActionsDropdownItem } from '../../components/ActionsDropdown/ActionsDropdown';

function clientFullName(client) {
    return `${client.last_name || ''} ${client.first_name || ''}${client.patronymic ? ` ${client.patronymic}` : ''}`.trim();
}

function clientRowKey(client) {
    return client.id ?? `${client.email}-${client.phone}`;
}

export default function SellerWorkspaceClientsTab({
    sellerId,
    onOpenItem,
    onImageClick,
    selectedPart,
    onClosePart,
}) {
    const dispatch = useDispatch();
    const clients = useSelector((state) => state.sellers.clients);
    const clientsLoading = useSelector((state) => state.sellers.clientsLoading);
    const buyerOrders = useSelector((state) => state.sellers.sellerBuyerOrders);
    const buyerOrdersLoading = useSelector((state) => state.sellers.sellerBuyerOrdersLoading);

    const [searchQuery, setSearchQuery] = useState('');
    const [openActionsId, setOpenActionsId] = useState(null);
    const [ordersClient, setOrdersClient] = useState(null);

    useEffect(() => {
        if (sellerId) {
            dispatch(fetchSellerClients(sellerId));
        }
    }, [dispatch, sellerId]);

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

    const handleOpenOrders = (client) => {
        setOpenActionsId(null);
        setOrdersClient(client);
        dispatch(fetchSellerClientBuyerOrders({
            sellerId,
            clientId: client.id ?? undefined,
            email: client.email,
            phone: client.phone,
        }));
    };

    const handleCloseOrders = () => {
        setOrdersClient(null);
        onClosePart();
        dispatch(clearSellerBuyerOrders());
    };

    if (clientsLoading && clients.length === 0) {
        return (
            <div className="flex justify-center items-center py-16">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
            </div>
        );
    }

    return (
        <div>
            <p className="text-sm text-gray-500 mb-4">
                Покупатели с заказами у организации этого продавца:{' '}
                <span className="font-semibold text-gray-900">{clients.length}</span>
            </p>

            <div className="mb-4 max-w-md">
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

            {filteredClients.length === 0 ? (
                <p className="text-center text-gray-500 py-12">
                    {searchQuery ? 'Ничего не найдено' : 'Пока нет клиентов с заказами'}
                </p>
            ) : (
                <>
                    <div className={`hidden md:block w-full ${openActionsId ? 'overflow-visible' : 'overflow-x-auto'}`}>
                        <table className="min-w-full divide-y divide-gray-200 bg-white border border-gray-200 rounded-xl overflow-hidden">
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
                                                    estimatedMenuHeight={56}
                                                >
                                                    <ActionsDropdownItem onClick={() => handleOpenOrders(client)}>
                                                        Просмотреть заказы
                                                    </ActionsDropdownItem>
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
                onOpenItem={onOpenItem}
                selectedPart={selectedPart}
                onClosePart={onClosePart}
                onImageClick={onImageClick}
            />
        </div>
    );
}

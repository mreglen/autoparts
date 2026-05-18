import React, { useState, useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
    fetchPendingProducts,
    fetchRejectedProducts,
    approveProduct,
    rejectProduct,
    clearModerationError,
} from '../../../redux/slices/ModerationProductsSlice.js';
import RejectProductModal from '../../../components/RejectProductModal/RejectProductModal.jsx';
import SuccessModal from '../../../components/SuccessModal/SuccessModal.jsx';
import ConfirmModal from '../../../components/ConfirmModal/ConfirmModal.jsx';
import ErrorModal from '../../../components/ErrorModal/ErrorModal.jsx';
import { normalizeImageUrl } from '../../../utils/apiClient.js';

const UNKNOWN_ORG_ID = 'unknown';

const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const formatPrice = (price) => (
    new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
        minimumFractionDigits: 0,
    }).format(Number(price) || 0)
);

const getOrganization = (product) => (
    product.organization || {
        id: product.organization_id || UNKNOWN_ORG_ID,
        name: product.organization_id ? `Организация ${product.organization_id}` : 'Без организации',
        phone: null,
        logo_organization: null,
    }
);

const getFirstPhoto = (product) => {
    const photo = product.photos?.[0];
    if (!photo) return null;
    return typeof photo === 'string' ? photo : (photo.full_url || photo.photo_url || photo.url || null);
};

const buildOrganizations = (pendingProducts, rejectedProducts) => {
    const grouped = new Map();

    const ensureGroup = (product) => {
        const org = getOrganization(product);
        const id = org?.id || product.organization_id || UNKNOWN_ORG_ID;
        if (!grouped.has(id)) {
            grouped.set(id, {
                organization: { ...org, id },
                pending: [],
                rejected: [],
            });
        }
        return grouped.get(id);
    };

    pendingProducts.forEach((product) => ensureGroup(product).pending.push(product));
    rejectedProducts.forEach((product) => ensureGroup(product).rejected.push(product));

    return Array.from(grouped.values()).sort((a, b) => {
        if (b.pending.length !== a.pending.length) return b.pending.length - a.pending.length;
        return String(a.organization.name || '').localeCompare(String(b.organization.name || ''), 'ru');
    });
};

const EmptyState = ({ title, text }) => (
    <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
        <h3 className="text-sm font-medium text-gray-900">{title}</h3>
        {text && <p className="mt-1 text-sm text-gray-500">{text}</p>}
    </div>
);

const OrganizationCard = ({ group, selected, onClick }) => {
    const { organization, pending, rejected } = group;
    const hasPending = pending.length > 0;
    const logoUrl = organization.logo_organization ? normalizeImageUrl(organization.logo_organization) : null;

    return (
        <button
            type="button"
            onClick={onClick}
            className={`w-full text-left bg-white border rounded-xl p-4 transition-shadow hover:shadow-md ${
                selected ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-gray-200'
            }`}
        >
            <div className="flex gap-4">
                <div className="w-16 h-16 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {logoUrl ? (
                        <img src={logoUrl} alt={organization.name || organization.id} className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-xs text-gray-400">Нет фото</span>
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 truncate">
                            {organization.name || 'Без названия'}
                        </h3>
                        {hasPending && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                есть на модерации
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-gray-500">ID: {organization.id}</p>
                    <p className="text-sm text-gray-500">Телефон: {organization.phone || '—'}</p>
                    <div className="flex gap-2 mt-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                            Ожидают: {pending.length}
                        </span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">
                            Отклонённые: {rejected.length}
                        </span>
                    </div>
                </div>
            </div>
        </button>
    );
};

const ProductTable = ({ products, status, onApprove, onReject }) => {
    if (!products.length) {
        return (
            <EmptyState
                title={status === 'pending' ? 'Нет запчастей на модерации' : 'Нет отклонённых запчастей'}
                text={status === 'pending' ? 'У выбранной организации нет ожидающих заявок.' : 'У выбранной организации нет отклонённых заявок.'}
            />
        );
    }

    return (
        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Фото</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Запчасть</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Цена</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Кол-во</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Склад</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дата</th>
                        {status === 'rejected' && (
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Причина</th>
                        )}
                        {status === 'pending' && (
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Действия</th>
                        )}
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {products.map((product) => {
                        const photo = getFirstPhoto(product);
                        const photoUrl = photo ? normalizeImageUrl(photo) : null;

                        return (
                            <tr key={product.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 whitespace-nowrap">
                                    <div className="w-14 h-14 rounded bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center">
                                        {photoUrl ? (
                                            <img src={photoUrl} alt={product.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-xs text-gray-400">Нет</span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="font-medium text-gray-900">{product.name || '—'}</div>
                                    <div className="text-sm text-gray-500">
                                        {product.brand || '—'} · {product.article || '—'} · ID {product.id}
                                    </div>
                                    <div className="mt-1 text-xs text-gray-500">
                                        {product.is_new ? 'Новая' : 'Б/у'}
                                    </div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{formatPrice(product.price)}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{product.quantity ?? '—'} шт.</td>
                                <td className="px-4 py-3 text-sm text-gray-600">
                                    {product.storage_location_address || `Склад #${product.storage_location_id || '—'}`}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                    {status === 'rejected' ? formatDate(product.rejected_at || product.created_at) : formatDate(product.created_at)}
                                </td>
                                {status === 'rejected' && (
                                    <td className="px-4 py-3 text-sm text-red-700 max-w-xs">
                                        {product.rejection_reason || '—'}
                                    </td>
                                )}
                                {status === 'pending' && (
                                    <td className="px-4 py-3 whitespace-nowrap text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                type="button"
                                                onClick={() => onApprove(product.id)}
                                                className="px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
                                            >
                                                Принять
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => onReject(product)}
                                                className="px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
                                            >
                                                Отклонить
                                            </button>
                                        </div>
                                    </td>
                                )}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

const ProductModeration = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const user = useSelector((state) => state.auth.user);

    const { pendingProducts, rejectedProducts, loading, error } = useSelector((state) => state.moderationProducts);

    const [activeStatus, setActiveStatus] = useState('pending');
    const [selectedOrganizationId, setSelectedOrganizationId] = useState(null);
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);

    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const [successModalData, setSuccessModalData] = useState({ title: '', message: '' });

    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [confirmModalData, setConfirmModalData] = useState({
        title: '',
        message: '',
        onConfirm: null,
    });

    const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
    const [errorModalData, setErrorModalData] = useState({ title: '', message: '' });

    useEffect(() => {
        if (!user || !user.is_admin) {
            navigate('/');
        }
    }, [user, navigate]);

    useEffect(() => {
        if (!user?.is_admin) return;
        dispatch(fetchPendingProducts());
        dispatch(fetchRejectedProducts());
    }, [dispatch, user?.is_admin]);

    const organizationGroups = useMemo(
        () => buildOrganizations(pendingProducts, rejectedProducts),
        [pendingProducts, rejectedProducts]
    );

    const selectedGroup = useMemo(() => (
        organizationGroups.find((group) => group.organization.id === selectedOrganizationId) || null
    ), [organizationGroups, selectedOrganizationId]);

    useEffect(() => {
        if (!selectedOrganizationId || selectedGroup || organizationGroups.length === 0) return;
        setSelectedOrganizationId(null);
    }, [organizationGroups.length, selectedGroup, selectedOrganizationId]);

    useEffect(() => {
        if (error) {
            setErrorModalData({
                title: 'Ошибка',
                message: error,
            });
            setIsErrorModalOpen(true);
            dispatch(clearModerationError());
        }
    }, [error, dispatch]);

    const handleApprove = async (productId) => {
        setConfirmModalData({
            title: 'Одобрить запчасть',
            message: 'Вы уверены, что хотите одобрить эту запчасть?',
            onConfirm: async () => {
                try {
                    await dispatch(approveProduct(productId)).unwrap();
                    setSuccessModalData({
                        title: 'Успешно!',
                        message: 'Запчасть успешно одобрена и добавлена в каталог',
                    });
                    setIsSuccessModalOpen(true);
                } catch (err) {
                    // Ошибка будет обработана через Redux state.
                }
            },
        });
        setIsConfirmModalOpen(true);
    };

    const handleRejectClick = (product) => {
        setSelectedProduct(product);
        setIsRejectModalOpen(true);
    };

    const handleRejectSubmit = async (reason) => {
        try {
            await dispatch(rejectProduct({
                productId: selectedProduct.id,
                reason,
            })).unwrap();
            await dispatch(fetchRejectedProducts()).unwrap();
            setSuccessModalData({
                title: 'Успешно!',
                message: 'Запчасть отклонена',
            });
            setIsSuccessModalOpen(true);
            setIsRejectModalOpen(false);
            setSelectedProduct(null);
        } catch (err) {
            // Ошибка будет обработана через Redux state.
        }
    };

    if (!user || !user.is_admin) {
        return (
            <div className="max-w-4xl mx-auto p-6">
                <div className="text-center py-8 text-gray-500">Доступ запрещен</div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Модерация запчастей</h1>
                <p className="text-gray-600 mt-2">
                    Сначала выберите организацию, затем проверьте ожидающие или отклонённые запчасти.
                </p>
            </div>

            {loading ? (
                <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    <p className="mt-4 text-gray-600">Загрузка...</p>
                </div>
            ) : organizationGroups.length === 0 ? (
                <EmptyState
                    title="Нет организаций с запчастями для модерации"
                    text="Ожидающие и отклонённые запчасти отсутствуют."
                />
            ) : (
                <div className="space-y-6">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 mb-3">Организации</h2>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {organizationGroups.map((group) => (
                                <OrganizationCard
                                    key={group.organization.id}
                                    group={group}
                                    selected={selectedOrganizationId === group.organization.id}
                                    onClick={() => {
                                        setSelectedOrganizationId(group.organization.id);
                                        setActiveStatus(group.pending.length > 0 ? 'pending' : 'rejected');
                                    }}
                                />
                            ))}
                        </div>
                    </div>

                    {selectedGroup && (
                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                                <div>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedOrganizationId(null)}
                                        className="text-sm font-medium text-indigo-600 hover:text-indigo-800 mb-2"
                                    >
                                        ← К организациям
                                    </button>
                                    <h2 className="text-xl font-semibold text-gray-900">
                                        {selectedGroup.organization.name || 'Без названия'}
                                    </h2>
                                    <p className="text-sm text-gray-500">
                                        ID: {selectedGroup.organization.id} · Телефон: {selectedGroup.organization.phone || '—'}
                                    </p>
                                </div>
                            </div>

                            <div className="border-b border-gray-200 mb-4">
                                <nav className="-mb-px flex gap-6">
                                    <button
                                        type="button"
                                        onClick={() => setActiveStatus('pending')}
                                        className={`py-3 px-1 border-b-2 font-medium text-sm ${
                                            activeStatus === 'pending'
                                                ? 'border-indigo-500 text-indigo-600'
                                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                        }`}
                                    >
                                        Ожидают модерации
                                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                            {selectedGroup.pending.length}
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveStatus('rejected')}
                                        className={`py-3 px-1 border-b-2 font-medium text-sm ${
                                            activeStatus === 'rejected'
                                                ? 'border-indigo-500 text-indigo-600'
                                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                        }`}
                                    >
                                        Отклонённые
                                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                            {selectedGroup.rejected.length}
                                        </span>
                                    </button>
                                </nav>
                            </div>

                            <ProductTable
                                products={activeStatus === 'pending' ? selectedGroup.pending : selectedGroup.rejected}
                                status={activeStatus}
                                onApprove={handleApprove}
                                onReject={handleRejectClick}
                            />
                        </div>
                    )}
                </div>
            )}

            <RejectProductModal
                isOpen={isRejectModalOpen}
                onClose={() => {
                    setIsRejectModalOpen(false);
                    setSelectedProduct(null);
                }}
                onReject={handleRejectSubmit}
                productName={selectedProduct?.name}
            />

            <SuccessModal
                isOpen={isSuccessModalOpen}
                onClose={() => setIsSuccessModalOpen(false)}
                title={successModalData.title}
                message={successModalData.message}
            />

            <ConfirmModal
                isOpen={isConfirmModalOpen}
                onClose={() => setIsConfirmModalOpen(false)}
                title={confirmModalData.title}
                message={confirmModalData.message}
                onConfirm={confirmModalData.onConfirm}
            />

            <ErrorModal
                isOpen={isErrorModalOpen}
                onClose={() => setIsErrorModalOpen(false)}
                title={errorModalData.title}
                message={errorModalData.message}
            />
        </div>
    );
};

export default ProductModeration;

import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import {
    fetchPendingProducts,
    fetchRejectedProducts,
    approveProduct,
    rejectProduct,
    clearModerationError,
} from '../../../redux/slices/ModerationProductsSlice.js';
import { fetchSellers } from '../../../redux/slices/SellerSlice';
import RejectProductModal from '../../../components/RejectProductModal/RejectProductModal.jsx';
import SuccessModal from '../../../components/SuccessModal/SuccessModal.jsx';
import ConfirmModal from '../../../components/ConfirmModal/ConfirmModal.jsx';
import ErrorModal from '../../../components/ErrorModal/ErrorModal.jsx';
import { normalizeImageUrl } from '../../../utils/apiClient.js';
import { buildOrganizations, ProductTable } from './productModerationShared.jsx';
import { useAuthReady } from '../../../hooks/useAuthReady';
import AuthLoadingScreen from '../../../components/AuthLoadingScreen/AuthLoadingScreen';

function resolveSellerIdForOrganization(sellers, organizationId) {
    if (!organizationId || organizationId === 'unknown') return null;
    const orgSellers = sellers.filter(
        (s) => String(s.organization_id) === String(organizationId) && !s.is_employee,
    );
    if (!orgSellers.length) return null;
    const director = orgSellers.find((s) => s.is_director);
    return (director || orgSellers[0]).id;
}

export default function OrganizationProductModerationPage() {
    const { organizationId } = useParams();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { isReady, user } = useAuthReady();
    const { pendingProducts, rejectedProducts, loading, error } = useSelector((state) => state.moderationProducts);
    const sellers = useSelector((state) => state.sellers.sellers);

    const [activeStatus, setActiveStatus] = useState('pending');
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const [successModalData, setSuccessModalData] = useState({ title: '', message: '' });
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [confirmModalData, setConfirmModalData] = useState({ title: '', message: '', onConfirm: null });
    const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
    const [errorModalData, setErrorModalData] = useState({ title: '', message: '' });

    useEffect(() => {
        if (!user?.is_admin) return;
        dispatch(fetchPendingProducts());
        dispatch(fetchRejectedProducts());
        if (!sellers.length) dispatch(fetchSellers());
    }, [dispatch, user?.is_admin, sellers.length]);

    const organizationGroups = useMemo(
        () => buildOrganizations(pendingProducts, rejectedProducts),
        [pendingProducts, rejectedProducts],
    );

    const selectedGroup = useMemo(
        () => organizationGroups.find((group) => String(group.organization.id) === String(organizationId)) || null,
        [organizationGroups, organizationId],
    );

    const sellerId = useMemo(
        () => resolveSellerIdForOrganization(sellers, organizationId),
        [sellers, organizationId],
    );

    useEffect(() => {
        if (!selectedGroup) return;
        setActiveStatus(selectedGroup.pending.length > 0 ? 'pending' : 'rejected');
    }, [selectedGroup?.organization.id]);

    useEffect(() => {
        if (error) {
            setErrorModalData({ title: 'Ошибка', message: error });
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
                } catch {
                    /* handled via redux */
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
            setSuccessModalData({ title: 'Успешно!', message: 'Запчасть отклонена' });
            setIsSuccessModalOpen(true);
            setIsRejectModalOpen(false);
            setSelectedProduct(null);
        } catch {
            /* handled via redux */
        }
    };

    if (!isReady) {
        return (
            <div className="max-w-7xl mx-auto p-6">
                <AuthLoadingScreen />
            </div>
        );
    }

    if (!user?.is_admin) {
        return <Navigate to="/" replace />;
    }

    if (!loading && !selectedGroup) {
        return <Navigate to="/moderation/products" replace />;
    }

    const { organization } = selectedGroup || { organization: {} };
    const logoUrl = organization.logo_organization ? normalizeImageUrl(organization.logo_organization) : null;

    return (
        <div className="max-w-7xl mx-auto p-6">
            <div className="mb-6">
                <button
                    type="button"
                    onClick={() => navigate('/moderation/products')}
                    className="text-sm text-indigo-600 hover:text-indigo-800 mb-2"
                >
                    ← К организациям
                </button>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex gap-4 min-w-0">
                        <div className="w-16 h-16 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {logoUrl ? (
                                <img
                                    src={logoUrl}
                                    alt={organization.name || organization.id}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <span className="text-xs text-gray-400">Нет фото</span>
                            )}
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-2xl font-bold text-gray-900 truncate">
                                {organization.name || 'Без названия'}
                            </h1>
                            <p className="text-sm text-gray-500 mt-1">
                                ID: {organization.id} · Телефон: {organization.phone || '—'}
                            </p>
                        </div>
                    </div>
                    {sellerId && (
                        <button
                            type="button"
                            onClick={() => navigate(`/sellers/${sellerId}/workspace`, {
                                state: { from: `/moderation/products/${organizationId}` },
                            })}
                            className="shrink-0 px-4 py-2 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50"
                        >
                            Рабочий стол продавца
                        </button>
                    )}
                </div>
            </div>

            {loading && !selectedGroup ? (
                <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                    <p className="mt-4 text-gray-600">Загрузка...</p>
                </div>
            ) : selectedGroup && (
                <>
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
                </>
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
}

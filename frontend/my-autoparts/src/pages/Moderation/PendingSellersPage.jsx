import React, { useCallback, useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchPendingSellers, approveSeller, rejectSeller } from '../../redux/slices/ModerationSlice';
import { ConfirmDialog } from '../../components/UI/Modal';
import Modal from '../../components/UI/Modal';
import Button from '../../components/UI/Button';
import { useAuthReady } from '../../hooks/useAuthReady';
import { MOBILE_PULL_REFRESH_EVENT } from '../../utils/mobileRouteRefresh';

export default function PendingSellersPage() {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { isReady, user } = useAuthReady();
    const { pendingSellers, loading, error } = useSelector((state) => state.moderation);

    const [showApproveModal, setShowApproveModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [selectedSellerId, setSelectedSellerId] = useState(null);
    const [rejectReason, setRejectReason] = useState('');

    const reloadSellers = useCallback(() => {
        if (user?.is_admin) {
            dispatch(fetchPendingSellers());
        }
    }, [dispatch, user?.is_admin]);

    useEffect(() => {
        if (!isReady) return;
        if (!user?.is_admin) {
            navigate('/', { replace: true });
        }
    }, [isReady, user, navigate]);

    useEffect(() => {
        reloadSellers();
    }, [reloadSellers]);

    useEffect(() => {
        const onPullRefresh = (event) => {
            if (event.detail?.pathname === '/moderation/pending-sellers') {
                reloadSellers();
            }
        };
        window.addEventListener(MOBILE_PULL_REFRESH_EVENT, onPullRefresh);
        return () => window.removeEventListener(MOBILE_PULL_REFRESH_EVENT, onPullRefresh);
    }, [reloadSellers]);

    if (!isReady) {
        return null;
    }

    if (!user?.is_admin) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Доступ запрещен</h2>
                    <p className="text-gray-600">У вас нет прав для просмотра этой страницы</p>
                </div>
            </div>
        );
    }

    const handleApproveClick = (sellerId) => {
        setSelectedSellerId(sellerId);
        setShowApproveModal(true);
    };

    const handleRejectClick = (sellerId) => {
        setSelectedSellerId(sellerId);
        setRejectReason('');
        setShowRejectModal(true);
    };

    const handleApproveConfirm = () => {
        if (selectedSellerId) {
            dispatch(approveSeller(selectedSellerId));
            setShowApproveModal(false);
            setSelectedSellerId(null);
        }
    };

    const handleRejectConfirm = () => {
        if (selectedSellerId && rejectReason.trim()) {
            dispatch(rejectSeller({ sellerId: selectedSellerId, reason: rejectReason }));
            setShowRejectModal(false);
            setSelectedSellerId(null);
            setRejectReason('');
        }
    };

    const handleCloseModals = () => {
        setShowApproveModal(false);
        setShowRejectModal(false);
        setSelectedSellerId(null);
        setRejectReason('');
    };

    return (
        <div className="max-lg:pb-[var(--sg-mobile-bottom-nav-total,4.5rem)]">
            <div className="mt-4 sm:mt-5 px-4 sm:px-0">
                <div className="mb-6 sm:mb-8">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Регистрация продавцов</h1>
                    <p className="mt-2 text-gray-600">Модерация заявок на регистрацию продавцов</p>
                    {!loading && pendingSellers.length > 0 ? (
                        <p className="mt-1 text-sm font-medium text-indigo-700">
                            {pendingSellers.length} заявок в очереди
                        </p>
                    ) : null}
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200" role="alert">
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="flex justify-center items-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
                    </div>
                ) : pendingSellers.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8 text-center">
                        <h3 className="text-lg font-medium text-gray-900 mb-2">Нет заявок в ожидании</h3>
                        <p className="text-gray-500">Пока нет новых заявок от продавцов</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {pendingSellers.map((seller) => (
                            <div key={seller.id} className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
                                <div className="p-6">
                                    <div className="flex justify-between items-start mb-4 gap-2">
                                        <h3 className="text-lg font-semibold text-gray-900">
                                            {seller.last_name} {seller.first_name}
                                            {seller.patronymic && ` ${seller.patronymic}`}
                                        </h3>
                                        <span className="inline-flex shrink-0 items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                            В ожидании
                                        </span>
                                    </div>

                                    <div className="space-y-3">
                                        <div>
                                            <p className="text-sm font-medium text-gray-500">Организация</p>
                                            <p className="text-gray-900">{seller.name_organization}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-500">Описание</p>
                                            <p className="text-gray-900">{seller.description_organization || 'Не указано'}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-500">Адрес</p>
                                            <p className="text-gray-900">{seller.address_organization}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-500">Контакты</p>
                                            <p className="text-gray-900">{seller.email}</p>
                                            <p className="text-gray-900">{seller.phone}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-500">Дата подачи</p>
                                            <p className="text-gray-900">
                                                {new Date(seller.created_at).toLocaleDateString('ru-RU')}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200">
                                        <button
                                            type="button"
                                            onClick={() => handleApproveClick(seller.id)}
                                            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-green-600 text-white px-4 font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                                        >
                                            Принять
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleRejectClick(seller.id)}
                                            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-red-600 text-white px-4 font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                                        >
                                            Отклонить
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <ConfirmDialog
                open={showApproveModal}
                onClose={handleCloseModals}
                onConfirm={handleApproveConfirm}
                title="Одобрение продавца"
                message="Вы уверены, что хотите одобрить этого продавца? Будет сгенерирован пароль и отправлен на email продавца."
                confirmLabel="Одобрить"
            />

            <Modal
                open={showRejectModal}
                onClose={handleCloseModals}
                title="Отклонение заявки"
                size="sm"
                footer={(
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={handleCloseModals}>
                            Отмена
                        </Button>
                        <Button
                            type="button"
                            variant="danger"
                            className="w-full sm:w-auto"
                            disabled={!rejectReason.trim()}
                            onClick={handleRejectConfirm}
                        >
                            Отклонить
                        </Button>
                    </div>
                )}
            >
                <p className="mb-4 text-sm text-gray-600">
                    Это действие нельзя отменить. Пожалуйста, укажите причину отказа:
                </p>
                <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Укажите причину отказа..."
                    rows={4}
                    className="w-full min-h-[6rem] rounded-xl border border-gray-300 px-3 py-2 text-sm max-md:text-base focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
            </Modal>
        </div>
    );
}

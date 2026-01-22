import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchPendingSellers, approveSeller, rejectSeller } from '../../redux/slices/ModerationSlice';
import ConfirmationModal from '../../components/ConfirmationModal/ConfirmationModal';

export default function PendingSellersPage() {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { user } = useSelector((state) => state.auth);
    const { pendingSellers, loading, error } = useSelector((state) => state.moderation);
    
    const [showApproveModal, setShowApproveModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [selectedSellerId, setSelectedSellerId] = useState(null);
    const [rejectReason, setRejectReason] = useState('');

    // Check admin rights
    useEffect(() => {
        if (!user?.is_admin) {
            navigate('/', { replace: true });
        }
    }, [user, navigate]);

    // Fetch pending sellers
    useEffect(() => {
        if (user?.is_admin) {
            dispatch(fetchPendingSellers());
        }
    }, [dispatch, user]);

    // If not admin, show access denied
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
        if (selectedSellerId) {
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
        <div>
            <div className="mt-4 sm:mt-5 px-4 sm:px-0">
                <div className="mb-6 sm:mb-8">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Регистрация продавцов</h1>
                    <p className="mt-2 text-gray-600 text-base sm:text-base">Модерация заявок на регистрацию продавцов</p>
                </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
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
                                <div className="flex justify-between items-start mb-4">
                                    <h3 className="text-lg font-semibold text-gray-900">
                                        {seller.last_name} {seller.first_name}
                                        {seller.patronymic && ` ${seller.patronymic}`}
                                    </h3>
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
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

                                <div className="flex space-x-3 mt-6 pt-4 border-t border-gray-200">
                                    <button
                                        onClick={() => handleApproveClick(seller.id)}
                                        className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
                                    >
                                        Принять
                                    </button>
                                    <button
                                        onClick={() => handleRejectClick(seller.id)}
                                        className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
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
        
        {/* Approve Confirmation Modal */}
        <ConfirmationModal
            isOpen={showApproveModal}
            onClose={handleCloseModals}
            onConfirm={handleApproveConfirm}
            title="Одобрение продавца"
            message="Вы уверены, что хотите одобрить этого продавца? Будет сгенерирован пароль и отправлен на email продавца."
            confirmText="Одобрить"
            cancelText="Отмена"
            danger={false}
        />
        
        {/* Reject Confirmation Modal with Reason */}
        {showRejectModal && (
            <div 
                className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
                onClick={handleCloseModals}
            >
                <div 
                    className="bg-white rounded-xl shadow-xl w-full max-w-md"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-900">Отклонение заявки</h3>
                            <button
                                onClick={handleCloseModals}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        
                        <div className="mb-4">
                            <p className="text-gray-600 mb-4">Это действие нельзя отменить. Пожалуйста, укажите причину отказа:</p>
                            <textarea
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="Укажите причину отказа..."
                                rows="4"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                            />
                        </div>
                        
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={handleCloseModals}
                                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                            >
                                Отмена
                            </button>
                            <button
                                onClick={handleRejectConfirm}
                                disabled={!rejectReason.trim()}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Отклонить
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
    );
}
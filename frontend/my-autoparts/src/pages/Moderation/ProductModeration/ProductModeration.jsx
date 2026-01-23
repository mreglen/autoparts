import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
    fetchPendingProducts,
    fetchRejectedProducts,
    approveProduct,
    rejectProduct,
    clearModerationError,
    resetModeration
} from '../../../redux/slices/ModerationProductsSlice.js';
import ProductModerationCard from '../../../components/ProductModerationCard/ProductModerationCard.jsx';
import RejectProductModal from '../../../components/RejectProductModal/RejectProductModal.jsx';

const ProductModeration = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const user = useSelector((state) => state.auth.user);
    
    const { pendingProducts, rejectedProducts, loading, error } = useSelector((state) => state.moderationProducts);
    
    const [showRejected, setShowRejected] = useState(false);
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);

    // Проверка прав администратора
    useEffect(() => {
        if (!user || !user.is_admin) {
            navigate('/');
        }
    }, [user, navigate]);

    // Загрузка данных
    useEffect(() => {
        if (user?.is_admin) {
            if (!showRejected) {
                dispatch(fetchPendingProducts());
            } else {
                dispatch(fetchRejectedProducts());
            }
        }
        
        return () => {
            dispatch(resetModeration());
        };
    }, [dispatch, user?.is_admin, showRejected]);

    // Обработка ошибок
    useEffect(() => {
        if (error) {
            alert(`Ошибка: ${error}`);
            dispatch(clearModerationError());
        }
    }, [error, dispatch]);

    const handleApprove = async (productId) => {
        if (window.confirm('Вы уверены, что хотите одобрить эту запчасть?')) {
            try {
                await dispatch(approveProduct(productId)).unwrap();
                alert('Запчасть успешно одобрена и добавлена в каталог');
            } catch (err) {
                // Ошибка будет обработана в useEffect
            }
        }
    };

    const handleRejectClick = (product) => {
        setSelectedProduct(product);
        setIsRejectModalOpen(true);
    };

    const handleRejectSubmit = async (reason) => {
        try {
            await dispatch(rejectProduct({
                productId: selectedProduct.id,
                reason
            })).unwrap();
            alert('Запчасть отклонена');
            setIsRejectModalOpen(false);
            setSelectedProduct(null);
        } catch (err) {
            // Ошибка будет обработана в useEffect
        }
    };

    const handleTabChange = (showRejectedTab) => {
        setShowRejected(showRejectedTab);
        if (showRejectedTab) {
            // TODO: Загрузить отклоненные запчасти
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
        <div className="max-w-6xl mx-auto p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Модерация запчастей</h1>
                <p className="text-gray-600 mt-2">
                    Проверка и управление запчастями, добавленными пользователями
                </p>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-8">
                    <button
                        onClick={() => handleTabChange(false)}
                        className={`py-4 px-1 border-b-2 font-medium text-sm ${
                            !showRejected
                                ? 'border-indigo-500 text-indigo-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                    >
                        Ожидают модерации
                        {pendingProducts.length > 0 && (
                            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                {pendingProducts.length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => handleTabChange(true)}
                        className={`py-4 px-1 border-b-2 font-medium text-sm ${
                            showRejected
                                ? 'border-indigo-500 text-indigo-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                    >
                        Отклоненные
                        {rejectedProducts.length > 0 && (
                            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                {rejectedProducts.length}
                            </span>
                        )}
                    </button>
                </nav>
            </div>

            {loading ? (
                <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    <p className="mt-4 text-gray-600">Загрузка...</p>
                </div>
            ) : showRejected ? (
                <>
                    {rejectedProducts.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="mx-auto h-12 w-12 text-gray-400">
                                <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                </svg>
                            </div>
                            <h3 className="mt-2 text-sm font-medium text-gray-900">Нет отклоненных запчастей</h3>
                            <p className="mt-1 text-sm text-gray-500">
                                Все запчасти одобрены или ожидают модерации
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {rejectedProducts.map((product) => (
                                <ProductModerationCard
                                    key={product.id}
                                    product={product}
                                    /* У отклоненных запчастей не нужны кнопки одобрения/отклонения */
                                />
                            ))}
                        </div>
                    )}
                </>
            ) : (
                <>
                    {pendingProducts.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="mx-auto h-12 w-12 text-gray-400">
                                <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                </svg>
                            </div>
                            <h3 className="mt-2 text-sm font-medium text-gray-900">Нет запчастей на модерации</h3>
                            <p className="mt-1 text-sm text-gray-500">
                                Все запчасти проверены или еще не добавлены
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {pendingProducts.map((product) => (
                                <ProductModerationCard
                                    key={product.id}
                                    product={product}
                                    onApprove={handleApprove}
                                    onReject={handleRejectClick}
                                />
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Reject Modal */}
            <RejectProductModal
                isOpen={isRejectModalOpen}
                onClose={() => {
                    setIsRejectModalOpen(false);
                    setSelectedProduct(null);
                }}
                onReject={handleRejectSubmit}
                productName={selectedProduct?.name}
            />
        </div>
    );
};

export default ProductModeration;
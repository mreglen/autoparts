import React, { useState } from 'react';
import { normalizeImageUrl } from '../../utils/apiClient';
import ImageModal from '../ImageModal/ImageModal';

const ProductModerationCard = ({ product, onApprove, onReject }) => {
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);

    const formatDate = (dateString) => {
        if (!dateString) return '—';
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatPrice = (price) => {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB',
            minimumFractionDigits: 0
        }).format(price);
    };

    const handleImageClick = (index) => {
        setSelectedImageIndex(index);
        setIsImageModalOpen(true);
    };

    const handleCloseImageModal = () => {
        setIsImageModalOpen(false);
        setSelectedImageIndex(0);
    };

    return (
        <>
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                <div className="p-5">
                    {/* Header */}
                    <div className="mb-4">
                        <div className="mb-2">
                            <span className="text-sm font-medium text-gray-900">
                                {product.brand} · {product.article}
                            </span>
                            {product.is_new ? (
                                <span className="ml-2 text-xs text-green-600">Новый</span>
                            ) : (
                                <span className="ml-2 text-xs text-yellow-600">Б/у</span>
                            )}
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">
                            {product.name}
                        </h3>
                    </div>

                    {/* Description */}
                    {product.description && (
                        <div className="mb-4">
                            <p className="text-sm text-gray-600 line-clamp-2">
                                {product.description}
                            </p>
                        </div>
                    )}

                    {/* Photos */}
                    {product.photos && product.photos.length > 0 && (
                        <div className="mb-4">
                            <div className="flex flex-wrap gap-2">
                                {product.photos.slice(0, 3).map((photo, index) => (
                                    <img
                                        key={index}
                                        src={normalizeImageUrl(photo)}
                                        alt={`Фото ${index + 1}`}
                                        className="w-16 h-16 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleImageClick(index);
                                        }}
                                    />
                                ))}
                                {product.photos.length > 3 && (
                                    <div className="w-16 h-16 bg-gray-100 rounded border flex items-center justify-center">
                                        <span className="text-xs text-gray-500">
                                            +{product.photos.length - 3}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Details Grid */}
                    <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                        <div>
                            <span className="text-gray-500">Цена:</span>
                            <div className="font-medium text-gray-900">
                                {formatPrice(product.price)}
                            </div>
                        </div>
                        <div>
                            <span className="text-gray-500">Количество:</span>
                            <div className="font-medium text-gray-900">
                                {product.quantity} шт.
                            </div>
                        </div>
                        <div>
                            <span className="text-gray-500">Склад:</span>
                            <div className="font-medium text-gray-900">
                                {product.storage_location?.address || `#${product.storage_location_id}`}
                            </div>
                        </div>
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                        <div>
                            <span className="text-gray-500">Дата создания:</span>
                            <div className="font-medium text-gray-900">
                                {formatDate(product.created_at)}
                            </div>
                        </div>
                        {product.rejected_at && (
                            <div>
                                <span className="text-gray-500">Дата отклонения:</span>
                                <div className="font-medium text-gray-900">
                                    {formatDate(product.rejected_at)}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Rejection Reason (for rejected products) */}
                    {product.rejection_reason && (
                        <div className="mb-4 p-3 bg-red-50 rounded-lg">
                            <span className="text-sm font-medium text-red-800">Причина отклонения:</span>
                            <p className="text-sm text-red-700 mt-1">{product.rejection_reason}</p>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4 border-t border-gray-100">
                        {onApprove && (
                            <button
                                onClick={() => onApprove(product.id)}
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-md text-sm font-medium transition-colors"
                            >
                                Принять
                            </button>
                        )}
                        {onReject && (
                            <button
                                onClick={() => onReject(product)}
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-md text-sm font-medium transition-colors"
                            >
                                Отклонить
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Image Modal */}
            <ImageModal
                isOpen={isImageModalOpen}
                onClose={handleCloseImageModal}
                photos={product.photos}
                initialIndex={selectedImageIndex}
                alt="Фото запчасти"
            />
        </>
    );
};

export default ProductModerationCard;
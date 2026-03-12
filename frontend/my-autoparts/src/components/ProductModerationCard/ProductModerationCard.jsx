import React, { useState } from 'react';
import { normalizeImageUrl } from '../../utils/apiClient';

const ProductModerationCard = ({ product, onApprove, onReject }) => {
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

                    {/* Photos and Videos */}
                    {(product.photos && product.photos.length > 0) || (product.videos && product.videos.length > 0) ? (
                        <div className="mb-4">
                            <span className="text-xs font-medium text-gray-500 mb-2 block">Медиафайлы:</span>
                            <div className="flex flex-wrap gap-2">
                                {/* Display photos */}
                                {product.photos && product.photos.slice(0, 2).map((photo, index) => (
                                    <img
                                        key={`photo-${index}`}
                                        src={normalizeImageUrl(photo)}
                                        alt={`Фото ${index + 1}`}
                                        className="w-16 h-16 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                                    />
                                ))}
                                
                                {/* Display first video if exists */}
                                {product.videos && product.videos.length > 0 && (
                                    <div
                                        className="w-16 h-16 bg-gray-900 rounded border flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity relative"
                                    >
                                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                        </svg>
                                        <span className="absolute -bottom-4 text-xs text-gray-500">Видео</span>
                                    </div>
                                )}
                                
                                {/* Show more indicator */}
                                {((product.photos && product.photos.length > 2) || (product.videos && product.videos.length > 1)) && (
                                    <div className="w-16 h-16 bg-gray-100 rounded border flex items-center justify-center">
                                        <span className="text-xs text-gray-500">
                                            +{(product.photos ? Math.max(0, product.photos.length - 2) : 0) + (product.videos ? product.videos.length - (product.photos && product.photos.length > 0 ? 1 : 0) : 0)}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : null}

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
                        <div className="col-span-2">
                            <span className="text-gray-500">Адрес склада:</span>
                            <div className="font-medium text-gray-900">
                                {product.storage_location_address || `Склад #${product.storage_location_id}`}
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
        </>
    );
};

export default ProductModerationCard;
import React, { useEffect, useState } from 'react';
import { normalizeImageUrl } from '../../../utils/apiClient.js';
import {
    formatMediaForModal,
    getFirstMediaUrl,
    normalizeProductMedia,
    parseMediaList,
} from '../../../utils/mediaHelpers.js';

export const UNKNOWN_ORG_ID = 'unknown';

export const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

export const formatPrice = (price) => (
    new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
        minimumFractionDigits: 0,
    }).format(Number(price) || 0)
);

export const getOrganization = (product) => (
    product.organization || {
        id: product.organization_id || UNKNOWN_ORG_ID,
        name: product.organization_id ? `Организация ${product.organization_id}` : 'Без организации',
        phone: null,
        logo_organization: null,
    }
);

export const getFirstPhoto = (product) => {
    const photos = parseMediaList(product?.photos);
    if (!photos.length) return null;
    const photo = photos[0];
    return typeof photo === 'string' ? photo : (photo.full_url || photo.photo_url || photo.url || null);
};

export const buildOrganizations = (pendingProducts, rejectedProducts) => {
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

export const EmptyState = ({ title, text }) => (
    <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
        <h3 className="text-sm font-medium text-gray-900">{title}</h3>
        {text && <p className="mt-1 text-sm text-gray-500">{text}</p>}
    </div>
);

export const OrganizationCard = ({ group, onClick }) => {
    const { organization, pending, rejected } = group;
    const hasPending = pending.length > 0;
    const logoUrl = organization.logo_organization ? normalizeImageUrl(organization.logo_organization) : null;

    return (
        <button
            type="button"
            onClick={onClick}
            className="w-full text-left bg-white border border-gray-200 rounded-xl p-4 transition-shadow hover:shadow-md hover:border-indigo-200"
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

const ModerationProductRow = ({ product, onView, onApprove, onReject, onImageClick, layout = 'desktop' }) => {
    const [showActions, setShowActions] = useState(false);
    const [imageError, setImageError] = useState(false);
    const isRejected = product.moderationKind === 'rejected';

    const normalizedProduct = normalizeProductMedia(product);
    const photoUrl = getFirstMediaUrl(normalizedProduct);

    const handlePhotoClick = (e) => {
        e.stopPropagation();
        const mediaItems = formatMediaForModal(normalizedProduct.photos, normalizedProduct.videos);
        if (mediaItems.length > 0) {
            onImageClick?.(mediaItems, 0);
        } else {
            onView(product);
        }
    };

    const priceLabel = product.price != null && !Number.isNaN(Number(product.price))
        ? `${Number(product.price).toLocaleString('ru-RU')} ₽`
        : '—';

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!event.target.closest('.moderation-actions-dropdown')) {
                setShowActions(false);
            }
        };
        if (showActions) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showActions]);

    const handleRowDoubleClick = (e) => {
        if (e.target.closest('.moderation-actions-dropdown')) return;
        onView(product);
    };

    const renderActionsMenu = (menuClassName) => (
        <div className={menuClassName}>
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onView(product); setShowActions(false); }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Просмотреть
            </button>
            {!isRejected && (
                <>
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onApprove(product.id); setShowActions(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-green-700 hover:bg-green-50 flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Принять
                    </button>
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onReject(product); setShowActions(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Отклонить
                    </button>
                </>
            )}
        </div>
    );

    return layout === 'desktop' ? (
            <tr
                className="group hover:bg-gray-50/50 transition-all duration-200 border-b border-gray-100 cursor-pointer"
                onDoubleClick={handleRowDoubleClick}
            >
                <td className="px-4 py-4" colSpan={4}>
                    <div className="flex items-start gap-4 min-w-0">
                        <div
                            className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 cursor-pointer"
                            onClick={handlePhotoClick}
                        >
                            {photoUrl && !imageError ? (
                                <img
                                    src={photoUrl}
                                    alt={product.name}
                                    className="w-full h-full object-cover"
                                    onError={() => setImageError(true)}
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="text-base font-semibold text-gray-900">{product.brand || '—'}</span>
                                <span className="text-sm text-gray-400">•</span>
                                <span className="text-sm text-gray-500 font-mono">{product.article || '—'}</span>
                            </div>
                            {product.internal_code && (
                                <div className="text-xs text-gray-500 mb-1">
                                    Внутренний код: <span className="font-mono">{product.internal_code}</span>
                                </div>
                            )}
                            <h3 className="text-sm font-medium text-gray-800 mb-2 line-clamp-2">{product.name || '—'}</h3>
                            <div className="flex items-center gap-2 flex-wrap">
                                {isRejected ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                        Отклонена
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                        На модерации
                                    </span>
                                )}
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                    product.is_new ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                                }`}>
                                    {product.is_new ? 'Новая' : 'Б/у'}
                                </span>
                            </div>
                            {isRejected && product.rejection_reason && (
                                <p className="mt-2 text-xs text-red-700 line-clamp-2">{product.rejection_reason}</p>
                            )}
                        </div>
                    </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-center">
                        <div className="text-sm font-medium text-gray-900">{product.quantity ?? 0}</div>
                        <div className="text-xs text-gray-500">шт.</div>
                    </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-base font-bold text-gray-900">{priceLabel}</div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                    <div className="relative moderation-actions-dropdown">
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setShowActions(!showActions); }}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                            </svg>
                            <span className="hidden sm:inline">Действия</span>
                        </button>
                        {showActions && renderActionsMenu('absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-20 moderation-actions-dropdown')}
                    </div>
                </td>
            </tr>
    ) : (
            <div
                className="bg-white rounded-lg shadow-sm border border-gray-200 mb-3"
                onDoubleClick={handleRowDoubleClick}
            >
                <div className="flex items-center justify-end p-3 border-b border-gray-100">
                    <div className="relative moderation-actions-dropdown">
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setShowActions(!showActions); }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                            </svg>
                            <span>Действия</span>
                        </button>
                        {showActions && renderActionsMenu('absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50 moderation-actions-dropdown')}
                    </div>
                </div>
                <div className="p-4 cursor-pointer">
                    <div className="flex gap-3">
                        <div
                            className="w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 cursor-pointer"
                            onClick={handlePhotoClick}
                        >
                            {photoUrl && !imageError ? (
                                <img
                                    src={photoUrl}
                                    alt={product.name}
                                    className="w-full h-full object-cover"
                                    onError={() => setImageError(true)}
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="text-base font-semibold text-gray-900">{product.brand || '—'}</span>
                                <span className="text-sm text-gray-400">•</span>
                                <span className="text-sm text-gray-500 font-mono">{product.article || '—'}</span>
                            </div>
                            <h3 className="text-sm font-medium text-gray-800 line-clamp-2">{product.name || '—'}</h3>
                            <div className="flex items-center justify-between mt-3">
                                <div className="text-base font-bold text-gray-900">{priceLabel}</div>
                                <div className="text-center">
                                    <div className="text-sm font-medium text-gray-900">{product.quantity ?? 0}</div>
                                    <div className="text-xs text-gray-500">шт.</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                                {isRejected ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                        Отклонена
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                        На модерации
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
    );
};

export const ProductTable = ({ products, onApprove, onReject, onView, onImageClick }) => {
    if (!products.length) {
        return (
            <EmptyState
                title="Нет запчастей на модерации"
                text="У выбранной организации нет запчастей на модерации или отклонённых заявок."
            />
        );
    }

    return (
        <>
            <div className="hidden md:block w-full bg-white border border-gray-200 rounded-lg">
                <table className="w-full table-fixed divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider" colSpan={4}>Запчасть</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-24">Остаток</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-32">Цена</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-36">Действия</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {products.map((product) => (
                            <ModerationProductRow
                                key={`${product.moderationKind}-${product.id}`}
                                product={product}
                                onView={onView}
                                onApprove={onApprove}
                                onReject={onReject}
                                onImageClick={onImageClick}
                                layout="desktop"
                            />
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="md:hidden">
                {products.map((product) => (
                    <ModerationProductRow
                        key={`mobile-${product.moderationKind}-${product.id}`}
                        product={product}
                        onView={onView}
                        onApprove={onApprove}
                        onReject={onReject}
                        onImageClick={onImageClick}
                        layout="mobile"
                    />
                ))}
            </div>
        </>
    );
};

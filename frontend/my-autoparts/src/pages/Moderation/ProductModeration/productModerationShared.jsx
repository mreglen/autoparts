import React, { useEffect, useState } from 'react';
import { normalizeImageUrl } from '../../../utils/apiClient.js';

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
    const photo = product.photos?.[0];
    if (!photo) return null;
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

export const ProductTable = ({ products, status, onApprove, onReject }) => {
    const [openActionsId, setOpenActionsId] = useState(null);

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

    if (!products.length) {
        return (
            <EmptyState
                title={status === 'pending' ? 'Нет запчастей на модерации' : 'Нет отклонённых запчастей'}
                text={status === 'pending' ? 'У выбранной организации нет ожидающих заявок.' : 'У выбранной организации нет отклонённых заявок.'}
            />
        );
    }

    const renderProductFields = (product) => {
        const photo = getFirstPhoto(product);
        const photoUrl = photo ? normalizeImageUrl(photo) : null;
        return { photoUrl, product };
    };

    return (
        <>
            <div className="md:hidden space-y-3">
                {products.map((product) => {
                    const { photoUrl } = renderProductFields(product);
                    return (
                        <div
                            key={product.id}
                            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                        >
                            <div className="flex gap-3">
                                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
                                    {photoUrl ? (
                                        <img src={photoUrl} alt={product.name} className="h-full w-full object-cover" />
                                    ) : (
                                        <span className="text-xs text-gray-400">Нет</span>
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-gray-900">{product.name || '—'}</p>
                                    <p className="mt-1 text-sm text-gray-500">
                                        {product.brand || '—'} · {product.article || '—'}
                                    </p>
                                    <p className="mt-1 text-xs text-gray-500">ID {product.id} · {product.is_new ? 'Новая' : 'Б/у'}</p>
                                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-gray-700">
                                        <span>{formatPrice(product.price)}</span>
                                        <span>{product.quantity ?? '—'} шт.</span>
                                    </div>
                                    <p className="mt-1 text-sm text-gray-600">
                                        {product.storage_location_address || `Склад #${product.storage_location_id || '—'}`}
                                    </p>
                                    <p className="mt-1 text-xs text-gray-500">
                                        {status === 'rejected'
                                            ? formatDate(product.rejected_at || product.created_at)
                                            : formatDate(product.created_at)}
                                    </p>
                                    {status === 'rejected' && product.rejection_reason && (
                                        <p className="mt-2 text-sm text-red-700">{product.rejection_reason}</p>
                                    )}
                                </div>
                            </div>
                            {status === 'pending' && (
                                <div className="mt-4 flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => onApprove(product.id)}
                                        className="min-h-[44px] flex-1 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white active:bg-green-700"
                                    >
                                        Принять
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onReject(product)}
                                        className="min-h-[44px] flex-1 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 active:bg-red-50"
                                    >
                                        Отклонить
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="hidden md:block bg-white border border-gray-200 rounded-lg overflow-x-auto">
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
                    {products.map((product, index) => {
                        const photo = getFirstPhoto(product);
                        const photoUrl = photo ? normalizeImageUrl(photo) : null;
                        const isMenuOpen = openActionsId === product.id;
                        const isLastRow = index === products.length - 1;

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
                                    <td className={`px-4 py-3 whitespace-nowrap text-right ${isMenuOpen ? 'relative z-30' : ''}`}>
                                        <div className="relative inline-block actions-dropdown">
                                            <button
                                                type="button"
                                                onClick={() => setOpenActionsId(isMenuOpen ? null : product.id)}
                                                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                                </svg>
                                                Действия
                                            </button>
                                            {isMenuOpen && (
                                                <div
                                                    className={`absolute right-0 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50 actions-dropdown ${
                                                        isLastRow ? 'bottom-full mb-2' : 'top-full mt-2'
                                                    }`}
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setOpenActionsId(null);
                                                            onApprove(product.id);
                                                        }}
                                                        className="w-full text-left px-4 py-2.5 text-sm text-green-700 hover:bg-green-50"
                                                    >
                                                        Принять
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setOpenActionsId(null);
                                                            onReject(product);
                                                        }}
                                                        className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                                                    >
                                                        Отклонить
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                )}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
        </>
    );
};

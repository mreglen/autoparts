import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import {
    fetchPendingProducts,
    approveProduct,
    rejectProduct,
    clearModerationError,
} from '../../../redux/slices/ModerationProductsSlice.js';
import { fetchSellers } from '../../../redux/slices/SellerSlice';
import RejectProductModal from '../../../components/RejectProductModal/RejectProductModal.jsx';
import MediaModal from '../../../components/MediaModal/MediaModal.jsx';
import { ConfirmDialog } from '../../../components/UI/Modal.jsx';
import { ModerationProductViewModal } from '../../Profile/SellerWorkspaceDetailModals.jsx';
import { normalizeProductMedia, formatMediaForModal, getMediaItemUrl } from '../../../utils/mediaHelpers.js';
import { normalizeImageUrl } from '../../../utils/apiClient.js';
import { buildOrganizations, ProductTable } from './productModerationShared.jsx';
import { useAuthReady } from '../../../hooks/useAuthReady';
import AuthLoadingScreen from '../../../components/AuthLoadingScreen/AuthLoadingScreen';
import { MOBILE_PULL_REFRESH_EVENT } from '../../../utils/mobileRouteRefresh';

function resolveSellerIdForOrganization(sellers, organizationId) {
    if (!organizationId || organizationId === 'unknown') return null;
    const orgSellers = sellers.filter(
        (s) => String(s.organization_id) === String(organizationId) && !s.is_employee,
    );
    if (!orgSellers.length) return null;
    const director = orgSellers.find((s) => s.is_director);
    return (director || orgSellers[0]).id;
}

const filterAndSortProducts = (products, { search, sort }) => {
    let items = [...products];

    if (search.trim()) {
        const query = search.toLowerCase().replace(/\s+/g, '');
        const queryText = search.toLowerCase();
        items = items.filter((product) =>
            (product.article && product.article.toLowerCase().replace(/\s+/g, '').includes(query))
            || (product.internal_code && String(product.internal_code).toLowerCase().replace(/\s+/g, '').includes(query))
            || (product.name && product.name.toLowerCase().includes(queryText))
        );
    }

    if (sort === 'date_desc') {
        items.sort((a, b) => {
            const aDate = a.moderationKind === 'rejected' ? (a.rejected_at || a.created_at) : a.created_at;
            const bDate = b.moderationKind === 'rejected' ? (b.rejected_at || b.created_at) : b.created_at;
            return new Date(bDate || 0) - new Date(aDate || 0);
        });
    } else if (sort === 'date_asc') {
        items.sort((a, b) => {
            const aDate = a.moderationKind === 'rejected' ? (a.rejected_at || a.created_at) : a.created_at;
            const bDate = b.moderationKind === 'rejected' ? (b.rejected_at || b.created_at) : b.created_at;
            return new Date(aDate || 0) - new Date(bDate || 0);
        });
    } else if (sort === 'name_asc' || sort === 'name_desc') {
        items.sort((a, b) => {
            const aName = (a.name || a.brand || a.article || '').toString().toLowerCase();
            const bName = (b.name || b.brand || b.article || '').toString().toLowerCase();
            if (aName < bName) return sort === 'name_asc' ? -1 : 1;
            if (aName > bName) return sort === 'name_asc' ? 1 : -1;
            return 0;
        });
    }

    return items;
};

export default function OrganizationProductModerationPage() {
    const { organizationId } = useParams();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { isReady, user } = useAuthReady();
    const { pendingProducts, loading, error } = useSelector((state) => state.moderationProducts);
    const sellers = useSelector((state) => state.sellers.sellers);

    const [searchQuery, setSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState('date_desc');
    const [viewProduct, setViewProduct] = useState(null);
    const [mediaModalOpen, setMediaModalOpen] = useState(false);
    const [currentMediaItems, setCurrentMediaItems] = useState([]);
    const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [rejectTarget, setRejectTarget] = useState(null);
    const [approveTargetId, setApproveTargetId] = useState(null);
    const [approveLoading, setApproveLoading] = useState(false);
    const [notice, setNotice] = useState('');
    const [noticeIsError, setNoticeIsError] = useState(false);

    const reloadProducts = useCallback(() => {
        if (!user?.is_admin) return;
        dispatch(fetchPendingProducts());
    }, [dispatch, user?.is_admin]);

    useEffect(() => {
        reloadProducts();
        if (!sellers.length) dispatch(fetchSellers());
    }, [reloadProducts, dispatch, sellers.length]);

    useEffect(() => {
        const onPullRefresh = (event) => {
            const path = event.detail?.pathname || '';
            if (path === '/moderation/products' || path.startsWith('/moderation/products/')) {
                reloadProducts();
            }
        };
        window.addEventListener(MOBILE_PULL_REFRESH_EVENT, onPullRefresh);
        return () => window.removeEventListener(MOBILE_PULL_REFRESH_EVENT, onPullRefresh);
    }, [reloadProducts]);

    const organizationGroups = useMemo(
        () => buildOrganizations(pendingProducts, []),
        [pendingProducts],
    );

    const selectedGroup = useMemo(
        () => organizationGroups.find((group) => String(group.organization.id) === String(organizationId)) || null,
        [organizationGroups, organizationId],
    );

    const unifiedProducts = useMemo(() => {
        if (!selectedGroup) return [];
        return selectedGroup.pending.map((product) => ({ ...product, moderationKind: 'pending' }));
    }, [selectedGroup]);

    const filteredProducts = useMemo(
        () => filterAndSortProducts(unifiedProducts, { search: searchQuery, sort: sortOrder }),
        [unifiedProducts, searchQuery, sortOrder],
    );

    const moderationCount = unifiedProducts.length;

    const sellerId = useMemo(
        () => resolveSellerIdForOrganization(sellers, organizationId),
        [sellers, organizationId],
    );

    useEffect(() => {
        if (error) {
            setNotice(error);
            setNoticeIsError(true);
            dispatch(clearModerationError());
        }
    }, [error, dispatch]);

    const handleApprove = (productId) => {
        setApproveTargetId(productId);
    };

    const handleApproveConfirm = async () => {
        if (!approveTargetId) return;
        setApproveLoading(true);
        try {
            await dispatch(approveProduct(approveTargetId)).unwrap();
            if (viewProduct?.id === approveTargetId && viewProduct?.moderationKind === 'pending') {
                setViewProduct(null);
            }
            setNotice('Запчасть успешно одобрена и добавлена в каталог');
            setNoticeIsError(false);
        } catch {
            /* handled via redux */
        } finally {
            setApproveLoading(false);
            setApproveTargetId(null);
        }
    };

    const handleRejectClick = (product) => {
        setRejectTarget(product);
        setIsRejectModalOpen(true);
    };

    const handleViewProduct = (product) => {
        setViewProduct(normalizeProductMedia(product));
    };

    const handleOpenMediaModal = (mediaItems, initialIndex = 0) => {
        let formatted = mediaItems;
        if (!mediaItems?.[0]?.src) {
            formatted = (Array.isArray(mediaItems) ? mediaItems : [])
                .map(getMediaItemUrl)
                .filter(Boolean)
                .map((url) => {
                    const normalizedUrl = normalizeImageUrl(url);
                    const isVideo = normalizedUrl.toLowerCase().match(/\.(mp4|webm|ogg|mov)$/);
                    return { type: isVideo ? 'video' : 'image', src: normalizedUrl };
                });
        }
        if (!formatted.length) return;
        setCurrentMediaItems(formatted);
        setCurrentMediaIndex(initialIndex);
        setMediaModalOpen(true);
    };

    const handleRejectSubmit = async (reason) => {
        const target = rejectTarget;
        if (!target) return;
        try {
            await dispatch(rejectProduct({
                productId: target.id,
                reason,
            })).unwrap();
            setNotice('Запчасть отклонена');
            setNoticeIsError(false);
            setIsRejectModalOpen(false);
            setRejectTarget(null);
            if (viewProduct?.id === target.id && viewProduct?.moderationKind === 'pending') {
                setViewProduct(null);
            }
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
        <div className="max-w-7xl mx-auto p-6 max-lg:pb-[var(--sg-mobile-bottom-nav-total,4.5rem)]">
            <div className="mb-6">
                <button
                    type="button"
                    onClick={() => navigate('/moderation/products')}
                    className="inline-flex min-h-11 items-center text-sm text-indigo-600 hover:text-indigo-800 mb-2"
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
                            <p className="text-sm text-gray-500 mt-1">
                                На модерации: {moderationCount}
                            </p>
                        </div>
                    </div>
                    {sellerId && (
                        <button
                            type="button"
                            onClick={() => navigate(`/sellers/${sellerId}/workspace`, {
                                state: { from: `/moderation/products/${organizationId}` },
                            })}
                            className="inline-flex min-h-11 shrink-0 items-center justify-center px-4 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50"
                        >
                            Рабочий стол продавца
                        </button>
                    )}
                </div>
            </div>

            {notice ? (
                <div
                    className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
                        noticeIsError
                            ? 'border-red-100 bg-red-50 text-red-800'
                            : 'border-green-100 bg-green-50 text-green-800'
                    }`}
                    role="status"
                >
                    {notice}
                </div>
            ) : null}

            {loading && !selectedGroup ? (
                <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                    <p className="mt-4 text-gray-600">Загрузка...</p>
                </div>
            ) : selectedGroup && (
                <>
                    <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Поиск по артикулу, названию, internal_code"
                                className="w-full min-h-11 pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm max-md:text-base focus:ring-indigo-500 focus:border-indigo-500"
                            />
                            <svg
                                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <select
                            value={sortOrder}
                            onChange={(e) => setSortOrder(e.target.value)}
                            className="min-h-11 px-3 py-2 border border-gray-300 rounded-lg text-sm max-md:text-base focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="date_desc">Сначала новые</option>
                            <option value="date_asc">Сначала старые</option>
                            <option value="name_asc">По названию А–Я</option>
                            <option value="name_desc">По названию Я–А</option>
                        </select>
                    </div>

                    <ProductTable
                        products={filteredProducts}
                        onApprove={handleApprove}
                        onReject={handleRejectClick}
                        onView={handleViewProduct}
                        onImageClick={handleOpenMediaModal}
                    />
                </>
            )}

            <RejectProductModal
                isOpen={isRejectModalOpen}
                onClose={() => {
                    setIsRejectModalOpen(false);
                    setRejectTarget(null);
                }}
                onReject={handleRejectSubmit}
                productName={rejectTarget?.name}
            />

            <ConfirmDialog
                open={Boolean(approveTargetId)}
                onClose={() => setApproveTargetId(null)}
                onConfirm={handleApproveConfirm}
                title="Одобрить запчасть"
                message="Вы уверены, что хотите одобрить эту запчасть?"
                confirmLabel="Одобрить"
                loading={approveLoading}
            />

            <ModerationProductViewModal
                product={viewProduct}
                isOpen={Boolean(viewProduct)}
                onClose={() => setViewProduct(null)}
                onImageClick={handleOpenMediaModal}
                onApprove={viewProduct?.moderationKind === 'pending' ? handleApprove : undefined}
                onReject={viewProduct?.moderationKind === 'pending' ? handleRejectClick : undefined}
            />

            <MediaModal
                isOpen={mediaModalOpen}
                onClose={() => setMediaModalOpen(false)}
                mediaItems={currentMediaItems}
                initialIndex={currentMediaIndex}
            />
        </div>
    );
}

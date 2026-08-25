import React, { useCallback, useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchPendingProducts } from '../../../redux/slices/ModerationProductsSlice.js';
import { buildOrganizations, EmptyState, OrganizationCard } from './productModerationShared.jsx';
import { useAuthReady } from '../../../hooks/useAuthReady';
import AuthLoadingScreen from '../../../components/AuthLoadingScreen/AuthLoadingScreen';
import { MOBILE_PULL_REFRESH_EVENT } from '../../../utils/mobileRouteRefresh';

const ProductModeration = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { isReady, user } = useAuthReady();

    const { pendingProducts, loading } = useSelector((state) => state.moderationProducts);

    const reloadProducts = useCallback(() => {
        if (user?.is_admin) {
            dispatch(fetchPendingProducts());
        }
    }, [dispatch, user?.is_admin]);

    useEffect(() => {
        if (!user || !user.is_admin) {
            navigate('/');
        }
    }, [user, navigate]);

    useEffect(() => {
        reloadProducts();
    }, [reloadProducts]);

    useEffect(() => {
        const onPullRefresh = (event) => {
            if (event.detail?.pathname === '/moderation/products') {
                reloadProducts();
            }
        };
        window.addEventListener(MOBILE_PULL_REFRESH_EVENT, onPullRefresh);
        return () => window.removeEventListener(MOBILE_PULL_REFRESH_EVENT, onPullRefresh);
    }, [reloadProducts]);

    const organizationGroups = useMemo(
        () => buildOrganizations(pendingProducts, []).filter((group) => group.pending.length > 0),
        [pendingProducts],
    );

    if (!isReady) {
        return (
            <div className="max-w-7xl mx-auto p-6">
                <AuthLoadingScreen />
            </div>
        );
    }

    if (!user?.is_admin) {
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
                    Выберите организацию, чтобы проверить ожидающие запчасти.
                </p>
            </div>

            {loading ? (
                <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                    <p className="mt-4 text-gray-600">Загрузка...</p>
                </div>
            ) : organizationGroups.length === 0 ? (
                <EmptyState
                    title="Нет организаций с запчастями для модерации"
                    text="Ожидающие запчасти отсутствуют."
                />
            ) : (
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-3">Организации</h2>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {organizationGroups.map((group) => (
                            <OrganizationCard
                                key={group.organization.id}
                                group={group}
                                onClick={() => navigate(`/moderation/products/${encodeURIComponent(group.organization.id)}`)}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductModeration;

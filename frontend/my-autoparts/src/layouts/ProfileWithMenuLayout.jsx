// src/layouts/ProfileWithMenuLayout.jsx
import { useEffect, useMemo, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Outlet, useLocation } from 'react-router-dom';
import { fetchPendingProducts } from '../redux/slices/ModerationProductsSlice';
import { fetchPendingSellers } from '../redux/slices/ModerationSlice';
import { fetchSalesMenuCounts } from '../redux/slices/SalesMenuCountsSlice';
import {
  clearAutoserviceClient,
  fetchAutoserviceClientMe,
} from '../redux/slices/AutoserviceClientSlice';
import { selectShowAutoservice } from '../utils/autoservicePublic';
import { apiAxios } from '../utils/apiClient';
import Navigation from '../pages/Navigation/Navigation';
import MobileHeader from '../components/MobileHeader/MobileHeader';
import MobileBottomNav from '../components/MobileBottomNav/MobileBottomNav';
import MobileSideMenu from '../components/MobileSideMenu/MobileSideMenu';
import ProfileMenuTabs from '../pages/Profile/menu/ProfileMenuTabs';
import { useAuthReady } from '../hooks/useAuthReady';
import { useMobileMenuShell } from '../hooks/useMobileMenuShell';
import AuthLoadingScreen from '../components/AuthLoadingScreen/AuthLoadingScreen';
import useCartSync from '../hooks/useCartSync';
import InstallPwaPrompt from '../components/InstallPwaPrompt/InstallPwaPrompt';
import HeaderBadgeHeightSync from '../components/Seo/HeaderBadgeHeightSync';
import NotificationsBanner from '../components/NotificationsBanner/NotificationsBanner';
import { normalizeNewPartsCustomerStatus } from '../utils/garageOrderUi';
import { TERMINAL_RETURN_STATUSES } from '../utils/returnStatusUi';

const ACTIVE_PURCHASE_STATUSES = new Set([
  'pending',
  'confirmed',
  'assembled',
  'ready_for_pickup',
  'shipped',
  'new_waiting_confirmation',
  'new_assembling',
  'new_shipped',
  'new_awaiting_arrival',
  'new_ready_for_pickup',
]);

export default function ProfileWithMenuLayout() {
    const dispatch = useDispatch();
    const { isReady, user } = useAuthReady();
    useCartSync();
    const permissionCodes = useSelector((state) => state.auth.permissionCodes);
    const moderationProducts = useSelector((state) => state.moderationProducts);
    const moderation = useSelector((state) => state.moderation);
    const salesMenuCounts = useSelector((state) => state.salesMenuCounts);
    const showAutoservice = useSelector(selectShowAutoservice);
    const location = useLocation();
  const [purchasesMenuCounts, setPurchasesMenuCounts] = useState({ orders: 0, returns: 0 });

    const isChatsPage = location.pathname.startsWith('/chats');

    const canFetchSalesCounts = useMemo(() => {
        if (!user) return false;
        if (user.is_admin || user.is_seller) return true;
        if (!user.is_employee || !Array.isArray(permissionCodes)) return false;
        return permissionCodes.includes('sales.orders') || permissionCodes.includes('sales.returns');
    }, [user, permissionCodes]);

  useEffect(() => {
    if (!isReady || !user) return;
    let cancelled = false;

    const fetchPurchasesCounts = async () => {
      try {
        const results = await Promise.allSettled([
          apiAxios.get('/sales/purchases/used-orders'),
          apiAxios.get('/sales/purchases/new-orders'),
          apiAxios.get('/sales/purchases/returns'),
        ]);

        const [usedRes, newRes, returnsRes] = results;

        const usedOrders = usedRes.status === 'fulfilled' && Array.isArray(usedRes.value.data)
          ? usedRes.value.data
          : [];
        const newOrders = newRes.status === 'fulfilled' && Array.isArray(newRes.value.data)
          ? newRes.value.data
          : [];
        const returns = returnsRes.status === 'fulfilled' && Array.isArray(returnsRes.value.data)
          ? returnsRes.value.data
          : [];

        const usedActive = usedOrders.reduce((acc, o) => {
          const code = o?.status_code || 'pending';
          return acc + (ACTIVE_PURCHASE_STATUSES.has(code) ? 1 : 0);
        }, 0);

        const newActive = newOrders.reduce((acc, o) => {
          const code = normalizeNewPartsCustomerStatus(o?.status_code);
          return acc + (ACTIVE_PURCHASE_STATUSES.has(code) ? 1 : 0);
        }, 0);

        const activeReturns = returns.reduce((acc, r) => {
          const code = r?.status_code || '';
          return acc + (!TERMINAL_RETURN_STATUSES.has(code) ? 1 : 0);
        }, 0);

        if (cancelled) return;
        setPurchasesMenuCounts({ orders: usedActive + newActive, returns: activeReturns });
      } catch (_) {
        if (cancelled) return;
        setPurchasesMenuCounts({ orders: 0, returns: 0 });
      }
    };

    fetchPurchasesCounts();

    return () => {
      cancelled = true;
    };
  }, [isReady, user?.id]);

    const badgeCounts = {
        'product-moderation': moderationProducts?.pendingProducts?.length || 0,
        'pending-sellers': moderation?.pendingSellers?.length || 0,
        administration:
            (moderationProducts?.pendingProducts?.length || 0) +
            (moderation?.pendingSellers?.length || 0),
        purchases:
            (purchasesMenuCounts?.orders || 0) +
            (purchasesMenuCounts?.returns || 0),
    'purchases-orders': purchasesMenuCounts?.orders || 0,
    'purchases-returns': purchasesMenuCounts?.returns || 0,
        'sales-orders': salesMenuCounts?.orders || 0,
        'sales-returns': salesMenuCounts?.returns || 0,
        sales: salesMenuCounts?.sales || 0,
    };

    const {
        tabs,
        activeTab,
        isMobileMenuOpen,
        openMenu,
        closeMenu,
        handleTabChange,
        adminMenuMode,
        setAdminMenuMode,
        showAdminMenuSwitch,
    } = useMobileMenuShell(user);

    useEffect(() => {
        if (!isReady || !user?.is_admin) return;
        dispatch(fetchPendingProducts());
        dispatch(fetchPendingSellers());
    }, [dispatch, isReady, user?.is_admin]);

    useEffect(() => {
        if (!isReady || !canFetchSalesCounts) return;
        dispatch(fetchSalesMenuCounts());
    }, [dispatch, isReady, canFetchSalesCounts, location.pathname]);

    useEffect(() => {
        if (!isReady) return;
        if (!user || !(showAutoservice || user.is_admin)) {
            dispatch(clearAutoserviceClient());
            return;
        }
        dispatch(fetchAutoserviceClientMe());
    }, [dispatch, isReady, user?.id, showAutoservice, user?.is_admin]);

    if (!isReady) {
        return (
            <div className="min-h-screen max-w-full overflow-x-hidden bg-surface">
                <div className="hidden lg:block">
                    <Navigation />
                </div>
                <MobileHeader onMenuClick={() => {}} />
                <div className="hidden lg:block h-[var(--sg-desktop-header-h)] shrink-0" aria-hidden="true" />
                <div className="lg:hidden h-[var(--sg-mobile-header-h)] shrink-0" aria-hidden="true" />
                <main className="max-w-7xl mx-auto max-lg:px-3 max-lg:py-4 px-3 py-12">
                    <AuthLoadingScreen className="h-48" />
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen max-w-full overflow-x-hidden bg-surface pb-[4.5rem] lg:pb-0">
            <HeaderBadgeHeightSync />
            <div className="hidden lg:block">
                <Navigation />
            </div>

            <MobileHeader onMenuClick={openMenu} />

            <div className="hidden lg:block h-[var(--sg-desktop-header-h)] shrink-0" aria-hidden="true" />
            <div className="lg:hidden h-[var(--sg-mobile-header-h)] shrink-0" aria-hidden="true" />

            <NotificationsBanner />

            <MobileSideMenu
                isOpen={isMobileMenuOpen}
                onClose={closeMenu}
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={handleTabChange}
                badgeCounts={badgeCounts}
                showAdminMenuSwitch={showAdminMenuSwitch}
                adminMenuMode={adminMenuMode}
                onAdminMenuModeChange={setAdminMenuMode}
            />

            <main
                className={`mx-auto ${
                    isChatsPage
                        ? 'max-w-full max-lg:px-0 max-lg:py-0 px-3 py-6 sm:py-8 lg:flex lg:max-h-[calc(100dvh-var(--sg-desktop-header-h))] lg:min-h-0 lg:flex-col lg:overflow-hidden lg:py-4 lg:max-w-7xl'
                        : 'max-w-7xl max-lg:px-3 max-lg:py-4 px-3 sm:px-1 lg:px-2 py-6 sm:py-8'
                }`}
            >
                <div
                    className={`grid min-h-0 grid-cols-1 lg:grid-cols-[minmax(15.5rem,17.5rem)_1fr] ${
                        isChatsPage
                            ? 'max-lg:gap-0 flex-1 gap-6 lg:overflow-hidden'
                            : 'gap-6'
                    }`}
                >
                    <div className="hidden lg:block min-w-0">
                        <ProfileMenuTabs
                            tabs={tabs}
                            activeTab={activeTab}
                            onTabChange={handleTabChange}
                            badgeCounts={badgeCounts}
                            showAdminMenuSwitch={showAdminMenuSwitch}
                            adminMenuMode={adminMenuMode}
                            onAdminMenuModeChange={setAdminMenuMode}
                        />
                    </div>

                    <div
                        className={`min-h-0 min-w-0 ${
                            isChatsPage ? 'flex min-h-0 flex-col lg:h-full lg:overflow-hidden' : ''
                        }`}
                    >
                        <Outlet key={location.pathname} />
                    </div>
                </div>
            </main>

            <InstallPwaPrompt />
            <MobileBottomNav />
        </div>
    );
}

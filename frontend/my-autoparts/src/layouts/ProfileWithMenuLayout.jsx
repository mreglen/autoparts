// src/layouts/ProfileWithMenuLayout.jsx
import { useEffect, useMemo, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Outlet, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { fetchPendingProducts } from '../redux/slices/ModerationProductsSlice';
import { fetchPendingSellers } from '../redux/slices/ModerationSlice';
import { fetchSalesMenuCounts } from '../redux/slices/SalesMenuCountsSlice';
import {
  clearAutoserviceClient,
  fetchAutoserviceClientMe,
} from '../redux/slices/AutoserviceClientSlice';
import { selectShowAutoservice } from '../utils/autoservicePublic';
import { apiAxios } from '../utils/apiClient';
import ProfileMenuTabs from '../pages/Profile/menu/ProfileMenuTabs';
import { useAuthReady } from '../hooks/useAuthReady';
import { useMobileMenuShell } from '../hooks/useMobileMenuShell';
import useScrollResetOnNavigate from '../hooks/useScrollResetOnNavigate';
import AuthLoadingScreen from '../components/AuthLoadingScreen/AuthLoadingScreen';
import useCartSync from '../hooks/useCartSync';
import NotificationsBanner from '../components/NotificationsBanner/NotificationsBanner';
import MobileShellFrame from './MobileShellFrame';
import { getCabinetLayoutProfile, getCabinetMainClasses } from '../utils/layoutProfiles';
import { resolveActiveChatParams } from '../utils/resolveActiveChatParams';
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
    useScrollResetOnNavigate();
    const permissionCodes = useSelector((state) => state.auth.permissionCodes);
    const moderationProducts = useSelector((state) => state.moderationProducts);
    const moderation = useSelector((state) => state.moderation);
    const salesMenuCounts = useSelector((state) => state.salesMenuCounts);
    const showAutoservice = useSelector(selectShowAutoservice);
    const location = useLocation();
    const routeParams = useParams();
    const [searchParams] = useSearchParams();
    const [purchasesMenuCounts, setPurchasesMenuCounts] = useState({ orders: 0, returns: 0 });

    const chatParams = resolveActiveChatParams(location.pathname, searchParams, routeParams);
    const cabinetProfile = getCabinetLayoutProfile(location.pathname, chatParams.chatId);
    const isChatsPage = cabinetProfile.isChatsPage;
    const isMobileActiveChat = cabinetProfile.isActiveChat;
    const isPrintPage = /\/print(\/|$)/.test(location.pathname);

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
        cabinetMode,
        setCabinetMode,
        availableCabinetModes,
        showCabinetModeSwitch,
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
            <MobileShellFrame onMenuClick={() => {}} showBottomChrome={false}>
                <main className="mx-auto w-full max-w-sg-content max-lg:px-4 max-lg:py-4 px-4 py-12 sm:px-6 lg:px-8">
                    <AuthLoadingScreen className="h-48" />
                </main>
            </MobileShellFrame>
        );
    }

    if (isPrintPage) {
        return (
            <div className="repair-order-print-layout min-h-screen max-w-full overflow-x-hidden bg-white print:min-h-0 print:max-h-none print:overflow-visible print:overflow-x-visible print:overflow-y-visible">
                <Outlet key={location.pathname} />
            </div>
        );
    }

    const mainClassName = getCabinetMainClasses({ isChatsPage, isMobileActiveChat });

    return (
        <MobileShellFrame
            mobileHeaderHidden={cabinetProfile.hideMobileHeader}
            onMenuClick={openMenu}
            beforeMain={location.pathname === '/profile' ? <NotificationsBanner /> : null}
            sideMenuProps={{
                isOpen: isMobileMenuOpen,
                onClose: closeMenu,
                tabs,
                activeTab,
                onTabChange: handleTabChange,
                badgeCounts,
                showCabinetModeSwitch,
                cabinetMode,
                availableCabinetModes,
                onCabinetModeChange: setCabinetMode,
            }}
        >
            <main className={mainClassName}>
                <div
                    className={`grid min-h-0 grid-cols-1 lg:grid-cols-[minmax(15.5rem,17.5rem)_1fr] lg:items-start ${
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
                            showCabinetModeSwitch={showCabinetModeSwitch}
                            cabinetMode={cabinetMode}
                            availableCabinetModes={availableCabinetModes}
                            onCabinetModeChange={setCabinetMode}
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
        </MobileShellFrame>
    );
}

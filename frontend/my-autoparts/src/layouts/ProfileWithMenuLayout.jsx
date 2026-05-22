// src/layouts/ProfileWithMenuLayout.jsx
import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Outlet, useLocation } from 'react-router-dom';
import { fetchPendingProducts } from '../redux/slices/ModerationProductsSlice';
import { fetchPendingSellers } from '../redux/slices/ModerationSlice';
import Navigation from '../pages/Navigation/Navigation';
import MobileHeader from '../components/MobileHeader/MobileHeader';
import MobileBottomNav from '../components/MobileBottomNav/MobileBottomNav';
import MobileSideMenu from '../components/MobileSideMenu/MobileSideMenu';
import ProfileMenuTabs from '../pages/Profile/menu/ProfileMenuTabs';
import { useAuthReady } from '../hooks/useAuthReady';
import { useMobileMenuShell } from '../hooks/useMobileMenuShell';
import AuthLoadingScreen from '../components/AuthLoadingScreen/AuthLoadingScreen';
import InstallPwaPrompt from '../components/InstallPwaPrompt/InstallPwaPrompt';

export default function ProfileWithMenuLayout() {
    const dispatch = useDispatch();
    const { isReady, user } = useAuthReady();
    const permissionCodes = useSelector((state) => state.auth.permissionCodes);
    const moderationProducts = useSelector((state) => state.moderationProducts);
    const moderation = useSelector((state) => state.moderation);
    const location = useLocation();

    const isChatsPage = location.pathname.startsWith('/chats');

    const badgeCounts = {
        'product-moderation': moderationProducts?.pendingProducts?.length || 0,
        'pending-sellers': moderation?.pendingSellers?.length || 0,
        administration:
            (moderationProducts?.pendingProducts?.length || 0) +
            (moderation?.pendingSellers?.length || 0),
    };

    const {
        tabs,
        activeTab,
        isMobileMenuOpen,
        openMenu,
        closeMenu,
        handleTabChange,
    } = useMobileMenuShell(user);

    useEffect(() => {
        if (!isReady || !user?.is_admin) return;
        dispatch(fetchPendingProducts());
        dispatch(fetchPendingSellers());
    }, [dispatch, isReady, user?.is_admin]);

    if (!isReady) {
        return (
            <div className="min-h-screen bg-gray-50">
                <div className="hidden md:block">
                    <Navigation />
                </div>
                <MobileHeader onMenuClick={() => {}} />
                <main className="max-w-7xl mx-auto max-md:px-3 max-md:py-4 px-3 py-12">
                    <AuthLoadingScreen className="h-48" />
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-[4.5rem] md:pb-0">
            <div className="hidden md:block">
                <Navigation />
            </div>

            <MobileHeader onMenuClick={openMenu} />

            <MobileSideMenu
                isOpen={isMobileMenuOpen}
                onClose={closeMenu}
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={handleTabChange}
                badgeCounts={badgeCounts}
            />

            <main
                className={`mx-auto ${
                    isChatsPage
                        ? 'max-w-full max-md:px-0 max-md:py-0 px-3 py-6 sm:py-8 md:max-w-7xl'
                        : 'max-w-7xl max-md:px-3 max-md:py-4 px-3 sm:px-1 lg:px-2 py-6 sm:py-8'
                }`}
            >
                <div className={`grid grid-cols-1 lg:grid-cols-[minmax(15.5rem,17.5rem)_1fr] ${isChatsPage ? 'max-md:gap-0 gap-6' : 'gap-6'}`}>
                    <div className="hidden lg:block min-w-0">
                        <ProfileMenuTabs
                            tabs={tabs}
                            activeTab={activeTab}
                            onTabChange={handleTabChange}
                            badgeCounts={badgeCounts}
                        />
                    </div>

                    <div className="min-h-0 min-w-0">
                        <Outlet />
                    </div>
                </div>
            </main>

            <InstallPwaPrompt />
            <MobileBottomNav />
        </div>
    );
}

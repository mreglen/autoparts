import { useSelector } from 'react-redux';
import { Outlet, useLocation } from 'react-router-dom';
import Navigation from '../pages/Navigation/Navigation';
import MobileHeader from '../components/MobileHeader/MobileHeader';
import MobileBottomNav from '../components/MobileBottomNav/MobileBottomNav';
import MobileSideMenu from '../components/MobileSideMenu/MobileSideMenu';
import { useMobileMenuShell } from '../hooks/useMobileMenuShell';
import InstallPwaPrompt from '../components/InstallPwaPrompt/InstallPwaPrompt';
import Breadcrumbs from '../components/Breadcrumbs/Breadcrumbs';
import { usePageBreadcrumbs } from '../hooks/usePageBreadcrumbs';
import AvitoProExpiredBanner from '../components/AvitoProExpiredBanner/AvitoProExpiredBanner';
import { useAvitoAccountStatus } from '../hooks/useAvitoAccountStatus';
import useCartSync from '../hooks/useCartSync';

export default function MainLayout() {
    const location = useLocation();
    const { user } = useSelector((state) => state.auth);
    useCartSync();
    const breadcrumbItems = usePageBreadcrumbs();
    const isPartPage = location.pathname.startsWith('/part/');
    const { status: avitoAccountStatus } = useAvitoAccountStatus(user?.organization_id, {
        enabled: Boolean(user?.organization_id),
    });

    const isAutopartsPage = location.pathname.startsWith('/autoparts');
    const isFullBleedAmbientPage =
        location.pathname === '/reviews' ||
        location.pathname === '/' ||
        location.pathname === '/organizations' ||
        location.pathname.startsWith('/organizations/');

    const {
        token,
        tabs,
        activeTab,
        isMobileMenuOpen,
        openMenu,
        closeMenu,
        handleTabChange,
        guestContent,
    } = useMobileMenuShell(user);

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
                guestContent={token ? null : guestContent}
            />

            <main
                className={`mx-auto ${
                    isFullBleedAmbientPage
                        ? 'max-w-none bg-[#f4f6fb] px-0 py-0 min-h-[calc(100dvh-3.75rem-4.5rem)] md:min-h-[calc(100dvh-7.5rem)]'
                        : isAutopartsPage
                        ? 'max-w-7xl max-md:px-0 max-md:py-2 px-3 sm:px-1 lg:px-2 py-6 sm:py-8'
                        : 'max-w-7xl max-md:px-3 max-md:py-4 px-3 sm:px-1 lg:px-2 py-6 sm:py-8'
                }`}
            >
                {breadcrumbItems.length > 0 ? (
                    <div className={isFullBleedAmbientPage ? 'mx-auto max-w-7xl px-4 pt-6 sm:px-6 sm:pt-8 lg:px-8' : undefined}>
                        <Breadcrumbs items={breadcrumbItems} includeJsonLd={!isPartPage} />
                    </div>
                ) : null}
                <AvitoProExpiredBanner status={avitoAccountStatus} />
                <Outlet />
            </main>

            <InstallPwaPrompt />
            <MobileBottomNav />
        </div>
    );
}

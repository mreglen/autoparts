import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Outlet, useLocation, useSearchParams } from 'react-router-dom';
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
    const [searchParams] = useSearchParams();
    const { user } = useSelector((state) => state.auth);
    useCartSync();
    const breadcrumbItems = usePageBreadcrumbs();
    const isPartPage = location.pathname.startsWith('/part/');
    const isSeoLandingPage = /^\/autoparts\/(new|used)\/(brand|category|geo)\/[^/]+$/.test(
        location.pathname,
    );
    const { status: avitoAccountStatus } = useAvitoAccountStatus(user?.organization_id, {
        enabled: Boolean(user?.organization_id),
    });

    const isAutopartsPage = location.pathname.startsWith('/autoparts');
    const isChatsPage = location.pathname.startsWith('/chats');
    const isMobileActiveChat = isChatsPage && Boolean(searchParams.get('chatId'));
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

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [location.pathname]);

    return (
        <div className="min-h-screen max-w-full overflow-x-hidden bg-gray-50 pb-[4.5rem] lg:pb-0">
            <div className="hidden lg:block">
                <Navigation />
            </div>

            <MobileHeader onMenuClick={openMenu} hidden={isMobileActiveChat} />

            <div className="hidden lg:block h-[var(--sg-desktop-header-h)] shrink-0" aria-hidden="true" />
            <div
                className={`lg:hidden h-[var(--sg-mobile-header-h)] shrink-0 ${isMobileActiveChat ? 'hidden' : ''}`}
                aria-hidden="true"
            />

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
                        ? 'max-w-none bg-[#f4f6fb] px-0 py-0 min-h-[calc(100dvh-var(--sg-mobile-header-h)-4.5rem)] lg:min-h-[calc(100dvh-var(--sg-desktop-header-h))]'
                        : isChatsPage
                        ? `max-w-7xl max-lg:px-0 max-lg:py-0 max-lg:overflow-hidden px-3 sm:px-1 lg:px-2 py-6 sm:py-8 ${
                            isMobileActiveChat
                              ? 'max-lg:h-[calc(100dvh-4.5rem-env(safe-area-inset-bottom,0px))]'
                              : 'max-lg:h-[calc(100dvh-var(--sg-mobile-header-h)-4.5rem-env(safe-area-inset-bottom,0px))]'
                          } lg:min-h-[calc(100dvh-var(--sg-desktop-header-h))]`
                        : isAutopartsPage
                        ? 'max-w-7xl max-lg:px-0 max-lg:py-2 px-3 sm:px-1 lg:px-2 py-6 sm:py-8'
                        : 'max-w-7xl max-lg:px-3 max-lg:py-4 px-3 sm:px-1 lg:px-2 py-6 sm:py-8'
                }`}
            >
                {breadcrumbItems.length > 0 && !isSeoLandingPage && !isPartPage && !isChatsPage ? (
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

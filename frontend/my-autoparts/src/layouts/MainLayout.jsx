import { useSelector } from 'react-redux';
import { Outlet, useLocation, useParams, useSearchParams } from 'react-router-dom';
import Breadcrumbs from '../components/Breadcrumbs/Breadcrumbs';
import { usePageBreadcrumbs } from '../hooks/usePageBreadcrumbs';
import AvitoProExpiredBanner from '../components/AvitoProExpiredBanner/AvitoProExpiredBanner';
import { useAvitoAccountStatus } from '../hooks/useAvitoAccountStatus';
import useCartSync from '../hooks/useCartSync';
import useScrollResetOnNavigate from '../hooks/useScrollResetOnNavigate';
import { useMobileMenuShell } from '../hooks/useMobileMenuShell';
import MobileShellFrame from './MobileShellFrame';
import { getPublicLayoutProfile, getPublicMainClasses } from '../utils/layoutProfiles';
import { resolveActiveChatParams } from '../utils/resolveActiveChatParams';

export default function MainLayout() {
    const location = useLocation();
    const routeParams = useParams();
    const [searchParams] = useSearchParams();
    const { user } = useSelector((state) => state.auth);
    useCartSync();
    useScrollResetOnNavigate();
    const breadcrumbItems = usePageBreadcrumbs();

    const chatParams = resolveActiveChatParams(location.pathname, searchParams, routeParams);
    const layoutProfile = getPublicLayoutProfile(location.pathname, chatParams.chatId);
    const isPartPage = layoutProfile.isPartPage;
    const isNewPartDetailPage = layoutProfile.isNewPartDetail;
    const isSeoLandingPage = /^\/autoparts\/(new|used)\/(brand|category|geo)\/[^/]+$/.test(
        location.pathname,
    );
    const { status: avitoAccountStatus } = useAvitoAccountStatus(user?.organization_id, {
        enabled: Boolean(user?.organization_id),
    });

    const isVinCatalogPage = layoutProfile.isVinCatalog;
    const isChatsPage = layoutProfile.isChatsPage;
    const isMobileActiveChat = layoutProfile.isActiveChat;
    const isFullBleedAmbientPage = layoutProfile.isFullBleedAmbient;

    const {
        token,
        tabs,
        activeTab,
        isMobileMenuOpen,
        openMenu,
        closeMenu,
        handleTabChange,
        guestContent,
        cabinetMode,
        setCabinetMode,
        availableCabinetModes,
        showCabinetModeSwitch,
    } = useMobileMenuShell(user);

    const mainClassName = getPublicMainClasses({
        isFullBleedAmbientPage,
        isChatsPage,
        isMobileActiveChat,
        isPartPage,
        isNewPartDetailPage,
        isVinCatalogPage,
        isAutopartsPage: layoutProfile.isAutopartsPage,
        pathname: location.pathname,
    });

    return (
        <MobileShellFrame
            mobileHeaderHidden={layoutProfile.hideMobileHeader}
            onMenuClick={openMenu}
            showBottomChrome={!isMobileActiveChat}
            reserveBottomNavSpace={!isMobileActiveChat}
            sideMenuProps={{
                isOpen: isMobileMenuOpen,
                onClose: closeMenu,
                tabs,
                activeTab,
                onTabChange: handleTabChange,
                guestContent: token ? null : guestContent,
                showCabinetModeSwitch,
                cabinetMode,
                availableCabinetModes,
                onCabinetModeChange: setCabinetMode,
            }}
        >
            <main className={`mx-auto ${mainClassName}`}>
                {breadcrumbItems.length > 0 && !isSeoLandingPage && !isPartPage && !isNewPartDetailPage && !isChatsPage && !isVinCatalogPage ? (
                    <div className={isFullBleedAmbientPage ? 'mx-auto max-w-sg-content px-4 pt-6 sm:px-6 sm:pt-8 lg:px-8' : undefined}>
                        <Breadcrumbs items={breadcrumbItems} includeJsonLd={!isPartPage} />
                    </div>
                ) : null}
                <AvitoProExpiredBanner status={avitoAccountStatus} />
                <Outlet />
            </main>
        </MobileShellFrame>
    );
}

import { useSelector } from 'react-redux';
import { Outlet, useLocation } from 'react-router-dom';
import Navigation from '../pages/Navigation/Navigation';
import MobileHeader from '../components/MobileHeader/MobileHeader';
import MobileBottomNav from '../components/MobileBottomNav/MobileBottomNav';
import MobileSideMenu from '../components/MobileSideMenu/MobileSideMenu';
import { useMobileMenuShell } from '../hooks/useMobileMenuShell';

export default function MainLayout() {
    const location = useLocation();
    const { user } = useSelector((state) => state.auth);

    const isAutopartsPage = location.pathname.startsWith('/autoparts');

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
                    isAutopartsPage
                        ? 'max-w-7xl max-md:px-0 max-md:py-2 px-3 sm:px-1 lg:px-2 py-6 sm:py-8'
                        : 'max-w-7xl max-md:px-3 max-md:py-4 px-3 sm:px-1 lg:px-2 py-6 sm:py-8'
                }`}
            >
                <Outlet />
            </main>

            <MobileBottomNav />
        </div>
    );
}

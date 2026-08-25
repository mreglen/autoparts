import Navigation from '../pages/Navigation/Navigation';
import MobileHeader from '../components/MobileHeader/MobileHeader';
import MobileBottomNav from '../components/MobileBottomNav/MobileBottomNav';
import MobileSideMenu from '../components/MobileSideMenu/MobileSideMenu';
import InstallPwaPrompt from '../components/InstallPwaPrompt/InstallPwaPrompt';
import OfflineBanner from '../components/OfflineBanner/OfflineBanner';
import AppUpdateBanner from '../components/AppUpdateBanner/AppUpdateBanner';
import HeaderBadgeHeightSync from '../components/Seo/HeaderBadgeHeightSync';

/**
 * Shared mobile/desktop shell chrome for public and cabinet layouts.
 */
export default function MobileShellFrame({
  mobileHeaderHidden = false,
  onMenuClick,
  showMenuButton = true,
  sideMenuProps,
  beforeMain = null,
  children,
  showBottomChrome = true,
  reserveBottomNavSpace,
}) {
  const reserveNavPad = reserveBottomNavSpace ?? showBottomChrome;
  return (
    <div className={`min-h-screen max-w-full overflow-x-hidden bg-surface max-lg:flex max-lg:min-h-dvh max-lg:flex-col lg:pb-0 ${reserveNavPad ? 'pb-mobile-nav' : 'max-lg:pb-0'}`}>
      <HeaderBadgeHeightSync />
      <div className="hidden lg:block">
        <Navigation />
      </div>

      <MobileHeader
        onMenuClick={onMenuClick}
        hidden={mobileHeaderHidden}
        showMenuButton={showMenuButton}
      />

      <div className="hidden lg:block h-[var(--sg-desktop-header-h)] shrink-0" aria-hidden="true" />
      <div
        className={`lg:hidden h-[var(--sg-mobile-header-h)] shrink-0 ${mobileHeaderHidden ? 'hidden' : ''}`}
        aria-hidden="true"
      />

      {beforeMain}

      <OfflineBanner />

      {sideMenuProps ? <MobileSideMenu {...sideMenuProps} /> : null}

      {children}

      {showBottomChrome ? (
        <>
          <AppUpdateBanner />
          <InstallPwaPrompt />
          <MobileBottomNav />
        </>
      ) : null}
    </div>
  );
}

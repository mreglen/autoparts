/**
 * Layout profile helpers for MainLayout / ProfileWithMenuLayout.
 * Keeps route-specific padding and chrome flags in one place.
 */

export function isMobileActiveChat(pathname = '', chatId = null) {
  const path = String(pathname || '');
  if (!path.startsWith('/chats')) {
    return false;
  }
  return Boolean(chatId);
}

export function isNewPartDetailPage(pathname = '') {
  return /^\/autoparts\/new\/part\/[^/]+$/.test(String(pathname || ''));
}

export function getPublicLayoutProfile(pathname = '', chatIdParam = null) {
  const path = String(pathname || '');
  const isPartPage = path.startsWith('/part/');
  const isNewPartDetail = isNewPartDetailPage(path);
  const isChatsPage = path.startsWith('/chats');
  const isActiveChat = isMobileActiveChat(path, chatIdParam);
  const isVinCatalog = path.startsWith('/autoparts/vin');
  const isFullBleedAmbient =
    path === '/' ||
    path.startsWith('/reviews') ||
    path === '/organizations' ||
    path.startsWith('/organizations/');
  const isAutopartsPage = path.startsWith('/autoparts');

  return {
    isPartPage,
    isNewPartDetail,
    isChatsPage,
    isActiveChat,
    isVinCatalog,
    isFullBleedAmbient,
    isAutopartsPage,
    hideMobileHeader: isPartPage || isActiveChat || isNewPartDetail,
  };
}

export function getPublicMainClasses({
  isFullBleedAmbientPage,
  isChatsPage,
  isPartPage,
  isNewPartDetailPage,
  isVinCatalogPage,
  isAutopartsPage,
}) {
  if (isFullBleedAmbientPage) {
    return 'max-w-none bg-surface px-0 py-0 min-h-[calc(100dvh-var(--sg-mobile-header-h)-var(--sg-mobile-bottom-nav-total))] lg:min-h-[calc(100dvh-var(--sg-desktop-header-h))]';
  }
  if (isChatsPage) {
    return 'max-w-sg-content max-lg:flex max-lg:min-h-0 max-lg:flex-1 max-lg:flex-col max-lg:overflow-hidden max-lg:px-0 max-lg:py-0 px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:min-h-[calc(100dvh-var(--sg-desktop-header-h))]';
  }
  if (isPartPage || isNewPartDetailPage) {
    return 'max-w-sg-content max-lg:px-0 max-lg:py-0 px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-lg:min-h-[calc(100dvh-var(--sg-mobile-bottom-nav-total))]';
  }
  if (isVinCatalogPage) {
    return 'max-w-sg-content max-lg:px-0 max-lg:py-0 px-4 sm:px-6 lg:px-8 py-2 sm:py-3';
  }
  if (isAutopartsPage) {
    return 'max-w-sg-content max-lg:px-0 max-lg:py-2 px-4 sm:px-6 lg:px-8 py-6 sm:py-8';
  }
  return 'max-w-sg-content max-lg:px-4 max-lg:py-4 px-4 sm:px-6 lg:px-8 py-6 sm:py-8';
}

export function getCabinetLayoutProfile(pathname = '', chatIdParam = null) {
  const path = String(pathname || '');
  const isChatsPage = path.startsWith('/chats');
  const isActiveChat = isMobileActiveChat(path, chatIdParam);
  const isAutoserviceStaffPage = path.startsWith('/autoservice/') && !/\/print(\/|$)/.test(path);
  return {
    isChatsPage,
    isActiveChat,
    isAutoserviceStaffPage,
    hideSidebar: isActiveChat,
    hideMobileHeader: isActiveChat,
  };
}

/** Horizontal padding for autoservice staff pages on mobile (layout main uses px-0). */
export const autoserviceStaffPageClass = 'w-full min-w-0 max-lg:px-4';

export function getCabinetMainClasses({ isChatsPage, isAutoserviceStaffPage = false }) {
  if (isChatsPage) {
    return 'mx-auto max-w-full max-lg:flex max-lg:min-h-0 max-lg:flex-1 max-lg:flex-col max-lg:overflow-hidden max-lg:px-0 max-lg:py-0 px-4 py-6 sm:px-6 sm:py-8 lg:flex lg:max-h-[calc(100dvh-var(--sg-desktop-header-h))] lg:min-h-0 lg:flex-col lg:overflow-hidden lg:px-8 lg:py-4 lg:max-w-sg-content';
  }
  if (isAutoserviceStaffPage) {
    return 'mx-auto max-w-sg-content max-lg:px-0 max-lg:py-4 px-4 sm:px-6 lg:px-8 py-6 sm:py-8';
  }
  return 'mx-auto max-w-sg-content max-lg:px-4 max-lg:py-4 px-4 sm:px-6 lg:px-8 py-6 sm:py-8';
}

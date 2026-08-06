/**
 * Layout profile helpers for MainLayout / ProfileWithMenuLayout.
 * Keeps route-specific padding and chrome flags in one place.
 */

export function getPublicLayoutProfile(pathname = '') {
  const path = String(pathname || '');
  const isPartPage = path.startsWith('/part/');
  const isChatsPage = path.startsWith('/chats');
  const isActiveChat = Boolean(path.match(/^\/chats\/[^/]+$/));
  const isVinCatalog = path.startsWith('/autoparts/vin');
  const isFullBleedAmbient =
    path === '/' ||
    path.startsWith('/reviews') ||
    path === '/organizations' ||
    path.startsWith('/organizations/');

  return {
    isPartPage,
    isChatsPage,
    isActiveChat,
    isVinCatalog,
    isFullBleedAmbient,
    hideMobileHeader: isPartPage || isActiveChat,
    mainClassName: [
      isPartPage || isActiveChat ? 'px-0' : 'px-4 sm:px-6 lg:px-8',
      isFullBleedAmbient ? 'bg-white' : '',
      isChatsPage ? 'min-h-0 flex-1' : '',
    ]
      .filter(Boolean)
      .join(' '),
  };
}

export function getCabinetLayoutProfile(pathname = '') {
  const path = String(pathname || '');
  const isChatsPage = path.startsWith('/chats');
  const isActiveChat = Boolean(path.match(/^\/chats\/[^/]+$/));
  return {
    isChatsPage,
    isActiveChat,
    hideSidebar: isActiveChat,
  };
}

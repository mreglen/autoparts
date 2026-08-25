const AUTOSERVICE_DOCUMENT_PATH_RE = /^\/autoservice\/orders\/\d+\/print(\/upd|\/invoice)?$/;
const AUTOSERVICE_ORDER_EDIT_RE = /^\/autoservice\/orders\/\d+\/edit$/;
const NEW_PARTS_PAYMENT_RE = /^\/cart\/new\/pay\//;

/** Routes where pull-to-refresh is disabled entirely. */
export function isPullToRefreshDisabled(pathname, search = '') {
  const path = String(pathname || '');
  const searchStr = String(search || '');
  const params = new URLSearchParams(searchStr.startsWith('?') ? searchStr.slice(1) : searchStr);
  const pathChatMatch = path.match(/^\/chats\/([^/?#]+)$/);
  const hasActiveChat = path.startsWith('/chats') && (Boolean(params.get('chatId')) || Boolean(pathChatMatch));
  if (hasActiveChat) return true;

  return (
    path === '/warehouse/scan' ||
    AUTOSERVICE_DOCUMENT_PATH_RE.test(path) ||
    NEW_PARTS_PAYMENT_RE.test(path)
  );
}

/** Routes with unsaved form state — PTR disabled entirely. */
export function isPullToRefreshFormOnly(pathname) {
  const path = String(pathname || '');
  return (
    path === '/order-reg' ||
    path === '/cart/new/checkout' ||
    path === '/autoservice/orders/new' ||
    AUTOSERVICE_ORDER_EDIT_RE.test(path)
  );
}

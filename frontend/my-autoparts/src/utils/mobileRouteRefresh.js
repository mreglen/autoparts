import { fetchCart } from '../redux/slices/CartSlice';
import { fetchUnreadCount, fetchUserChats } from '../redux/slices/ChatSlice';
import { fetchPendingProducts } from '../redux/slices/ModerationProductsSlice';
import { fetchPendingSellers } from '../redux/slices/ModerationSlice';
import { fetchSalesMenuCounts } from '../redux/slices/SalesMenuCountsSlice';
import { fetchPublicSiteConfig, fetchSiteQuickLinks } from '../redux/slices/PublicInfoSlice';

export const MOBILE_PULL_REFRESH_EVENT = 'sg:mobile-pull-refresh';

export async function runMobileRouteRefresh({ pathname, dispatch, getState }) {
  const path = String(pathname || '');
  const state = getState();
  const token = state?.auth?.token;
  const user = state?.auth?.user;
  const tasks = [];

  tasks.push(dispatch(fetchPublicSiteConfig()));
  tasks.push(dispatch(fetchSiteQuickLinks()));

  if (token) {
    tasks.push(dispatch(fetchCart()));
    tasks.push(dispatch(fetchUnreadCount()));
  }

  if (path.startsWith('/chats') && token) {
    tasks.push(dispatch(fetchUserChats()));
  }

  if (user?.is_admin) {
    tasks.push(dispatch(fetchPendingProducts()));
    tasks.push(dispatch(fetchPendingSellers()));
  }

  if (token && user && (user.is_admin || user.is_seller || user.is_employee)) {
    tasks.push(dispatch(fetchSalesMenuCounts()));
  }

  await Promise.allSettled(tasks);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(MOBILE_PULL_REFRESH_EVENT, { detail: { pathname: path } }),
    );
  }
}

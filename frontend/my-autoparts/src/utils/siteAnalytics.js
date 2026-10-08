import { reachMetrikaGoal } from './metrikaGoals';

export const CONVERSION_EVENTS = {
  PART_VIEW: 'part_view',
  ADD_TO_CART: 'add_to_cart',
  SHOW_PHONE: 'show_phone',
  CHAT_START: 'chat_start',
  ORDER_PLACED: 'order_placed',
};

export function trackConversion(eventName, options = {}) {
  if (!eventName) return;

  const productId = options.productId != null ? Number(options.productId) : undefined;
  reachMetrikaGoal(eventName, {
    product_id: Number.isFinite(productId) && productId > 0 ? productId : undefined,
    path: options.path,
    section: options.section,
  });
}

export function trackPageView() {}

export function trackFormField() {}

export function trackFormSubmit() {}

export function flushEvents() {}

export function initSiteAnalyticsLifecycle() {}

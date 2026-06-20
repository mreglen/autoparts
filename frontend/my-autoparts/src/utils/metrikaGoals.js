export const METRIKA_ID = 107023580;

function isMetrikaEnabled() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host !== 'localhost' && host !== '127.0.0.1';
}

export function reachMetrikaGoal(goalName, params = {}) {
  if (!isMetrikaEnabled() || !goalName) return;

  const send = () => {
    if (typeof window.ym !== 'function') return;
    const payload = Object.fromEntries(
      Object.entries(params).filter(([, value]) => value != null && value !== '')
    );
    if (Object.keys(payload).length) {
      window.ym(METRIKA_ID, 'params', payload);
    }
    window.ym(METRIKA_ID, 'reachGoal', goalName, payload);
  };

  if (typeof window.ym === 'function') {
    send();
    return;
  }

  window.addEventListener('load', () => window.setTimeout(send, 0), { once: true });
}

export const METRIKA_GOALS = {
  PART_VIEW: 'part_view',
  ADD_TO_CART: 'add_to_cart',
  SHOW_PHONE: 'show_phone',
  CHAT_START: 'chat_start',
  ORDER_PLACED: 'order_placed',
};

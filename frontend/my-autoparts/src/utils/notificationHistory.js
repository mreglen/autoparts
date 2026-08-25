const STORAGE_KEY = 'sg_notification_history';
const MAX_ITEMS = 50;

export function readNotificationHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendNotificationHistory(entry) {
  if (!entry?.title && !entry?.body) return;
  try {
    const item = {
      id: entry.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: entry.title || 'Уведомление',
      body: entry.body || '',
      url: entry.url || '/',
      at: entry.at || Date.now(),
    };
    const next = [item, ...readNotificationHistory()].slice(0, MAX_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('notificationHistoryUpdated'));
  } catch {
    // ignore quota
  }
}

export function clearNotificationHistory() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('notificationHistoryUpdated'));
  } catch {
    // ignore
  }
}

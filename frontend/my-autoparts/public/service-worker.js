const CACHE_NAME = 'autoparts-v1';

self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker installed');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker activated');
  event.waitUntil(clients.claim());
});

function buildNotificationTag(data) {
  if (data.tag) return data.tag;
  if (data.type === 'order' && data.orderId) return `order-${data.orderId}`;
  if (data.chatId) return `chat-${data.chatId}`;
  if (data.type) return `${data.type}-general`;
  return 'notification-general';
}

function buildNotificationActions(data) {
  if (data.type === 'order') {
    return [{ action: 'open', title: 'Открыть заказы' }];
  }
  return [{ action: 'open', title: 'Открыть чат' }];
}

self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event.data);

  const data = event.data ? event.data.json() : {};
  const isOrder = data.type === 'order';
  const title = data.title || (isOrder ? 'Новый заказ' : 'Новое сообщение');
  const options = {
    body: data.body || (isOrder ? 'Поступил новый заказ' : 'У вас новое сообщение в чате'),
    icon: '/favicons/android-chrome-192x192.png',
    badge: '/favicons/favicon-32x32.png',
    data: {
      type: data.type || 'message',
      chatId: data.chatId,
      orderId: data.orderId,
      senderId: data.senderId,
      senderName: data.senderName,
      url: data.url || (isOrder ? '/sales/orders' : '/chats'),
    },
    actions: buildNotificationActions(data),
    tag: buildNotificationTag(data),
    renotify: true,
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

function extractChatIdFromUrl(url) {
  if (!url) return null;
  const match = String(url).match(/[?&]chatId=(\d+)/);
  return match ? match[1] : null;
}

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');

  event.notification.close();

  const data = event.notification.data || {};
  const urlToOpen = data.url || '/chats';
  const targetPath = urlToOpen.startsWith('/') ? urlToOpen : `/${urlToOpen}`;
  const chatId = data.chatId || extractChatIdFromUrl(targetPath);

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        try {
          const clientUrl = new URL(client.url);
          const clientPath = clientUrl.pathname + clientUrl.search;
          const sameTarget = clientPath === targetPath;
          const sameSection =
            (targetPath.startsWith('/sales/orders') && clientUrl.pathname.startsWith('/sales/orders')) ||
            (targetPath.startsWith('/chats') && clientUrl.pathname.startsWith('/chats'));

          if (sameTarget || sameSection) {
            if (chatId && targetPath.startsWith('/chats')) {
              client.postMessage({
                type: 'NAVIGATE_TO_CHAT',
                chatId,
                url: targetPath,
              });
            } else if (targetPath.startsWith('/sales')) {
              client.postMessage({
                type: 'NAVIGATE_TO_URL',
                url: targetPath,
              });
            }
            if ('focus' in client) return client.focus();
          }
        } catch (_) {
          // ignore malformed client.url
        }
      }

      const base = self.location.origin;
      return clients.openWindow(base + targetPath);
    }),
  );
});

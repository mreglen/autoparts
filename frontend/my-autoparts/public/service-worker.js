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
  if (data.orderId) return `order-${data.orderId}`;
  if (data.chatId) return `chat-${data.chatId}`;
  if (data.productId) return `product-${data.productId}`;
  if (data.returnId) return `return-${data.returnId}`;
  if (data.type) return `${data.type}-general`;
  return 'notification-general';
}

function buildNotificationActions(data) {
  return [{ action: 'open', title: 'Открыть' }];
}

function resolveNotificationUrl(data) {
  if (data.url) {
    return data.url.startsWith('/') ? data.url : `/${data.url}`;
  }
  if (data.type === 'order' || data.type === 'return_request') {
    return '/sales/orders';
  }
  if (data.type === 'order_status' || data.type === 'return_status') {
    return '/purchases/orders';
  }
  if (data.type === 'search_subscription' && data.productId) {
    return `/part/${data.productId}`;
  }
  if (data.chatId) {
    return `/chats?chatId=${data.chatId}`;
  }
  return '/';
}

function pathsShareSection(targetPath, clientPath) {
  const prefixes = [
    '/sales/orders',
    '/sales/returns',
    '/purchases/orders',
    '/purchases/returns',
    '/chats',
    '/my-parts',
    '/profile/subscriptions',
    '/part/',
  ];
  return prefixes.some((prefix) => targetPath.startsWith(prefix) && clientPath.startsWith(prefix));
}

self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event.data);

  const data = event.data ? event.data.json() : {};
  const targetUrl = resolveNotificationUrl(data);
  const title = data.title || 'Уведомление';
  const options = {
    body: data.body || '',
    icon: '/favicons/android-chrome-192x192.png',
    badge: '/favicons/favicon-32x32.png',
    data: {
      type: data.type || 'general',
      chatId: data.chatId,
      orderId: data.orderId,
      productId: data.productId,
      returnId: data.returnId,
      senderId: data.senderId,
      senderName: data.senderName,
      url: targetUrl,
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
  const targetPath = data.url || resolveNotificationUrl(data);
  const chatId = data.chatId || extractChatIdFromUrl(targetPath);

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        try {
          const clientUrl = new URL(client.url);
          const clientPath = clientUrl.pathname + clientUrl.search;
          const sameTarget = clientPath === targetPath;
          const sameSection = pathsShareSection(targetPath, clientPath);

          if (sameTarget || sameSection) {
            if (chatId && targetPath.startsWith('/chats')) {
              client.postMessage({
                type: 'NAVIGATE_TO_CHAT',
                chatId,
                url: targetPath,
              });
            } else {
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

const CACHE_NAME = 'autoparts-v1';

self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker installed');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker activated');
  event.waitUntil(clients.claim());
});

self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event.data);
  
  const data = event.data ? event.data.json() : {};
  
  const title = data.title || 'Новое сообщение';
  const options = {
    body: data.body || 'У вас новое сообщение в чате',
    icon: '/favicons/android-chrome-192x192.png',
    badge: '/favicons/favicon-32x32.png',
    data: {
      chatId: data.chatId,
      url: data.url || '/chat'
    },
    actions: [
      {
        action: 'open',
        title: 'Открыть чат'
      }
    ],
    tag: `chat-${data.chatId}`,
    renotify: true,
    requireInteraction: false
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/chat';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Check if there's already a window open
        for (let client of windowClients) {
          if (client.url.includes('/chat') && 'focus' in client) {
            return client.focus();
          }
        }
        // No window open, open new one
        return clients.openWindow(urlToOpen);
      })
  );
});

self.addEventListener('fetch', (event) => {
  // Default fetch handler - pass through
  event.respondWith(fetch(event.request));
});

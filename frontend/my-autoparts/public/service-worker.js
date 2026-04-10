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
      senderId: data.senderId,
      senderName: data.senderName,
      url: data.url || '/chats'
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
  
  const urlToOpen = event.notification.data?.url || '/chats';
  const chatId = event.notification.data?.chatId;
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Если есть chatId, пытаемся найти окно с этим чатом или открыть новый
        if (chatId) {
          const specificChatUrl = `/chats/${chatId}`;
          
          // Ищем уже открытое окно с этим чатом
          for (let client of windowClients) {
            if (client.url.includes(specificChatUrl) && 'focus' in client) {
              return client.focus();
            }
          }
          
          // Ищем любое окно с /chats и переключаем на нужный чат
          for (let client of windowClients) {
            if (client.url.includes('/chats') && 'focus' in client) {
              // Фокусируем окно и отправляем сообщение для навигации
              client.postMessage({
                type: 'NAVIGATE_TO_CHAT',
                chatId: chatId
              });
              return client.focus();
            }
          }
          
          // Нет открытых окон - открываем новый с нужным чатом
          return clients.openWindow(specificChatUrl);
        }
        
        // Нет chatId - просто открываем /chats
        for (let client of windowClients) {
          if (client.url.includes('/chats') && 'focus' in client) {
            return client.focus();
          }
        }
        
        return clients.openWindow(urlToOpen);
      })
  );
});

// НЕ перехватываем fetch - позволяем браузеру работать напрямую
// Service Worker только для push уведомлений

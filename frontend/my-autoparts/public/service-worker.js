const CACHE_NAME = 'autoparts-shell-v2';

const PRECACHE_ASSETS = /*__PRECACHE__*/[
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/fonts/onest.css',
  '/fonts/onest/onest-cyrillic.woff2',
  '/fonts/onest/onest-latin.woff2',
  '/favicons/android-chrome-192x192.png',
  '/favicons/android-chrome-512x512.png',
  '/img/LogoWithoutBg.png',
];

const OFFLINE_URL = '/offline.html';

function isApiRequest(url) {
  return url.pathname.startsWith('/server/api/') || url.pathname.startsWith('/api/');
}

function isStaticAsset(pathname) {
  return (
    pathname.startsWith('/static/')
    || pathname.startsWith('/favicons/')
    || pathname.startsWith('/img/')
    || pathname.endsWith('.js')
    || pathname.endsWith('.css')
    || pathname.endsWith('.woff2')
  );
}

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn('[SW] Precache failed:', err);
      }),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
    )).then(() => clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch (_) {
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (isApiRequest(url)) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match('/index.html');
          if (cached) return cached;
          const offline = await caches.match(OFFLINE_URL);
          return offline || Response.error();
        }),
    );
    return;
  }

  if (isStaticAsset(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
  }
});

function buildNotificationTag(data) {
  if (data.tag) return data.tag;
  if (data.orderId) return `order-${data.orderId}`;
  if (data.chatId) return `chat-${data.chatId}`;
  if (data.productId) return `product-${data.productId}`;
  if (data.returnId) return `return-${data.returnId}`;
  if (data.inspectionId) return `inspection-${data.inspectionId}`;
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
  if (data.type === 'autoservice_inspection') {
    return '/autoservice/inspections';
  }
  if (data.type === 'autoservice_planner') {
    return '/autoservice/planner';
  }
  if (data.chatId) {
    const source = data.source || data.chatSource || 'garage';
    return `/chats?source=${encodeURIComponent(source)}&chatId=${data.chatId}`;
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
    '/autoservice/',
  ];
  return prefixes.some((prefix) => targetPath.startsWith(prefix) && clientPath.startsWith(prefix));
}

self.addEventListener('push', (event) => {
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
      inspectionId: data.inspectionId,
      senderId: data.senderId,
      senderName: data.senderName,
      url: targetUrl,
    },
    actions: buildNotificationActions(data),
    tag: buildNotificationTag(data),
    renotify: true,
    requireInteraction: false,
  };

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options);
      const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      windowClients.forEach((client) => {
        client.postMessage({
          type: 'NOTIFICATION_RECEIVED',
          title,
          body: options.body,
          url: targetUrl,
          at: Date.now(),
        });
      });
    })(),
  );
});

function extractChatIdFromUrl(url) {
  if (!url) return null;
  const match = String(url).match(/[?&]chatId=(\d+)/);
  return match ? match[1] : null;
}

self.addEventListener('notificationclick', (event) => {
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

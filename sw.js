const CACHE_NAME = 'pontoclt-v10';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/app.js',
  './js/github-api.js',
  './js/db.js',
  './js/calculator.js',
  './js/ui.js',
  './js/love-notifications.js',
  './js/utils.js',
  './js/vendor/jspdf.umd.min.js',
  './js/vendor/jspdf.plugin.autotable.min.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

// Install — cache static shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — cache-first for shell, network-first for API
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Network-first for GitHub API calls
  if (url.hostname === 'api.github.com') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Network-first for Google Fonts and CDN assets (allow updates)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com' || url.hostname === 'unpkg.com' || url.hostname === 'cdnjs.cloudflare.com') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

// Love notification via postMessage from app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'LOVE_NOTIFICATION') {
    self.registration.showNotification(event.data.title, {
      body: event.data.body,
      icon: './assets/icons/icon-192.png',
      badge: './assets/icons/icon-192.png',
      tag: 'love-notification',
      renotify: true
    });
  }
});

// Periodic background sync for love notifications
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'love-notification') {
    event.waitUntil(showPeriodicLoveNotification());
  }
});

const LOVE_MESSAGES = [
  'Seu namorado te ama muito! Tenha um otimo dia!',
  'Voce e a pessoa mais incrivel do mundo!',
  'So passando pra dizer que voce e maravilhoso(a)!',
  'Pensando em voce agora... como sempre!',
  'Nao esquece de tomar agua e lembrar que eu te amo!',
  'Voce faz meus dias mais felizes!',
  'Saudade de voce ja bateu... Te amo muito!',
  'Voce e minha pessoa favorita nesse mundo todo!',
  'Um beijo virtual pra aliviar o dia!',
  'Vai dar tudo certo, amor! Estou sempre com voce!'
];

function showPeriodicLoveNotification() {
  const msg = LOVE_MESSAGES[Math.floor(Math.random() * LOVE_MESSAGES.length)];
  return self.registration.showNotification('Mensagem de Amor', {
    body: msg,
    icon: './assets/icons/icon-192.png',
    badge: './assets/icons/icon-192.png',
    tag: 'love-notification',
    renotify: true
  });
}

// Open app when notification is clicked
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow('./');
    })
  );
});

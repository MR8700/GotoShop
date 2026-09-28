// GotoShop PWA Service Worker v1.0
const CACHE_NAME = "gotoshop-cache-v1";
const STATIC_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/media/store/logo.png"
];

// Install Event: Pre-cache shell assets & activate immediately
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn("[SW] Pre-caching warning:", err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: Cleanup stale caches and claim clients immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Network-first for dynamic API / navigation, Stale-While-Revalidate for static assets
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET requests and WebSocket / analytics / API writes
  if (req.method !== "GET") return;
  if (url.pathname.startsWith("/api/chat") || url.pathname.startsWith("/api/calls") || url.pathname.startsWith("/ws")) {
    return;
  }

  // Navigation requests: Network first with cache fallback
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match("/") || caches.match(req))
    );
    return;
  }

  // Static images, scripts, fonts, icons: Stale-While-Revalidate
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|webp|woff2|woff|ttf)$/) ||
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/media/")
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(req).then((cachedResponse) => {
          const fetchPromise = fetch(req)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                cache.put(req, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(() => cachedResponse);
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // Default fetch
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});

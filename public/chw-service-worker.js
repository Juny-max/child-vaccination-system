// CHW Service Worker for Offline-First PWA
// Caches CHW pages, assets, and API responses for offline use

const CACHE_NAME = "chw-offline-cache-v1"
const API_CACHE = "chw-api-cache-v1"

// CHW pages to cache for offline use
const CHW_PAGES = [
  "/chw/dashboard",
  "/chw/find-child",
  "/chw/register-child",
]

// Assets to cache
const STATIC_ASSETS = [
  "/",
  "/globals.css",
]

// Install event - cache static assets
self.addEventListener("install", (event) => {
  console.log("[Service Worker] Installing CHW offline cache...")

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Caching CHW pages and assets")
      return cache.addAll([...CHW_PAGES, ...STATIC_ASSETS].filter(Boolean))
    })
  )

  // Force the waiting service worker to become active
  self.skipWaiting()
})

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("[Service Worker] Activating...")

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cache) => cache !== CACHE_NAME && cache !== API_CACHE)
          .map((cache) => {
            console.log("[Service Worker] Deleting old cache:", cache)
            return caches.delete(cache)
          })
      )
    })
  )

  // Take control of all clients immediately
  return self.clients.claim()
})

// Fetch event - serve from cache, fallback to network
self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) {
    return
  }

  // CHW pages: Network first, fallback to cache
  if (CHW_PAGES.some((page) => url.pathname.startsWith(page))) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone the response before caching
          const responseClone = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone)
          })
          return response
        })
        .catch(() => {
          // Network failed, try cache
          return caches.match(request).then((cached) => {
            if (cached) {
              console.log("[Service Worker] Serving cached page:", url.pathname)
              return cached
            }
            // Return offline page
            return new Response(
              `
              <!DOCTYPE html>
              <html>
                <head>
                  <title>Offline - CHW Dashboard</title>
                  <meta name="viewport" content="width=device-width, initial-scale=1">
                  <style>
                    body {
                      font-family: system-ui, -apple-system, sans-serif;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      min-height: 100vh;
                      margin: 0;
                      background: #f5f5f5;
                      padding: 20px;
                      text-align: center;
                    }
                    .container {
                      max-width: 400px;
                    }
                    h1 {
                      color: #333;
                      margin-bottom: 16px;
                    }
                    p {
                      color: #666;
                      line-height: 1.6;
                    }
                    button {
                      margin-top: 24px;
                      padding: 12px 24px;
                      background: #2563eb;
                      color: white;
                      border: none;
                      border-radius: 6px;
                      font-size: 16px;
                      cursor: pointer;
                    }
                    button:hover {
                      background: #1d4ed8;
                    }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <h1>📱 Offline Mode</h1>
                    <p>
                      You are currently offline. This page couldn't be loaded from cache.
                      Please check your internet connection and try again.
                    </p>
                    <button onclick="window.location.reload()">
                      Try Again
                    </button>
                  </div>
                </body>
              </html>
              `,
              {
                headers: { "Content-Type": "text/html" },
              }
            )
          })
        })
    )
    return
  }

  // API requests: Network first, cache as fallback
  if (url.pathname.startsWith("/api/chw")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Only cache successful GET requests
          if (request.method === "GET" && response.ok) {
            const responseClone = response.clone()
            caches.open(API_CACHE).then((cache) => {
              cache.put(request, responseClone)
            })
          }
          return response
        })
        .catch(() => {
          // Network failed, try cache
          return caches.match(request).then((cached) => {
            if (cached) {
              console.log("[Service Worker] Serving cached API response:", url.pathname)
              return cached
            }
            // Return offline response
            return new Response(
              JSON.stringify({
                error: "Offline",
                message: "Network unavailable. Using offline mode.",
              }),
              {
                status: 503,
                headers: { "Content-Type": "application/json" },
              }
            )
          })
        })
    )
    return
  }

  // Default: Network first, fallback to cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        const responseClone = response.clone()
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseClone)
        })
        return response
      })
      .catch(() => {
        return caches.match(request)
      })
  )
})

// Background sync for offline vaccinations
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-chw-vaccinations") {
    console.log("[Service Worker] Background sync triggered for vaccinations")
    event.waitUntil(syncVaccinations())
  }
})

async function syncVaccinations() {
  try {
    // This would sync pending vaccinations from IndexedDB to backend
    console.log("[Service Worker] Syncing vaccinations...")
    // Implementation would go here
    return Promise.resolve()
  } catch (error) {
    console.error("[Service Worker] Sync failed:", error)
    return Promise.reject(error)
  }
}

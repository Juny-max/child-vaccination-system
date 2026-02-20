const CACHE_NAME = 'cvcc-chw-osm-tiles-v1'
const TILE_HOSTS = new Set([
  'tile.openstreetmap.org',
  'a.tile.openstreetmap.org',
  'b.tile.openstreetmap.org',
  'c.tile.openstreetmap.org',
])

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)

  const isTileRequest = TILE_HOSTS.has(url.hostname) && /\/\d+\/\d+\/\d+\.png$/.test(url.pathname)

  if (!isTileRequest) {
    return
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request)
      if (cached) return cached

      try {
        const response = await fetch(request)
        if (response.ok) {
          cache.put(request, response.clone())
        }
        return response
      } catch {
        return new Response('', { status: 503, statusText: 'Offline tile unavailable' })
      }
    }),
  )
})

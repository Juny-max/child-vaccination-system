import withPWAInit from "next-pwa"

const skipAuthRedirectPlugin = {
  cacheWillUpdate: async ({ request, response }) => {
    if (!response) return null;

    try {
      if (response.redirected) return null;
      const responsePath = new URL(response.url).pathname;
      if (responsePath.startsWith("/auth")) return null;
      const requestPath = new URL(request.url).pathname;
      if (requestPath.startsWith("/chw") && !responsePath.startsWith("/chw")) {
        return null;
      }
    } catch {
      return null;
    }

    return response;
  },
}

const runtimeCaching = [
  // CHW pages - NetworkFirst so they work offline after first visit
  {
    urlPattern: ({ url, request }) =>
      request.mode === "navigate" &&
      (url.pathname.startsWith("/chw/") || url.pathname === "/chw"),
    handler: "NetworkFirst",
    options: {
      cacheName: "chw-pages-v2",
      networkTimeoutSeconds: 10,
      precacheFallback: {
        fallbackURL: "/offline.html",
      },
      expiration: {
        maxEntries: 32,
        maxAgeSeconds: 7 * 24 * 60 * 60,
      },
      plugins: [skipAuthRedirectPlugin],
      cacheableResponse: {
        statuses: [200],
      },
    },
  },
  // CHW API responses - cache for offline use
  {
    urlPattern: ({ url }) => url.pathname.startsWith("/api/chw"),
    handler: "NetworkFirst",
    options: {
      cacheName: "chw-api-cache-v2",
      networkTimeoutSeconds: 10,
      expiration: {
        maxEntries: 100,
        maxAgeSeconds: 24 * 60 * 60,
      },
      cacheableResponse: {
        statuses: [200],
      },
    },
  },
  // Other navigation - with offline fallback
  {
    urlPattern: ({ request }) => request.mode === "navigate",
    handler: "NetworkFirst",
    options: {
      cacheName: "app-pages-v2",
      networkTimeoutSeconds: 10,
      precacheFallback: {
        fallbackURL: "/offline.html",
      },
      expiration: {
        maxEntries: 64,
        maxAgeSeconds: 7 * 24 * 60 * 60,
      },
      plugins: [skipAuthRedirectPlugin],
      cacheableResponse: {
        statuses: [200],
      },
    },
  },
  {
    urlPattern: ({ request, url }) =>
      url.pathname.startsWith("/_next/static/") ||
      ["script", "style", "worker", "font"].includes(request.destination),
    handler: "StaleWhileRevalidate",
    options: {
      cacheName: "app-shell-static-assets",
      expiration: {
        maxEntries: 256,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      },
      cacheableResponse: {
        statuses: [0, 200],
      },
    },
  },
  {
    urlPattern: ({ request }) => request.destination === "image",
    handler: "CacheFirst",
    options: {
      cacheName: "app-shell-images",
      expiration: {
        maxEntries: 200,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      },
      cacheableResponse: {
        statuses: [0, 200],
      },
    },
  },
  {
    urlPattern: ({ url }) =>
      [
        "tile.openstreetmap.org",
        "a.tile.openstreetmap.org",
        "b.tile.openstreetmap.org",
        "c.tile.openstreetmap.org",
      ].includes(url.hostname),
    handler: "CacheFirst",
    options: {
      cacheName: "chw-osm-tiles",
      expiration: {
        maxEntries: 300,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      },
      cacheableResponse: {
        statuses: [0, 200],
      },
    },
  },
]

const withPWA = withPWAInit({
  dest: "public",
  register: process.env.NODE_ENV !== "development",
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  fallbacks: {
    document: "/offline.html",
  },
  cacheOnFrontEndNav: true,
  runtimeCaching,
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "plus.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "source.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "www.edc-ent.com",
      },
      {
        protocol: "https",
        hostname: "www.unicef.org",
      },
      {
        protocol: "https",
        hostname: "jacarandahealth.org",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
}

export default withPWA(nextConfig)

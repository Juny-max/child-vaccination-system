import withPWAInit from "next-pwa"

const isDev = process.env.NODE_ENV === "development"

const APP_SHELL_ROUTES = [
  "/",
  "/auth/login",
  "/offline",
  "/chw/dashboard",
  "/chw/find-child",
  "/chw/register",
  "/chw/register-child",
]

const runtimeCaching = [
  {
    urlPattern: ({ request }) => request.mode === "navigate",
    handler: "StaleWhileRevalidate",
    options: {
      cacheName: "app-shell-pages",
      precacheFallback: {
        fallbackURL: "/offline",
      },
      expiration: {
        maxEntries: 64,
        maxAgeSeconds: 7 * 24 * 60 * 60,
      },
      cacheableResponse: {
        statuses: [0, 200],
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
  disable: isDev,
  register: true,
  skipWaiting: true,
  dynamicStartUrl: false,
  cacheOnFrontEndNav: true,
  additionalManifestEntries: APP_SHELL_ROUTES.map((url) => ({
    url,
    revision: null,
  })),
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

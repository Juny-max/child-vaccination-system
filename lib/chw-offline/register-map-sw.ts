export async function registerChwMapServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null
  }

  try {
    // The root app service worker already caches OSM tiles.
    // Registering a dedicated map worker at root scope can override app-wide offline handling.
    const registration = await navigator.serviceWorker.getRegistration('/')
    return registration || null
  } catch (error) {
    console.error('CHW map service worker registration failed', error)
    return null
  }
}

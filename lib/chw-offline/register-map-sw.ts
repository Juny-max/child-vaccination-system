export async function registerChwMapServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null
  }

  try {
    const registration = await navigator.serviceWorker.register('/chw-map-sw.js', {
      scope: '/',
    })
    return registration
  } catch (error) {
    console.error('CHW map service worker registration failed', error)
    return null
  }
}

const APP_CACHE_PREFIX = 'dashboard-financiero-'

function appScope(baseUrl) {
  return new URL(baseUrl, window.location.href).href
}

async function matchingRegistrations(scope) {
  if (!('serviceWorker' in navigator)) return []
  const registrations = await navigator.serviceWorker.getRegistrations()
  return registrations.filter((registration) => registration.scope === scope)
}

export async function resetAppCache(baseUrl = import.meta.env?.BASE_URL || './') {
  const scope = appScope(baseUrl)
  const prefix = `${APP_CACHE_PREFIX}${encodeURIComponent(new URL(scope).pathname)}-`
  const registrations = await matchingRegistrations(scope)
  await Promise.allSettled(registrations.map((registration) => registration.unregister()))
  if ('caches' in window) {
    const names = await caches.keys()
    await Promise.all(names
      .filter((name) => name.startsWith(prefix) || /^dashboard-financiero-v2-cache-v\d+$/.test(name))
      .map((name) => caches.delete(name)))
  }
}

export function initializeServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  const scope = appScope(import.meta.env.BASE_URL)
  if (import.meta.env.DEV) {
    // A worker left over from a preview must not intercept Vite/HMR requests.
    matchingRegistrations(scope)
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .catch((error) => console.warn('Could not remove development service worker:', error))
    return
  }
  const register = () => navigator.serviceWorker
    .register(new URL('sw.js', scope).href, { scope, updateViaCache: 'none' })
    .catch((error) => console.warn('PWA registration failed:', error))
  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register, { once: true })
}

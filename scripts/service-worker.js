const CACHE = '__CACHE_NAME__'
const APP_SHELL = ['__APP_SHELL__']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith('kakuro-zone-') && key !== CACHE).map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return
  event.respondWith(
    fetch(event.request)
      .then(async (response) => {
        if (response.ok) {
          const cache = await caches.open(CACHE)
          await cache.put(event.request, response.clone())
        }
        return response
      })
      .catch(async () => {
        const cache = await caches.open(CACHE)
        // Static build assets are identical even when a host varies CORS headers.
        const staticAsset = APP_SHELL.includes(new URL(event.request.url).pathname)
        return await cache.match(event.request, { ignoreVary: staticAsset }) ||
          (event.request.mode === 'navigate' && await cache.match('/')) ||
          Response.error()
      }),
  )
})

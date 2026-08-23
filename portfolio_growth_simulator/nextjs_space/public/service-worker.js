const CACHE_NAME = 'portfolio-simulator-shell-v7'
const CACHE_PREFIX = 'portfolio-simulator-'
const SHELL_ASSETS = [
  '/',
  '/loan',
  '/methodology',
  '/methodology/loan',
  '/privacy',
  '/manifest.json',
  '/favicon.png',
  '/favicon.svg',
  '/apple-touch-icon.png',
]

const STATIC_PREFIXES = ['/_next/static/', '/icons/', '/images/', '/fonts/']
const STATIC_FILE_PATTERN = /\.(?:css|js|mjs|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|otf)$/i
const STATIC_ROOT_FILES = new Set(['/manifest.json', '/favicon.png', '/favicon.svg', '/apple-touch-icon.png'])

function isStaticAsset(url) {
  return STATIC_ROOT_FILES.has(url.pathname)
    || STATIC_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))
    || STATIC_FILE_PATTERN.test(url.pathname)
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/') || url.searchParams.has('_rsc') || request.headers.get('RSC') === '1') return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(async () => (await caches.match(request)) || caches.match('/'))
    )
    return
  }

  if (!isStaticAsset(url)) return

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(() => cached)
      return cached || network
    })
  )
})

/**
 * Aiscern Service Worker v1
 *
 * Strategy per resource type:
 *   Shell (HTML pages)        → Network first, fall back to cache
 *   Static assets (_next/*)   → Cache first (they're content-addressed/immutable)
 *   API detection routes       → Network only (never cache AI results)
 *   Public images / logo       → Cache first, 7-day TTL
 *   Fonts (Google)             → Cache first, 30-day TTL
 */

const CACHE_VERSION   = 'aiscern-v1'
const STATIC_CACHE    = `${CACHE_VERSION}-static`
const IMAGE_CACHE     = `${CACHE_VERSION}-images`
const FONT_CACHE      = `${CACHE_VERSION}-fonts`
const ALL_CACHES      = [STATIC_CACHE, IMAGE_CACHE, FONT_CACHE]

// Pages to pre-cache on install (app shell)
const PRECACHE_URLS = [
  '/',
  '/offline',
  '/logo.png',
  '/favicon.ico',
  '/site.webmanifest',
]

// Never cache these — detection results must always be fresh
const NEVER_CACHE = [
  '/api/detect/',
  '/api/auth/',
  '/api/admin/',
  '/api/billing/',
  '/api/profiles/',
  '/api/chat',
  '/login',
  '/signup',
  '/dashboard',
]

// ── Install: pre-cache the app shell ─────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  )
})

// ── Activate: clean up old caches ────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k.startsWith('aiscern-') && !ALL_CACHES.includes(k))
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  )
})

// ── Fetch: route-based caching strategy ──────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests entirely
  if (request.method !== 'GET') return

  // Skip cross-origin requests we don't handle
  if (url.origin !== self.location.origin &&
      !url.href.includes('fonts.googleapis.com') &&
      !url.href.includes('fonts.gstatic.com')) return

  // ── NEVER CACHE: detection API, auth, user-specific ──────────────────────
  if (NEVER_CACHE.some(p => url.pathname.startsWith(p))) {
    event.respondWith(fetch(request))
    return
  }

  // ── CACHE FIRST: Next.js static chunks (content-addressed, immutable) ────
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  // ── CACHE FIRST: Fonts (long TTL, rarely change) ─────────────────────────
  if (url.href.includes('fonts.googleapis.com') ||
      url.href.includes('fonts.gstatic.com')) {
    event.respondWith(cacheFirst(request, FONT_CACHE, 30 * 24 * 60 * 60))
    return
  }

  // ── CACHE FIRST: Public images and logos ─────────────────────────────────
  if (url.pathname.match(/\.(png|jpg|jpeg|webp|avif|gif|svg|ico)$/) ||
      url.pathname.startsWith('/hero/') ||
      url.pathname.startsWith('/blog/')) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE, 7 * 24 * 60 * 60))
    return
  }

  // ── NETWORK FIRST: HTML pages (get latest, fall back to cache) ───────────
  if (request.headers.get('Accept')?.includes('text/html')) {
    event.respondWith(networkFirst(request, STATIC_CACHE))
    return
  }

  // ── NETWORK FIRST: Everything else ───────────────────────────────────────
  event.respondWith(networkFirst(request, STATIC_CACHE))
})

// ── Strategy implementations ──────────────────────────────────────────────────
async function cacheFirst(request, cacheName, maxAgeSecs = 365 * 24 * 60 * 60) {
  const cache    = await caches.open(cacheName)
  const cached   = await cache.match(request)

  if (cached) {
    // Check age — revalidate in background if stale
    const dateHeader = cached.headers.get('date')
    if (dateHeader) {
      const age = (Date.now() - new Date(dateHeader).getTime()) / 1000
      if (age > maxAgeSecs) {
        // Stale — revalidate in background
        fetch(request).then(r => { if (r.ok) cache.put(request, r) }).catch(() => {})
      }
    }
    return cached
  }

  const response = await fetch(request)
  if (response.ok) cache.put(request, response.clone())
  return response
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch {
    const cached = await cache.match(request)
    if (cached) return cached
    // Return the offline page for navigation requests
    if (request.headers.get('Accept')?.includes('text/html')) {
      const offline = await cache.match('/offline')
      if (offline) return offline
    }
    return new Response('Offline', { status: 503 })
  }
}

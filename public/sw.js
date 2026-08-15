/**
 * ManiCash Service Worker
 *
 * Chiến lược cache (đã sửa 2026-08-15):
 *   - /_next/static/, icon, ảnh, font, sound  → cache-first (tên file có hash
 *     nội dung nên KHÔNG bao giờ cũ: build mới = URL mới = tự nạp lại).
 *   - Mọi thứ còn lại (HTML, RSC payload `?_rsc=`, /_next/data/, API) →
 *     network-first, chỉ rơi về cache khi mất mạng.
 *
 * Vì sao: bản cũ cache-first MỌI request không phải `mode === 'navigate'`.
 * Điều hướng nội bộ của Next App Router là fetch RSC (`/overview?_rsc=...`,
 * KHÔNG phải navigate) → payload cũ nằm lại trong cache vĩnh viễn, nên sau khi
 * deploy bản mới người dùng vẫn thấy giao diện cũ cho tới khi xoá cache tay.
 */

const SW_VERSION = 'v2';
const CACHE_NAME = `manicash-${SW_VERSION}`;

// Vỏ ứng dụng pre-cache khi install (chỉ để mở được lúc offline)
const PRE_CACHE_URLS = [
  '/',
  '/overview',
  '/offline',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Luôn ra mạng, không bao giờ cache
const NETWORK_ONLY = ['/api/'];

/** Chỉ những đường dẫn này mới được cache-first (bất biến / đổi rất hiếm). */
function isImmutableAsset(url) {
  if (url.pathname.startsWith('/_next/static/')) return true;
  if (url.pathname.startsWith('/icons/')) return true;
  if (url.pathname.startsWith('/sounds/')) return true;
  if (url.pathname.startsWith('/emoji/')) return true;
  return /\.(png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf|mp3|wav|ogg)$/i.test(url.pathname);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Pre-cache vỏ ứng dụng; bỏ qua lỗi lẻ
      Promise.allSettled(PRE_CACHE_URLS.map((url) => cache.add(url)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Chỉ can thiệp GET cùng origin
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // API → mạng thuần, không cache
  if (NETWORK_ONLY.some((path) => url.pathname.startsWith(path))) {
    event.respondWith(fetch(request));
    return;
  }

  // Asset bất biến → cache-first
  if (isImmutableAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        });
      })
    );
    return;
  }

  // Còn lại (HTML, RSC `?_rsc=`, /_next/data/, ...) → network-first
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        // Chỉ trả trang offline cho điều hướng trang, không trả cho fetch dữ liệu
        if (request.mode === 'navigate') return caches.match('/offline');
        return Response.error();
      })
  );
});

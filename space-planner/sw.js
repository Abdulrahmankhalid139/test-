/* خدمة العامل — بتخلي التطبيق يفتح من غير نت.
   استدعاءات Gemini بتعدي على الشبكة عادي (مش بتتخزن). */
const CACHE = 'space-planner-v2';
const SHELL = [
  './', './index.html', './css/app.css', './icon.svg', './manifest.json',
  './js/app.js', './js/geometry.js', './js/packing.js', './js/desk.js',
  './js/render.js', './js/vision.js', './js/store.js', './js/profiles.js',
  './js/surface.js', './data/bags.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // أي حاجة برة الموقع (زي Gemini والخطوط) تعدي للشبكة على طول
  if (url.origin !== self.location.origin || e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});

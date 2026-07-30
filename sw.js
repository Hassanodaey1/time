/* ================================================================
   Service Worker: يخزّن "هيكل التطبيق" (الصفحات وملفات الجافاسكربت المحلية)
   حتى تفتح الصفحات وتشتغل الأجزاء المحلية (مؤقت الطالب، تذكير الماء...) بدون إنترنت.
   لا يتدخل أبداً بطلبات فايربيس أو الخطوط الخارجية — تلك تُترك تمر بشكل طبيعي،
   فإذا ما كان هناك إنترنت، تفشل بمفردها والصفحة تتعامل مع ذلك (رسالة توضيحية).
   ================================================================ */
/* رقم الإصدار: لازم يترفع (v3, v4, ...) كل مرة تتحدث فيها أي صفحة أو ملف مذكور بـ APP_SHELL،
   وإلا المستخدمين اللي مثبتين التطبيق راح يضلوا شغالين بنسخة قديمة مخزّنة أوفلاين. */
const CACHE_NAME = "timers-app-shell-v3";
const APP_SHELL = [
  "./",
  "./index.html",
  "./student-timer.html",
  "./display.html",
  "./challenge-timer.html",
  "./study-challenge.html",
  "./admin.html",
  "./manifest.json",
  "./favicon.svg",
  "./apple-touch-icon.png",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-192.png",
  "./icon-maskable-512.png",
  "./timer-sounds.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => {}) // لا نمنع التثبيت حتى لو تعذّر تخزين كل الملفات
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // فقط ملفات نفس الموقع (هيكل التطبيق). أي طلب خارجي (فايربيس، الخطوط...) نتركه يمر طبيعياً.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});

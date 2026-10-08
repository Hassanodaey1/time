/* ================================================================
   Service Worker: يخزّن "هيكل التطبيق" (الصفحات وملفات الجافاسكربت المحلية)
   حتى تفتح الصفحات وتشتغل الأجزاء المحلية (مؤقت الطالب، تذكير الماء...) بدون إنترنت.
   لا يتدخل أبداً بطلبات فايربيس أو الخطوط الخارجية — تلك تُترك تمر بشكل طبيعي،
   فإذا ما كان هناك إنترنت، تفشل بمفردها والصفحة تتعامل مع ذلك (رسالة توضيحية).
   ================================================================ */
/* رقم الإصدار: لازم يترفع (v3, v4, ...) كل مرة تتحدث فيها أي صفحة أو ملف مذكور بـ APP_SHELL،
   وإلا المستخدمين اللي مثبتين التطبيق راح يضلوا شغالين بنسخة قديمة مخزّنة أوفلاين. */
const CACHE_NAME = "timers-app-shell-v17";
const APP_SHELL = [
  "./",
  "./index.html",
  "./student-timer.html",
  "./display.html",
  "./challenge-timer.html",
  "./study-challenge.html",
  "./admin.html",
  "./manifest.json",
  "./theme.css",
  "./nav-lock.js",
  "./tg-fix.js",
  "./favicon.svg",
  "./apple-touch-icon.png",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-192.png",
  "./icon-maskable-512.png",
  "./timer-sounds.js",
  "./notifications.js",
  "./time-bank.js"
];

self.addEventListener("install", (event) => {
  /* نخزّن كل ملف على حدة: لو ملف واحد غير موجود (مثلاً أيقونة) لا يفشل تخزين بقية الملفات.
     (cache.addAll كان يفشل كله إذا ملف واحد فقط رجع 404.) */
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(APP_SHELL.map((url) => cache.add(url)))
    ).catch(() => {})
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
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)).catch(() => {});
          }
          return res;
        })
        .catch(() => {
          if (cached) return cached;
          // بلا إنترنت وبلا نسخة محفوظة: للتنقل نرجّع الصفحة الرئيسية بدل صفحة خطأ المتصفح
          if (req.mode === "navigate") return caches.match("./index.html").then((r) => r || Response.error());
          return Response.error();
        });
      // لو عندنا نسخة محفوظة نعرضها فورًا ونكمل تحديثها بالخلفية (ونمنع إيقاف الـ SW قبل ما ينتهي التحديث)
      if (cached) event.waitUntil(networkFetch.catch(() => {}));
      return cached || networkFetch;
    })
  );
});


/* ================= الإشعارات (Push) =================
   تصل من FCM حتى والتطبيق مغلق. إذا كان التطبيق مفتوحًا وظاهرًا نمرّرها للصفحة
   لتعرضها داخليًا مع صوت بدل شريط الإشعارات. */
self.addEventListener("push", (event) => {
  let p = {};
  try { p = event.data ? event.data.json() : {}; }
  catch (e) { try { p = { data: { body: event.data.text() } }; } catch (e2) {} }
  const d = Object.assign({}, p.notification || {}, p.data || (p.title || p.body ? p : {}));
  const title = d.title || "مركز المؤقتات";
  const body = d.body || "";
  const url = d.url || "./index.html";
  const kind = d.type || "general";

  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const visible = wins.filter((c) => c.visibilityState === "visible");
    if (visible.length) {
      visible.forEach((c) => c.postMessage({ type: "nf-foreground", title, body, url, kind }));
      return;
    }
    await self.registration.showNotification(title, {
      body,
      icon: "icon-192.png",
      badge: "icon-192.png",
      tag: d.tag || kind,
      renotify: true,
      dir: "rtl",
      lang: "ar",
      vibrate: [140, 70, 140],
      data: { url }
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "./index.html", self.registration.scope).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of wins) {
      if (c.url === target && "focus" in c) return c.focus();
    }
    if (wins.length && "navigate" in wins[0]) {
      try { await wins[0].focus(); return await wins[0].navigate(target); } catch (e) {}
    }
    return self.clients.openWindow(target);
  })());
});

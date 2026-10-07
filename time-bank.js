/* ================================================================
   time-bank.js — احتساب وقت الدراسة لمستوى الطالب من كل المؤقتات
   ----------------------------------------------------------------
   المبدأ: مؤقت الطالب + تحدي الأستاذ + تحدي الدراسة كلها تودع وقتها في "رصيد واحد"
   عبر نفس الـ Worker (study-bank /bank)، والمستوى يُحسب من هذا الرصيد (totalSeconds).
   الحماية من الغش عند تشغيل أكثر من مؤقت:
     1) قفل على مستوى الجهاز: مؤقت واحد فقط (تبويب واحد) يحتسب الوقت في نفس اللحظة.
     2) لا يُحتسب إلا الوقت الحي: المؤقت شغّال وغير موقوف والصفحة ظاهرة أمام الطالب.
     3) الحكم النهائي للسيرفر: الحد اليومي والتحقق من الوقت الحقيقي في الـ Worker يشملان كل المصادر
        لأنها كلها تمر من نفس /bank (وهذا يغطي أيضًا من يفتح مؤقتين على جهازين).
   ================================================================ */
(function(){
  "use strict";
  const WORKER_URL   = "https://study-bank.hassan1odaey.workers.dev";
  const PROFILE_KEY  = "studyChallengeProfile";
  const LOCK_KEY     = "tb_lock_v1";
  const LOCK_TTL_MS  = 3500;     // القفل ينتهي تلقائيًا لو صاحبه توقف (إغلاق تبويب مثلًا)
  const BANK_EVERY   = 60;       // نودع كل 60 ثانية (نفس إيقاع تحدي الدراسة)
  const MAX_TICK_MS  = 2500;     // أي فجوة أطول (نوم الجهاز/تجمّد المتصفح) لا تُحتسب
  const TAB_ID = Math.random().toString(36).slice(2) + Date.now().toString(36);

  let predicate = null, ticker = null, lastTs = 0;
  let pending = 0, flushing = false, wasCounting = false;
  let authHooked = false, capDay = null, capHours = 6;
  let lastLockNoticeTs = 0, noProfileNoticed = false;

  const dayIndex = () => Math.floor((Date.now() + 3 * 3600 * 1000) / 86400000); // يوم بتوقيت بغداد

  /* ---------- إشعار صغير بتصميم اللعبة (لا يعتمد على أي صفحة) ---------- */
  let toastEl = null, toastTimer = null;
  function notice(text){
    try{
      if (!toastEl){
        toastEl = document.createElement("div");
        toastEl.setAttribute("role", "status");
        toastEl.style.cssText =
          "position:fixed;left:50%;transform:translateX(-50%);z-index:99999;max-width:min(92vw,420px);" +
          "bottom:calc(16px + env(safe-area-inset-bottom,0px));padding:12px 16px;border-radius:14px;" +
          "background:var(--panel,#131316);color:#fff;border:1px solid var(--border,#26262d);" +
          "border-inline-start:3px solid #ffb400;box-shadow:0 8px 28px rgba(0,0,0,.55);" +
          "font-weight:600;font-size:14px;line-height:1.7;text-align:center;display:none;pointer-events:none;";
        document.body.appendChild(toastEl);
      }
      toastEl.textContent = text;
      toastEl.style.display = "block";
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { if (toastEl) toastEl.style.display = "none"; }, 7000);
    }catch(e){}
  }

  /* ---------- قفل الجهاز: مؤقت واحد فقط يحتسب ---------- */
  function readLock(){
    try{ return JSON.parse(localStorage.getItem(LOCK_KEY) || "null"); }catch(e){ return null; }
  }
  function claim(){
    const now = Date.now(), l = readLock();
    if (l && l.id !== TAB_ID && (now - l.ts) < LOCK_TTL_MS){
      if (now - lastLockNoticeTs > 30000){
        lastLockNoticeTs = now;
        notice("⏳ يوجد مؤقت آخر مفتوح يحتسب وقتك الآن — وقت المؤقتات لا يُحتسب بالتوازي.");
      }
      return false;
    }
    try{ localStorage.setItem(LOCK_KEY, JSON.stringify({ id: TAB_ID, ts: now })); }catch(e){}
    return true;
  }
  function release(){
    const l = readLock();
    if (l && l.id === TAB_ID){ try{ localStorage.removeItem(LOCK_KEY); }catch(e){} }
  }

  /* ---------- الهوية والاتصال بالـ Worker ---------- */
  function fbReady(){
    return typeof firebase !== "undefined" && firebase.apps && firebase.apps.length && typeof firebase.auth === "function";
  }
  function hookAuth(){
    if (authHooked || !fbReady()) return;
    authHooked = true;
    /* نفس الهوية المحفوظة من الصفحة الرئيسية (مجهول أو جوجل)؛ ندخل مجهولًا فقط إن لم توجد هوية */
    firebase.auth().onAuthStateChanged((u) => {
      if (!u) firebase.auth().signInAnonymously().catch(() => {});
    });
  }
  function hasProfile(){
    try{ return !!localStorage.getItem(PROFILE_KEY); }catch(e){ return false; }
  }
  async function callWorker(path, body){
    if (!fbReady()) throw new Error("firebase-not-ready");
    const user = firebase.auth().currentUser;
    if (!user) throw new Error("no-user");
    const token = await user.getIdToken();
    const res = await fetch(WORKER_URL + path, {
      method: "POST", keepalive: true,
      headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    });
    let data = {};
    try{ data = await res.json(); }catch(e){}
    if (!res.ok){
      const err = new Error((data && data.error) || ("http-" + res.status));
      err.code = (data && data.error) || ("http-" + res.status);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  /* ---------- الإيداع ---------- */
  async function flush(){
    if (flushing) return;
    const secs = Math.min(Math.floor(pending), BANK_EVERY);
    if (secs < 1) return;
    pending -= secs;
    flushing = true;
    try{
      const data = await callWorker("/bank", { seconds: secs });
      if (data.capSeconds > 0) capHours = data.capSeconds / 3600;
      if (data.capReached){
        capDay = dayIndex();
        const h = Number.isInteger(capHours) ? String(capHours) : capHours.toFixed(1);
        notice("🚫 وصلت للحد الأقصى اليومي (" + h + " ساعات) لكل المؤقتات معًا. رجعلك باچر 💪");
      } else if (data.committed && data.freezeConsumed){
        notice("🧊 فاتك يوم أمس، بس حماية السلسلة حفظت سلسلتك — استمر!");
      }
    }catch(err){
      if (!err || !err.status){
        /* لا اتصال / لا هوية بعد: لم يصل الطلب غالبًا، نُرجع الثواني لتُرسل لاحقًا (بسقف صغير) */
        pending = Math.min(pending + secs, BANK_EVERY * 2);
      } else if (err.status === 412){
        if (!noProfileNoticed){
          noProfileNoticed = true;
          notice("⚠️ احفظ بياناتك الشخصية من الصفحة الرئيسية ليُحتسب وقتك في مستواك.");
        }
      } else {
        console.error("TimeBank flush failed:", err);
      }
    }finally{
      flushing = false;
    }
  }

  /* ---------- المؤقت الداخلي: يسأل الصفحة كل ثانية "هل المؤقت يعمل الآن؟" ---------- */
  function tick(){
    hookAuth();
    const now = Date.now();
    let dt = now - lastTs; lastTs = now;
    if (dt < 0 || dt > MAX_TICK_MS) dt = 0;

    let counting = false;
    try{ counting = !!predicate && !!predicate(); }catch(e){}

    if (counting && document.visibilityState !== "visible") counting = false;
    if (counting && capDay === dayIndex()) counting = false;     // بلغ الحد اليومي اليوم
    if (counting && !hasProfile()){
      counting = false;
      if (!noProfileNoticed){
        noProfileNoticed = true;
        notice("ℹ️ سجّل ملفك الشخصي من الصفحة الرئيسية ليُحتسب وقت دراستك في مستواك.");
      }
    }
    if (counting && !claim()) counting = false;                   // مؤقت آخر يحتسب الآن

    if (counting){
      pending += dt / 1000;
      wasCounting = true;
    } else if (wasCounting){
      wasCounting = false;
      release();
      flush();
    }
    if (pending >= BANK_EVERY) flush();
  }

  function track(sourceName, isRunningFn){
    predicate = isRunningFn;
    lastTs = Date.now();
    if (ticker) clearInterval(ticker);
    ticker = setInterval(tick, 1000);
  }

  /* عند مغادرة الصفحة/إخفائها: نودع ما تجمّع ونتخلّى عن القفل ليأخذه مؤقت آخر ظاهر */
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden"){ wasCounting = false; release(); flush(); }
  });
  window.addEventListener("pagehide", () => { release(); flush(); });

  window.TimeBank = { track, claim, release, flush, notice };
})();

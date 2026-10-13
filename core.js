/* ================================================================
   core.js — دوال مشتركة كانت منسوخة حرفيًا داخل عدة صفحات (مركز المؤقتات)
   ----------------------------------------------------------------
   • makeOfflineDbStub()   بديل قاعدة بيانات فارغ عند تعذّر تحميل فايربيس (admin / challenge-timer / display / study-challenge)
   • serverTimestampValue() ختم وقت السيرفر، أو وقت الجهاز عند عدم توفر فايربيس (index / study-challenge)
   • getProfile()           الملف الشخصي المحفوظ بالجهاز (index / study-challenge)
   تعريفات فقط، لا تنفّذ شيئًا عند التحميل. تُحمَّل بعد ui.js وقبل سكربتات الصفحة.
   serverTimestampValue تقرأ المتغير العام firebaseOK المعرَّف داخل كل صفحة عند الاستدعاء.
   ================================================================ */
function makeOfflineDbStub(){
  const chain = {
    on(){ return chain; }, off(){ return chain; },
    once(){ return Promise.resolve({ val: () => null }); },
    update(){ return Promise.resolve(); }, set(){ return Promise.resolve(); },
    orderByChild(){ return chain; }, limitToLast(){ return chain; }, startAt(){ return chain; }
  };
  return { ref(){ return chain; } };
}

function serverTimestampValue(){
  try{
    if (typeof firebaseOK !== "undefined" && firebaseOK && typeof firebase !== "undefined" && firebase.database && firebase.database.ServerValue){
      return firebase.database.ServerValue.TIMESTAMP;
    }
  }catch(e){}
  return Date.now();
}

function getProfile(){
  try{
    const raw = localStorage.getItem("studyChallengeProfile");
    return raw ? JSON.parse(raw) : null;
  }catch(e){ return null; }
}

/* ---------------- أدوات مشتركة بين صفحات المؤقتات ---------------- */
/* رقمان على الأقل (05) — كانت معرَّفة بنفس الشكل في 4 صفحات */
const pad = (n) => String(Math.max(0, n)).padStart(2, "0");

/* تحديث رقم في شاشة المؤقت مع أنيميشن القلب لنمط flipclock */
function setDigit(el, val){
  if (el.innerText !== val){
    el.innerText = val;
    if (document.body.getAttribute("data-style") === "flipclock"){
      el.classList.remove("flip-anim");
      void el.offsetWidth; /* إعادة تشغيل الأنيميشن */
      el.classList.add("flip-anim");
    }
  }
}

/* mm:ss أو hh:mm:ss. (display.html تستخدم formatDurationDays الخاصة بها لأنها تضيف الأيام للتحديات الطويلة) */
function formatDuration(ms){
  ms = Math.max(0, ms);
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(minutes)}:${pad(seconds)}`;
}

/* إبقاء الشاشة مضيئة. تحفظ القفل في المتغير العام wakeLock الذي تعرّفه كل صفحة (let wakeLock = null) */
async function requestWakeLock(){
  try{
    if ("wakeLock" in navigator){
      wakeLock = await navigator.wakeLock.request("screen");
    }
  }catch(e){ /* غير مدعوم، تجاهل بصمت */ }
}

/* ---------------- الاتصال بالـ Worker (study-bank) ----------------
   مصدر واحد لعنوان الـ Worker ولطلبات POST الموثّقة بتوكن فايربيس (index / study-challenge / time-bank.js).
   opts.keepalive = true يُبقي الطلب يكتمل حتى لو أُغلقت الصفحة (يستخدمه بنك الوقت). */
const HO_WORKER_URL = "https://study-bank.hassan1odaey.workers.dev";
async function callWorker(path, body, opts){
  if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length || typeof firebase.auth !== "function") throw new Error("firebase-not-ready");
  const user = firebase.auth().currentUser;
  if (!user) throw new Error("no-user");
  const token = await user.getIdToken();
  const init = {
    method: "POST",
    headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(body || {})
  };
  if (opts && opts.keepalive) init.keepalive = true;
  const res = await fetch(HO_WORKER_URL + path, init);
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

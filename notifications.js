/* ================================================================
   notifications.js — الإشعارات (تعمل في index.html)
   - تسجيل جهاز الطالب في FCM وحفظ التوكن في pushTokens/{uid}
   - شاشة الإعدادات وحفظ التفضيلات في pushPrefs/{uid}
   - عرض الإشعار داخل التطبيق (مع صوت) إذا كان مفتوحًا
   الإرسال الفعلي من الـ Worker (Cron) وليس من هنا.
   ================================================================ */
const VAPID_PUBLIC_KEY = "BOz62JCbN-rPJ7mqVPfOoBXzqMABz4vr2-EnXt2FC7WSFWaRnnrlgIlYqBvNd4P8LyZmg2OaGvi8pgEqw3DADRI";   // Firebase Console > Project settings > Cloud Messaging > Web Push certificates

const NF_DEFAULTS = {
  on: false, streak: true, daily: true, dailyTime: "18:00", overtaken: true,
  achievements: true, weekly: true, comeback: true, news: true, quiet: true
};
const NF_TOGGLES = ["streak", "daily", "overtaken", "achievements", "weekly", "comeback", "news", "quiet"];
let nfPrefs = null;
let nfPrefsUid = null;
let nfBusy = false;

/* المعرّف الحيّ الحالي: authReady يُحلّ مرة واحدة فقط (بأول معرّف)، فلو بدّل الطالب حسابه يبقى فيه المعرّف القديم.
   لذلك نقرأ دائمًا من المستخدم الحالي في فايربيس. */
async function nfUid(){
  const first = await authReady;
  const u = firebase.auth().currentUser;
  return (u && u.uid) || first;
}
function nfSupported(){
  try{
    return ("Notification" in window) && ("serviceWorker" in navigator) && ("PushManager" in window) &&
      typeof firebase !== "undefined" && !!firebase.messaging && firebase.messaging.isSupported();
  }catch(e){ return false; }
}
function nfHash(s){
  let a = 5381, b = 0;
  for (let i = 0; i < s.length; i++){ a = ((a * 33) ^ s.charCodeAt(i)) >>> 0; b = (Math.imul(b, 31) + s.charCodeAt(i)) >>> 0; }
  return a.toString(36) + b.toString(36);
}
function nfToast(title, body, url){
  const t = document.createElement("div");
  t.className = "nf-toast";
  t.innerHTML = '<b></b><span></span>';
  t.firstChild.textContent = title || "";
  t.lastChild.textContent = body || "";
  if (url) t.onclick = () => { location.href = url; };
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 400); }, 5200);
}

async function nfLoadPrefs(){
  const uid = await nfUid();
  if (nfPrefs && nfPrefsUid === uid) return nfPrefs;
  let saved = {};
  try{ saved = (await db.ref("pushPrefs/" + uid).once("value")).val() || {}; }catch(e){}
  nfPrefs = Object.assign({}, NF_DEFAULTS, saved);
  nfPrefsUid = uid;
  return nfPrefs;
}
async function nfSavePrefs(){
  const uid = await nfUid();
  const out = { on: !!nfPrefs.on, dailyTime: /^([01]\d|2[0-3]):[0-5]\d$/.test(nfPrefs.dailyTime) ? nfPrefs.dailyTime : "18:00" };
  NF_TOGGLES.forEach(k => { out[k] = !!nfPrefs[k]; });
  await db.ref("pushPrefs/" + uid).set(out);
}
async function nfRegisterToken(){
  const reg = await navigator.serviceWorker.ready;
  const token = await firebase.messaging().getToken({ vapidKey: VAPID_PUBLIC_KEY, serviceWorkerRegistration: reg });
  if (!token) throw new Error("no-token");
  const uid = await nfUid();
  const tid = nfHash(token);
  await db.ref("pushTokens/" + uid + "/" + tid).set({ t: token, at: firebase.database.ServerValue.TIMESTAMP });
  try{ localStorage.setItem("nf_tid", tid); }catch(e){}
}
async function nfEnable(){
  if (!nfSupported()) throw new Error("unsupported");
  if (VAPID_PUBLIC_KEY.indexOf("PUT_") === 0) throw new Error("no-vapid");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error(perm === "denied" ? "denied" : "dismissed");
  await nfRegisterToken();
  nfPrefs.on = true;
  await nfSavePrefs();
}
async function nfDisable(){
  const uid = await nfUid();
  try{ await firebase.messaging().deleteToken(); }catch(e){}
  let tid = null; try{ tid = localStorage.getItem("nf_tid"); }catch(e){}
  if (tid){ try{ await db.ref("pushTokens/" + uid + "/" + tid).remove(); }catch(e){} }
  nfPrefs.on = false;
  await nfSavePrefs();
}

function nfErrText(code){
  return ({
    "unsupported": "هذا المتصفح أو الجهاز لا يدعم الإشعارات.",
    "no-vapid": "لم يكتمل إعداد الإشعارات بعد (مفتاح VAPID ناقص في notifications.js).",
    "denied": "الإشعارات محجوبة. فعّلها من إعدادات التطبيق/المتصفح ثم أعد المحاولة.",
    "dismissed": "لم تمنح الإذن. اضغط تفعيل مرة أخرى واختر «سماح».",
    "no-token": "تعذّر تسجيل الجهاز، حاول مجددًا.",
    "slow-down": "انتظر لحظات قبل إرسال إشعار تجريبي آخر."
  })[code] || "حدث خطأ، تأكد من الإنترنت وحاول مجددًا.";
}
function nfShowError(text){
  const el = document.getElementById("nfError");
  if (!el) return;
  el.textContent = text || "";
  el.style.display = text ? "block" : "none";
}

function nfRender(){
  if (!nfPrefs) return;
  const supported = nfSupported();
  const perm = supported ? Notification.permission : "denied";
  const on = nfPrefs.on && perm === "granted";
  const status = document.getElementById("nfStatus");
  const btn = document.getElementById("nfMainBtn");
  const list = document.getElementById("nfList");
  if (status){
    status.className = "nf-status " + (on ? "on" : "off");
    status.textContent = !supported ? "غير مدعومة على هذا الجهاز"
      : perm === "denied" ? "محجوبة من إعدادات الجهاز"
      : on ? "مفعّلة على هذا الجهاز" : "متوقفة";
  }
  if (btn){
    btn.disabled = !supported || perm === "denied";
    btn.textContent = on ? "إيقاف الإشعارات على هذا الجهاز" : "تفعيل الإشعارات";
    btn.classList.toggle("danger", on);
  }
  if (list) list.style.display = on ? "block" : "none";
  NF_TOGGLES.forEach(k => {
    const sw = document.getElementById("nfSw_" + k);
    if (!sw) return;
    sw.classList.toggle("active", !!nfPrefs[k]);
    sw.setAttribute("aria-checked", nfPrefs[k] ? "true" : "false");
  });
  const t = document.getElementById("nfDailyTime");
  if (t) t.value = nfPrefs.dailyTime;
  const tr = document.getElementById("nfTimeRow");
  if (tr) tr.style.display = nfPrefs.daily ? "flex" : "none";
}

window.openNotifSettings = async function(){
  document.getElementById("nfOverlay").classList.add("show");
  nfShowError("");
  await nfLoadPrefs();
  nfRender();
};
window.closeNotifSettings = function(){ document.getElementById("nfOverlay").classList.remove("show"); };

window.nfMainAction = async function(){
  if (nfBusy || !nfPrefs) return;
  nfBusy = true; nfShowError("");
  const btn = document.getElementById("nfMainBtn");
  if (btn) btn.disabled = true;
  try{
    if (nfPrefs.on && Notification.permission === "granted") await nfDisable();
    else await nfEnable();
  }catch(e){ nfShowError(nfErrText(e && (e.code || e.message))); }
  nfBusy = false;
  nfRender();
};
window.nfToggle = async function(key){
  if (!nfPrefs) return;
  nfPrefs[key] = !nfPrefs[key];
  nfRender();
  try{ await nfSavePrefs(); }catch(e){ nfShowError(nfErrText("")); }
};
window.nfSetTime = async function(v){
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) return;
  nfPrefs.dailyTime = v;
  try{ await nfSavePrefs(); }catch(e){ nfShowError(nfErrText("")); }
};
window.nfSendTest = async function(){
  nfShowError("");
  try{
    const r = await callWorker("/push/test", {});
    if (!r.sent) nfShowError("لم يصل إشعار. تأكد أن الإشعارات مفعّلة على هذا الجهاز ثم جرّب مجددًا.");
  }catch(e){ nfShowError(nfErrText(e && e.code)); }
};

/* إشعار وصل والتطبيق مفتوح: الـ SW يمرّره لنا بدل إظهاره في شريط الإشعارات */
if ("serviceWorker" in navigator){
  navigator.serviceWorker.addEventListener("message", (e) => {
    const m = e.data;
    if (!m || m.type !== "nf-foreground") return;
    nfToast(m.title, m.body, m.url);
    try{
      const kind = ({ level: "levelup", badge: "badge", streak: "streak", overtaken: "overtaken" })[m.kind] || "notify";
      if (window.playTimerAlert) window.playTimerAlert(kind);
    }catch(err){}
  });
}

/* تجديد التوكن عند كل فتح للتطبيق (التوكن قد يتغير) */
async function nfRefreshToken(){
  try{
    if (!nfSupported() || Notification.permission !== "granted") return;
    const p = await nfLoadPrefs();
    if (p.on && VAPID_PUBLIC_KEY.indexOf("PUT_") !== 0) await nfRegisterToken();
  }catch(e){}
}
authReady.then(nfRefreshToken);

/* تبديل الحساب (Google): نُعيد تحميل تفضيلات الحساب الجديد ونسجّل هذا الجهاز تحته */
window.nfOnAccountChange = function(){
  nfPrefs = null; nfPrefsUid = null;
  nfRefreshToken();
};

/* قبل تسجيل الخروج: نفصل هذا الجهاز عن الحساب حتى لا تستمر إشعاراته بالوصول لشخص خرج منه */
window.nfDetachDevice = async function(){
  try{
    if (!nfSupported()) return;
    const uid = await nfUid();
    let tid = null; try{ tid = localStorage.getItem("nf_tid"); }catch(e){}
    if (tid){ try{ await db.ref("pushTokens/" + uid + "/" + tid).remove(); }catch(e){} }
    try{ await firebase.messaging().deleteToken(); }catch(e){}
    try{ localStorage.removeItem("nf_tid"); }catch(e){}
  }catch(e){}
};

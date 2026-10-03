// أصوات المؤقتات - Web Audio API، بدون ملفات صوت خارجية
//
// ملاحظتين مهمتين عن هذا التعديل:
// 1) الدقة: التوقيت الآن مجدوَل مباشرة على ساعة السياق الصوتي (AudioContext.currentTime)
//    بدل سلسلة setTimeout متتالية. هذا أدق فعليًا لأن setTimeout يتأخر بشكل متراكم
//    (خصوصًا إذا الصفحة مصغّرة أو الجهاز مشغول)، بينما جدولة Web Audio ثابتة الدقة.
// 2) الجمالية: كل نغمة الآن لها "مغلّف صوتي" (attack/release) بدل قطع الصوت فجأة —
//    هذا يمنع صوت "الطقطقة" المزعج ويخلي النغمة ناعمة أشبه بجرس هادئ.

// سياق صوتي واحد مشترك (بدل إنشاء AudioContext جديد مع كل نغمة، وهو مكلف ويسبب تقطيع)
let _audioCtx = null;
function _getCtx(){
  if (!_audioCtx){
    try{ _audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch(e){ return null; }
  }
  if (_audioCtx.state !== "running"){ try{ _audioCtx.resume().catch(() => {}); }catch(e){} }
  return _audioCtx;
}

// المتصفحات (خصوصًا iOS/Chrome) تمنع الصوت حتى يلمس المستخدم الصفحة مرة واحدة على الأقل.
// نفتح السياق الصوتي عند أول لمسة/ضغطة، حتى تشتغل تنبيهات النهاية لاحقًا بدون مشاكل.
function _unlockAudio(){
  const ctx = _getCtx();
  if (ctx){
    try{
      const b = ctx.createBuffer(1, 1, 22050);
      const s = ctx.createBufferSource();
      s.buffer = b; s.connect(ctx.destination); s.start(0);
    }catch(e){}
  }
  ["pointerdown", "touchstart", "keydown", "click"].forEach(ev => window.removeEventListener(ev, _unlockAudio, true));
}
["pointerdown", "touchstart", "keydown", "click"].forEach(ev => window.addEventListener(ev, _unlockAudio, { capture: true, passive: true }));
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && _audioCtx && _audioCtx.state !== "running"){ _audioCtx.resume().catch(() => {}); }
});

// وضع التركيز العميق (يُفعَّل من الصفحة الرئيسية ويُحفظ بالجهاز): يوقف الأصوات غير الضرورية
// ويُضيف الصنف deep-focus على body لتبسيط واجهة المؤقتات.
window.isDeepFocus = function(){
  try{ return localStorage.getItem("deep_focus_mode") === "1"; }catch(e){ return false; }
};
const _QUIET_KINDS = { mid: 1, start: 1, lastMinute: 1, notify: 1, streak: 1, overtaken: 1, levelup: 1, badge: 1 };
function _applyFocusClass(){
  if (document.body) document.body.classList.toggle("deep-focus", window.isDeepFocus());
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", _applyFocusClass);
else _applyFocusClass();
window.addEventListener("storage", (e) => { if (e.key === "deep_focus_mode") _applyFocusClass(); });

// إشعار محلي يعمل على أندرويد أيضًا (المُنشئ new Notification غير مسموح هناك، فنستخدم الـ Service Worker)
window.showLocalNotification = function(title, body, tag){
  try{
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const opts = { body: body || "", icon: "icon-192.png", badge: "icon-192.png", dir: "rtl", lang: "ar" };
    if (tag) opts.tag = tag;
    const fallback = () => { try{ new Notification(title, opts); }catch(e){} };
    if ("serviceWorker" in navigator){
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg && reg.showNotification) return reg.showNotification(title, opts);
        fallback();
      }).catch(fallback);
    } else fallback();
  }catch(e){}
};

// نغمة واحدة ناعمة: صعود سريع للصوت ثم هبوط تدريجي، بدل بداية/نهاية حادة
function _tone(ctx, freq, startAt, duration, peakVolume){
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, startAt);

  const attack = 0.015;
  const release = Math.min(0.14, duration * 0.5);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(peakVolume, startAt + attack);
  gain.gain.setValueAtTime(peakVolume, Math.max(startAt + attack, startAt + duration - release));
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.03);
}

// تشغيل تسلسل نغمات مجدول بدقة بدل setTimeout المتراكم الخطأ
function _playSequence(notes){
  const ctx = _getCtx();
  if (!ctx) return;
  const go = () => {
    const base = ctx.currentTime + 0.02;
    notes.forEach(n => _tone(ctx, n.freq, base + n.delay, n.duration, n.volume || 0.15));
  };
  if (ctx.state === "running"){ go(); return; }
  // السياق ما زال موقوفًا (لم يلمس المستخدم الصفحة بعد): نحاول فتحه، وإن لم ينجح خلال نصف ثانية نتجاهل
  // التنبيه بدل أن يُعزف متأخرًا في وقت عشوائي.
  let done = false;
  const t = setTimeout(() => { done = true; }, 500);
  ctx.resume().then(() => { clearTimeout(t); if (!done && ctx.state === "running") go(); }).catch(() => {});
}

// أنماط تنبيه مميزة لكل حالة — نغمات موسيقية متناغمة (مقام بسيط) بدل نغمة واحدة حادة متكررة
window.playTimerAlert = function(kind){
  if (_QUIET_KINDS[kind] && window.isDeepFocus()) return; // وضع التركيز العميق: فقط نغمة النهاية
  if (kind === "mid"){
    // E5 مرتين بلطف — تذكير خفيف بمنتصف الوقت
    _playSequence([
      { freq: 659.25, delay: 0,    duration: 0.16 },
      { freq: 659.25, delay: 0.24, duration: 0.16 }
    ]);
  } else if (kind === "lastMinute"){
    // G5, G5, A5 — إلحاح لطيف بدون إزعاج
    _playSequence([
      { freq: 783.99, delay: 0,    duration: 0.14 },
      { freq: 783.99, delay: 0.2,  duration: 0.14 },
      { freq: 880.00, delay: 0.4,  duration: 0.2  }
    ]);
  } else if (kind === "finish"){
    // C5 - E5 - G5 — ثلاثية صاعدة مبهجة عند الانتهاء
    _playSequence([
      { freq: 523.25, delay: 0,    duration: 0.18 },
      { freq: 659.25, delay: 0.19, duration: 0.18 },
      { freq: 783.99, delay: 0.38, duration: 0.42 }
    ]);
  } else if (kind === "notify"){
    // نغمتان ناعمتان: وصول إشعار والتطبيق مفتوح
    _playSequence([
      { freq: 880.00, delay: 0,    duration: 0.12, volume: 0.12 },
      { freq: 1174.66, delay: 0.14, duration: 0.2, volume: 0.12 }
    ]);
  } else if (kind === "levelup"){
    // C5 E5 G5 C6 — صعود احتفالي عند مستوى جديد
    _playSequence([
      { freq: 523.25, delay: 0,    duration: 0.14 },
      { freq: 659.25, delay: 0.14, duration: 0.14 },
      { freq: 783.99, delay: 0.28, duration: 0.14 },
      { freq: 1046.50, delay: 0.42, duration: 0.5 }
    ]);
  } else if (kind === "badge"){
    // نغمة لامعة قصيرة لشارة جديدة
    _playSequence([
      { freq: 783.99, delay: 0,    duration: 0.12 },
      { freq: 987.77, delay: 0.13, duration: 0.12 },
      { freq: 1318.51, delay: 0.26, duration: 0.4 }
    ]);
  } else if (kind === "streak"){
    // نغمة دافئة هابطة-صاعدة للسلسلة
    _playSequence([
      { freq: 440.00, delay: 0,    duration: 0.14 },
      { freq: 554.37, delay: 0.15, duration: 0.14 },
      { freq: 659.25, delay: 0.30, duration: 0.35 }
    ]);
  } else if (kind === "overtaken"){
    // نغمتان تنبيهيتان (هابطة) عند تجاوز أحد لك
    _playSequence([
      { freq: 698.46, delay: 0,    duration: 0.16 },
      { freq: 523.25, delay: 0.2,  duration: 0.3 }
    ]);
  } else if (kind === "start"){
    // نغمة بداية واحدة هادئة
    _playSequence([
      { freq: 587.33, delay: 0, duration: 0.16 }
    ]);
  }
};

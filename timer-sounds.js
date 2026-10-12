/* ================================================================
   timer-sounds.js — نظام الصوت والاهتزاز لكل صفحات «مركز المؤقتات» (الإصدار 2)
   ----------------------------------------------------------------
   Web Audio API فقط، بدون ملفات صوت خارجية.
   • الصوت: نغمات «جرس» (أساسي + توافقيات) تمر عبر قناة واحدة فيها صدى خفيف
     وضاغط (Compressor) حتى لا يحدث تشويه أو ارتفاع مفاجئ.
   • التحكم: مستوى الصوت · كتم · أصوات الواجهة · الاهتزاز — تُحفظ بالجهاز وتنطبق على كل الصفحات.
   • أصوات الواجهة تلقائية: نقر الأزرار، تبديل المفاتيح، فتح/إغلاق النوافذ القديمة.
   • وضع التركيز العميق: يوقف كل شيء عدا نغمة نهاية المؤقت.
   الواجهة البرمجية:
     HOSound.get() / HOSound.set(key, value) / HOSound.play(kind, { force })
     window.playTimerAlert(kind)  ← كما كانت، كل الصفحات القديمة تعمل بلا تغيير
   ================================================================ */
(function(){
  "use strict";

  /* ============================ الإعدادات ============================ */
  var KEYS = { vol: "ho_snd_vol", mute: "ho_snd_mute", ui: "ho_snd_ui", haptic: "ho_snd_haptic", pack: "ho_snd_pack" };
  function lsGet(k, d){ try{ var v = localStorage.getItem(k); return v == null ? d : v; }catch(e){ return d; } }
  function lsSet(k, v){ try{ localStorage.setItem(k, v); }catch(e){} }
  function cfg(){
    var v = parseFloat(lsGet(KEYS.vol, "0.8"));
    if (!(v >= 0)) v = 0.8;
    return {
      vol: Math.min(1, v),
      mute: lsGet(KEYS.mute, "0") === "1",
      ui: lsGet(KEYS.ui, "1") !== "0",
      haptic: lsGet(KEYS.haptic, "1") !== "0"
    };
  }
  /* حزم الأصوات (تُشترى من المتجر). شاشتا المشرف (display / challenge-timer) تبقيان بالجرس الكلاسيكي دائمًا. */
  var PACKS = {
    bell:    { wave: "sine",   parts: [[1, 1, 1], [2, 0.3, 0.6], [3.01, 0.1, 0.35]], attack: 0.012, tail: 0.22, vib: 0 },
    ney:     { wave: "sine",   parts: [[1, 1, 1], [2, 0.2, 0.7], [3, 0.07, 0.5]],    attack: 0.045, tail: 0.32, vib: 5.2 },
    crystal: { wave: "sine",   parts: [[1, 0.9, 1], [2.76, 0.4, 0.55], [5.4, 0.2, 0.3]], attack: 0.004, tail: 0.35, vib: 0 },
    retro:   { wave: "square", parts: [[1, 0.45, 1]],                              attack: 0.004, tail: 0.06, vib: 0 }
  };
  var CLASSROOM = /(^|\/)(display|challenge-timer)\.html?$/i.test((window.location && location.pathname) || "");
  function curPack(opts){
    var id = (opts && opts.pack) || (CLASSROOM ? "bell" : lsGet(KEYS.pack, "bell"));
    return PACKS[id] || PACKS.bell;
  }
  function masterGain(){ var c = cfg(); return c.mute ? 0 : c.vol * 1.25; }

  /* ========================= السياق الصوتي المشترك ========================= */
  var _audioCtx = null, _bus = null, _master = null;
  function _buildChain(ctx){
    _master = ctx.createGain();
    _master.gain.value = masterGain();
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20; comp.knee.value = 24; comp.ratio.value = 6;
    comp.attack.value = 0.003; comp.release.value = 0.25;
    _master.connect(comp); comp.connect(ctx.destination);
    /* قناة النغمات: مباشرة + صدى خفيف (تأخير قصير مع ارتداد وفلتر) يعطي إحساس القاعة الصغيرة */
    _bus = ctx.createGain();
    _bus.connect(_master);
    try{
      var delay = ctx.createDelay(0.5); delay.delayTime.value = 0.13;
      var fb = ctx.createGain(); fb.gain.value = 0.3;
      var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2600;
      var wet = ctx.createGain(); wet.gain.value = 0.2;
      _bus.connect(delay); delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(wet); wet.connect(_master);
    }catch(e){}
  }
  function _getCtx(){
    if (!_audioCtx){
      try{
        _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        _buildChain(_audioCtx);
      }catch(e){ _audioCtx = null; return null; }
    }
    if (_audioCtx.state !== "running"){ try{ _audioCtx.resume().catch(function(){}); }catch(e){} }
    return _audioCtx;
  }
  function _syncMaster(){
    if (_master && _audioCtx){ try{ _master.gain.setTargetAtTime(masterGain(), _audioCtx.currentTime, 0.02); }catch(e){} }
  }
  window.addEventListener("storage", function(e){ if (e.key && e.key.indexOf("ho_snd_") === 0) _syncMaster(); });

  /* المتصفحات (خصوصًا iOS/Chrome) تمنع الصوت حتى يلمس المستخدم الصفحة مرة واحدة على الأقل. */
  function _unlockAudio(){
    var ctx = _getCtx();
    if (ctx){
      try{
        var b = ctx.createBuffer(1, 1, 22050);
        var s = ctx.createBufferSource();
        s.buffer = b; s.connect(ctx.destination); s.start(0);
      }catch(e){}
    }
    ["pointerdown", "touchstart", "keydown", "click"].forEach(function(ev){ window.removeEventListener(ev, _unlockAudio, true); });
  }
  ["pointerdown", "touchstart", "keydown", "click"].forEach(function(ev){ window.addEventListener(ev, _unlockAudio, { capture: true, passive: true }); });
  document.addEventListener("visibilitychange", function(){
    if (document.visibilityState === "visible" && _audioCtx && _audioCtx.state !== "running"){ _audioCtx.resume().catch(function(){}); }
  });

  /* ======================== وضع التركيز العميق ======================== */
  window.isDeepFocus = function(){
    try{ return localStorage.getItem("deep_focus_mode") === "1"; }catch(e){ return false; }
  };
  function _applyFocusClass(){
    if (document.body) document.body.classList.toggle("deep-focus", window.isDeepFocus());
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", _applyFocusClass);
  else _applyFocusClass();
  window.addEventListener("storage", function(e){ if (e.key === "deep_focus_mode") _applyFocusClass(); });

  /* إشعار محلي يعمل على أندرويد أيضًا (المُنشئ new Notification غير مسموح هناك، فنستخدم الـ Service Worker) */
  window.showLocalNotification = function(title, body, tag){
    try{
      if (!("Notification" in window) || Notification.permission !== "granted") return;
      var opts = { body: body || "", icon: "icon-192.png", badge: "icon-192.png", dir: "rtl", lang: "ar" };
      if (tag) opts.tag = tag;
      var fallback = function(){ try{ new Notification(title, opts); }catch(e){} };
      if ("serviceWorker" in navigator){
        navigator.serviceWorker.getRegistration().then(function(reg){
          if (reg && reg.showNotification) return reg.showNotification(title, opts);
          fallback();
        }).catch(fallback);
      } else fallback();
    }catch(e){}
  };

  /* ============================== الأصوات ============================== */
  /* نغمة «جرس»: صعود سريع ثم هبوط أُسّي. التوافقيات (×2 و ×3.01) تعطي لمعة معدنية ناعمة. */
  function _bell(ctx, freq, startAt, duration, peak, soft, pack){
    var P = pack || PACKS.bell;
    var parts = soft ? [[1, 1, 1]] : P.parts;
    var attack = soft ? Math.min(P.attack, 0.008) : P.attack;
    var tail = soft ? 0.05 : P.tail;
    for (var i = 0; i < parts.length; i++){
      var p = parts[i];
      var osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = P.wave;
      osc.frequency.setValueAtTime(freq * p[0], startAt);
      var end = startAt + (duration + tail) * p[2];
      var vol = Math.max(0.0002, peak * p[1]);
      g.gain.setValueAtTime(0.0001, startAt);
      g.gain.exponentialRampToValueAtTime(vol, startAt + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(g); g.connect(_bus || ctx.destination);
      if (P.vib && !soft && i === 0){            /* اهتزاز خفيف يعطي إحساس الناي */
        try{
          var lfo = ctx.createOscillator(), lg = ctx.createGain();
          lfo.frequency.value = P.vib; lg.gain.value = freq * 0.006;
          lfo.connect(lg); lg.connect(osc.frequency);
          lfo.start(startAt); lfo.stop(end + 0.04);
        }catch(e){}
      }
      osc.start(startAt); osc.stop(end + 0.04);
    }
  }
  /* تشغيل تسلسل نغمات مجدول بدقة على ساعة السياق الصوتي بدل setTimeout المتراكم الخطأ */
  function _playSequence(notes, soft, pack){
    var ctx = _getCtx();
    if (!ctx) return;
    var go = function(){
      var base = ctx.currentTime + 0.02;
      notes.forEach(function(n){ _bell(ctx, n.f, base + (n.t || 0), n.d, n.v || 0.15, soft, pack); });
    };
    if (ctx.state === "running"){ go(); return; }
    /* السياق موقوف (لم يلمس المستخدم الصفحة بعد): نحاول فتحه، وإن لم ينجح خلال نصف ثانية نتجاهل التنبيه */
    var done = false;
    var t = setTimeout(function(){ done = true; }, 500);
    ctx.resume().then(function(){ clearTimeout(t); if (!done && ctx.state === "running") go(); }).catch(function(){});
  }

  /* f=التردد · t=التأخير · d=المدة · v=الشدة */
  var SOUNDS = {
    /* --- تنبيهات المؤقتات --- */
    start:      [{ f: 587.33, t: 0, d: 0.16 }],
    mid:        [{ f: 659.25, t: 0, d: 0.16 }, { f: 659.25, t: 0.24, d: 0.16 }],
    lastMinute: [{ f: 783.99, t: 0, d: 0.14 }, { f: 783.99, t: 0.2, d: 0.14 }, { f: 880, t: 0.4, d: 0.2 }],
    finish:     [{ f: 523.25, t: 0, d: 0.18 }, { f: 659.25, t: 0.19, d: 0.18 }, { f: 783.99, t: 0.38, d: 0.18 }, { f: 1046.5, t: 0.57, d: 0.5, v: 0.17 }],
    /* --- أحداث اللعبة --- */
    notify:     [{ f: 880, t: 0, d: 0.12, v: 0.12 }, { f: 1174.66, t: 0.14, d: 0.2, v: 0.12 }],
    levelup:    [{ f: 523.25, t: 0, d: 0.14 }, { f: 659.25, t: 0.14, d: 0.14 }, { f: 783.99, t: 0.28, d: 0.14 }, { f: 1046.5, t: 0.42, d: 0.2 }, { f: 1318.51, t: 0.62, d: 0.55, v: 0.17 }],
    badge:      [{ f: 783.99, t: 0, d: 0.12 }, { f: 987.77, t: 0.13, d: 0.12 }, { f: 1318.51, t: 0.26, d: 0.4 }],
    streak:     [{ f: 440, t: 0, d: 0.14 }, { f: 554.37, t: 0.15, d: 0.14 }, { f: 659.25, t: 0.3, d: 0.35 }],
    overtaken:  [{ f: 698.46, t: 0, d: 0.16 }, { f: 523.25, t: 0.2, d: 0.3 }],
    mission:    [{ f: 659.25, t: 0, d: 0.1 }, { f: 783.99, t: 0.1, d: 0.1 }, { f: 1046.5, t: 0.2, d: 0.3 }, { f: 1568, t: 0.34, d: 0.25, v: 0.09 }],
    chest:      [{ f: 392, t: 0, d: 0.12 }, { f: 523.25, t: 0.12, d: 0.12 }, { f: 659.25, t: 0.24, d: 0.12 }, { f: 783.99, t: 0.36, d: 0.12 }, { f: 1046.5, t: 0.48, d: 0.2 }, { f: 1568, t: 0.66, d: 0.6, v: 0.16 }],
    /* --- الواجهة (ناعمة وقصيرة) --- */
    tap:        [{ f: 1318.51, t: 0, d: 0.03, v: 0.045 }],
    open:       [{ f: 783.99, t: 0, d: 0.05, v: 0.07 }, { f: 1046.5, t: 0.055, d: 0.08, v: 0.07 }],
    close:      [{ f: 1046.5, t: 0, d: 0.05, v: 0.06 }, { f: 783.99, t: 0.055, d: 0.08, v: 0.06 }],
    toggleOn:   [{ f: 880, t: 0, d: 0.05, v: 0.08 }, { f: 1318.51, t: 0.06, d: 0.09, v: 0.08 }],
    toggleOff:  [{ f: 1318.51, t: 0, d: 0.05, v: 0.07 }, { f: 880, t: 0.06, d: 0.09, v: 0.07 }],
    success:    [{ f: 880, t: 0, d: 0.08, v: 0.1 }, { f: 1174.66, t: 0.1, d: 0.16, v: 0.1 }],
    warn:       [{ f: 660, t: 0, d: 0.08, v: 0.1 }, { f: 660, t: 0.13, d: 0.1, v: 0.1 }],
    error:      [{ f: 392, t: 0, d: 0.1, v: 0.11 }, { f: 311.13, t: 0.12, d: 0.2, v: 0.11 }]
  };
  var UI_KINDS = { tap: 1, open: 1, close: 1, toggleOn: 1, toggleOff: 1, success: 1, warn: 1, error: 1 };
  /* ما يُسكَت في وضع التركيز العميق: كل شيء عدا نغمة نهاية المؤقت */
  var QUIET_KINDS = { mid: 1, start: 1, lastMinute: 1, notify: 1, streak: 1, overtaken: 1, levelup: 1, badge: 1, mission: 1, chest: 1,
                      tap: 1, open: 1, close: 1, toggleOn: 1, toggleOff: 1, success: 1, warn: 1, error: 1 };
  var HAPTIC = {
    finish: [220, 120, 220, 120, 380], lastMinute: [140, 90, 140], mid: [70],
    levelup: [70, 50, 70, 50, 160], badge: [60, 40, 100], streak: [80], overtaken: [120],
    notify: [50], mission: [60, 40, 60], chest: [50, 30, 50, 30, 150], error: [90, 60, 90]
  };

  function play(kind, opts){
    opts = opts || {};
    var notes = SOUNDS[kind];
    if (!notes) return;
    var c = cfg();
    if (!opts.force){
      if (QUIET_KINDS[kind] && window.isDeepFocus()) return;
      if (UI_KINDS[kind] && !c.ui) return;
    }
    if (c.haptic && HAPTIC[kind]){ try{ if (navigator.vibrate) navigator.vibrate(HAPTIC[kind]); }catch(e){} }
    if (c.mute) return;
    _playSequence(notes, !!UI_KINDS[kind], curPack(opts));
  }
  window.playTimerAlert = function(kind){ play(kind); };

  window.HOSound = {
    get: cfg,
    set: function(key, value){
      if (!KEYS[key]) return;
      if (key === "pack"){ lsSet(KEYS.pack, PACKS[value] ? String(value) : "bell"); return; }
      if (key === "vol") lsSet(KEYS.vol, String(Math.max(0, Math.min(1, +value || 0))));
      else lsSet(KEYS[key], value ? "1" : "0");
      _getCtx(); _syncMaster();
    },
    play: play
  };

  /* ==================== أصوات الواجهة التلقائية ==================== */
  var lastTap = 0, lastOverlay = 0;
  var CLICKABLE = "button, [role=button], [role=switch], .hub-item, .hub-btn, .bento-card, .back-btn, .back-link, .preset-btn, .mode-btn";
  document.addEventListener("click", function(e){
    var t = e.target;
    if (!t || !t.closest) return;
    var el = t.closest(CLICKABLE);
    if (!el || el.disabled || el.hasAttribute("data-nosound")) return;
    if (el.closest(".ho-overlay, .ho-cele, .ho-toasts")) return;   /* لهذه أصواتها الخاصة من ui.js */
    var now = Date.now();
    if (now - lastTap < 70) return;
    lastTap = now;
    if (el.matches("[role=switch], .switch-toggle")){
      /* نقرأ الحالة بعد أن تُحدّثها الصفحة */
      setTimeout(function(){
        var on = el.classList.contains("active") || el.getAttribute("aria-checked") === "true";
        play(on ? "toggleOn" : "toggleOff");
      }, 40);
      return;
    }
    play("tap");
  }, true);

  /* النوافذ القديمة (.overlay / .calc-overlay / .board-overlay) تُفتح بإضافة الصنف show: نسمع ذلك ونصدر صوت فتح/إغلاق */
  function watchOverlays(){
    if (!window.MutationObserver || !document.body) return;
    new MutationObserver(function(list){
      for (var i = 0; i < list.length; i++){
        var el = list[i].target;
        if (!el.matches || !el.matches('[class*="overlay"]:not(.ho-overlay)')) continue;
        var was = (list[i].oldValue || "").split(/\s+/).indexOf("show") > -1;
        var now = el.classList.contains("show");
        if (was === now) continue;
        var t = Date.now();
        if (t - lastOverlay < 150) continue;
        lastOverlay = t;
        play(now ? "open" : "close");
      }
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class"], attributeOldValue: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watchOverlays);
  else watchOverlays();
})();

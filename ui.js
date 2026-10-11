/* ================================================================
   ui.js — نظام الواجهة الموحّد لكل صفحات «مركز المؤقتات»
   ----------------------------------------------------------------
   بديل واحد عن كل الإشعارات المتفرقة (nf-toast, focus-toast, eye-toast,
   ch-toast, session-notice, إشعار time-bank, إشعار nav-lock) ونافذة
   alert/confirm المكررة. الأنماط في theme.css (الأصناف ho-*).

   الاستخدام:
     HOUI.toast({ type, title, text, icon, duration, sound, action, onClick, id, sticky, soft })
         type: info | success | warn | error | level | reward
         id:   نفس المعرّف يستبدل الإشعار القائم بدل تكراره
         soft: إشعار ثانوي يُتجاهل في وضع التركيز العميق
     HOUI.dismiss(id)
     HOUI.alert(msg, opts)    → Promise
     HOUI.confirm(msg, opts)  → Promise<boolean>   (opts: title, okText, cancelText, danger)
     HOUI.celebrate({ kind, icon, kicker, title, value, sub, color, okText, sound })
     HOUI.demo()              → عرض تجريبي لكل الأنواع (للاختبار من الكونسول)
   ================================================================ */
(function(){
  "use strict";
  if (window.HOUI) return;

  var COLORS = { info:"#48cae4", success:"#2ecc71", warn:"#ff9f43", error:"#ff3b30", level:"", reward:"#a78bfa" };
  var SOUND_BY_TYPE = { level:"levelup", reward:"badge", success:"success", warn:"warn", error:"error" };
  var P = {
    info:    '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5"/><path d="M12 8h.01"/>',
    success: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12.3l2.4 2.4 4.7-5"/>',
    warn:    '<path d="M12 4 3 19.5h18Z"/><path d="M12 10v4.2"/><path d="M12 17h.01"/>',
    error:   '<circle cx="12" cy="12" r="8.5"/><path d="M9 9l6 6"/><path d="M15 9l-6 6"/>',
    level:   '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8Z"/>',
    reward:  '<rect x="4" y="10" width="16" height="10" rx="1.5"/><rect x="3" y="7" width="18" height="3.5" rx="1"/><path d="M12 7v13"/><path d="M12 7C10.5 4 7 4 7 6.2 7 7.6 10 7 12 7Zm0 0c1.5-3 5-3 5-.8 0 1.4-3 .8-5 .8Z"/>',
    bell:    '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15Z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>',
    eye:     '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
    resume:  '<path d="M8 7 4 11l4 4"/><path d="M4 11h10a5 5 0 0 1 0 10h-2"/>',
    focus:   '<circle cx="12" cy="12" r="8.2"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".6" fill="currentColor" stroke="none"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v5h-5"/>',
    lock:    '<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>'
  };
  function svg(key){
    return '<svg class="ho-ic" viewBox="0 0 24 24" aria-hidden="true">' + (P[key] || P.info) + '</svg>';
  }
  function el(tag, cls, text){
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function accent(){
    try{
      var cs = getComputedStyle(document.body || document.documentElement);
      return (cs.getPropertyValue("--accent") || cs.getPropertyValue("--amber") || "#ffb400").trim() || "#ffb400";
    }catch(e){ return "#ffb400"; }
  }
  function colorFor(type, custom){ return custom || COLORS[type] || accent(); }
  function reduced(){ try{ return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }catch(e){ return false; } }
  function playSound(kind){ try{ if (kind && typeof window.playTimerAlert === "function") window.playTimerAlert(kind); }catch(e){} }
  function buzz(p){ try{ if (navigator.vibrate) navigator.vibrate(p); }catch(e){} }
  function deepFocus(){ try{ return typeof window.isDeepFocus === "function" && window.isDeepFocus(); }catch(e){ return false; } }

  /* ===== التأجيل: في وضع التركيز العميق وأثناء عمل مؤقت لا نقاطع الطالب باحتفال أو جائزة ===== */
  var deferred = [], deferTimer = null;
  function timerRunning(){ try{ return !!(window.NavLock && window.NavLock.isLocked && window.NavLock.isLocked()); }catch(e){ return false; } }
  function shouldDefer(){ return deepFocus() && timerRunning(); }
  function defer(fn){
    deferred.push(fn);
    if (deferTimer) return;
    deferTimer = setInterval(function(){
      if (shouldDefer()) return;
      clearInterval(deferTimer); deferTimer = null;
      deferred.splice(0).forEach(function(f, i){ setTimeout(f, i * 600); });
    }, 2000);
  }

  /* ============================ الإشعارات ============================ */
  var box = null, live = [];
  var MAX_VISIBLE = 3;

  function getBox(){
    if (!box || !box.isConnected){
      box = el("div", "ho-toasts");
      box.setAttribute("aria-live", "polite");
      (document.body || document.documentElement).appendChild(box);
    }
    return box;
  }

  function toast(o, typeArg){
    if (typeof o === "string") o = { text: o, type: typeArg };
    o = o || {};
    if (o.soft && deepFocus()) return null;
    var type = COLORS.hasOwnProperty(o.type) ? o.type : "info";
    if ((type === "level" || type === "reward") && !o._d && shouldDefer()){
      defer(function(){ toast(Object.assign({}, o, { _d: 1 })); });
      return null;
    }
    if (!document.body){
      document.addEventListener("DOMContentLoaded", function(){ toast(o); }, { once:true });
      return null;
    }

    /* نفس المعرّف: نحدّث القائم بدل تكديس نسخ مكررة */
    if (o.id){
      for (var i = 0; i < live.length; i++){
        if (live[i].id === o.id){ live[i].close(true); break; }
      }
    }

    var t = el("div", "ho-toast");
    t.setAttribute("role", "status");
    t.style.setProperty("--ho-c", colorFor(type, o.color));
    var ic = el("span", "ho-toast-ic"); ic.innerHTML = svg(o.icon || type);
    var body = el("div", "ho-toast-body");
    if (o.title) body.appendChild(el("b", "", o.title));
    if (o.text)  body.appendChild(el("span", o.title ? "" : "solo", o.text));
    t.appendChild(ic); t.appendChild(body);

    var duration = o.sticky ? 0 : (o.duration || 4200);
    var h = { id: o.id || null, el: t, timer: null, left: duration, startedAt: 0, closed: false };

    if (o.action && o.action.label){
      var ab = el("button", "ho-toast-act", o.action.label);
      ab.type = "button";
      ab.addEventListener("click", function(e){
        e.stopPropagation();
        try{ if (o.action.onClick) o.action.onClick(); }catch(x){}
        h.close();
      });
      t.appendChild(ab);
    }
    if (o.sticky){
      var cb = el("button", "ho-toast-x", "×");
      cb.type = "button"; cb.setAttribute("aria-label", "إغلاق");
      cb.addEventListener("click", function(e){ e.stopPropagation(); h.close(); });
      t.appendChild(cb);
    }
    if (duration){
      var bar = el("i", "ho-toast-bar");
      bar.style.setProperty("--ho-d", duration + "ms");
      t.appendChild(bar);
    }

    h.close = function(instant){
      if (h.closed) return;
      h.closed = true;
      clearTimeout(h.timer);
      live = live.filter(function(x){ return x !== h; });
      if (instant){ t.remove(); return; }
      t.classList.remove("in"); t.classList.add("out");
      setTimeout(function(){ t.remove(); }, 320);
    };
    function arm(ms){
      if (!duration) return;
      clearTimeout(h.timer);
      h.startedAt = Date.now(); h.left = ms;
      h.timer = setTimeout(function(){ h.close(); }, ms);
    }
    function pause(){
      if (!duration || h.closed) return;
      clearTimeout(h.timer);
      h.left = Math.max(600, h.left - (Date.now() - h.startedAt));
      t.classList.add("paused");
    }
    function resume(){
      if (!duration || h.closed) return;
      t.classList.remove("paused");
      arm(h.left);
    }

    /* سحب للإغلاق (أفقيًا أو للأعلى) + النقر لتنفيذ onClick */
    var sx = 0, sy = 0, dx = 0, dy = 0, dragging = false, moved = false;
    t.addEventListener("pointerdown", function(e){
      if (e.target.closest && e.target.closest("button")) return;
      dragging = true; moved = false; sx = e.clientX; sy = e.clientY; dx = dy = 0;
      pause();
    });
    t.addEventListener("pointermove", function(e){
      if (!dragging) return;
      dx = e.clientX - sx; dy = Math.min(0, e.clientY - sy);
      if (Math.abs(dx) > 6 || dy < -6) moved = true;
      if (moved){
        t.style.transition = "none";
        t.style.transform = "translate(" + dx + "px," + dy + "px)";
        t.style.opacity = String(Math.max(.25, 1 - Math.abs(dx) / 260));
      }
    });
    function endDrag(){
      if (!dragging) return;
      dragging = false;
      t.style.transition = "";
      if (Math.abs(dx) > 70 || dy < -38){
        t.style.transform = "translate(" + (dx * 2.4) + "px," + dy + "px)";
        t.style.opacity = "0";
        h.close();
      } else {
        t.style.transform = ""; t.style.opacity = "";
        resume();
      }
    }
    t.addEventListener("pointerup", function(){
      var wasMoved = moved;
      endDrag();
      if (!wasMoved && o.onClick){ try{ o.onClick(); }catch(x){} h.close(); }
    });
    t.addEventListener("pointercancel", endDrag);
    t.addEventListener("mouseenter", pause);
    t.addEventListener("mouseleave", function(){ if (!dragging) resume(); });
    if (o.onClick) t.style.cursor = "pointer";

    var b = getBox();
    b.insertBefore(t, b.firstChild);
    live.unshift(h);
    while (live.length > MAX_VISIBLE){ live[live.length - 1].close(); }
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ t.classList.add("in"); }); });
    arm(duration);

    playSound(o.sound === false ? null : (o.sound || SOUND_BY_TYPE[type]));
    if (type === "level" || type === "reward") buzz(40);
    return h;
  }
  function dismiss(id){
    for (var i = 0; i < live.length; i++){
      if (live[i].id === id){ live[i].close(); return; }
    }
  }

  /* ===================== الحوارات والاحتفال (طابور واحد) ===================== */
  var queue = [], busy = false, lastFocus = null;
  function enqueue(render){
    return new Promise(function(resolve){
      queue.push({ render: render, resolve: resolve });
      pump();
    });
  }
  function pump(){
    if (busy || !queue.length) return;
    if (!document.body){ document.addEventListener("DOMContentLoaded", pump, { once:true }); return; }
    busy = true;
    var item = queue.shift();
    lastFocus = document.activeElement;
    item.render(function(result){
      busy = false;
      try{ if (lastFocus && lastFocus.focus) lastFocus.focus(); }catch(e){}
      item.resolve(result);
      setTimeout(pump, 120);
    });
  }
  function mount(node, onEsc){
    document.body.appendChild(node);
    function key(e){ if (e.key === "Escape"){ e.preventDefault(); onEsc(); } }
    document.addEventListener("keydown", key, true);
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ node.classList.add("in"); }); });
    return function unmount(){
      document.removeEventListener("keydown", key, true);
      node.classList.remove("in");
      setTimeout(function(){ node.remove(); }, 280);
    };
  }

  function dialog(msg, o, isConfirm){
    o = o || {};
    return enqueue(function(done){
      var type = o.danger ? "error" : (o.type || (isConfirm ? "warn" : "info"));
      var ov = el("div", "ho-overlay");
      ov.style.setProperty("--ho-c", colorFor(type, o.color));
      var dlg = el("div", "ho-dialog");
      dlg.setAttribute("role", isConfirm ? "alertdialog" : "dialog");
      dlg.setAttribute("aria-modal", "true");
      var ic = el("div", "ho-dialog-ic"); ic.innerHTML = svg(o.icon || type);
      dlg.appendChild(ic);
      if (o.title) dlg.appendChild(el("div", "ho-dialog-title", o.title));
      dlg.appendChild(el("p", "ho-dialog-text", String(msg == null ? "" : msg)));
      var acts = el("div", "ho-actions");
      var ok = el("button", "ho-btn primary" + (o.danger ? " danger" : ""), o.okText || (isConfirm ? "تأكيد" : "حسنًا"));
      ok.type = "button";
      var cancel = null;
      if (isConfirm){
        cancel = el("button", "ho-btn", o.cancelText || "إلغاء");
        cancel.type = "button";
        acts.appendChild(cancel);
      }
      acts.appendChild(ok);
      dlg.appendChild(acts);
      ov.appendChild(dlg);
      var finished = false;
      var unmount;
      function finish(v){
        if (finished) return; finished = true;
        unmount(); done(v);
      }
      var closeMount = mount(ov, function(){ finish(isConfirm ? false : true); });
      unmount = function(){ playSound("close"); closeMount(); };
      playSound(o.danger ? "warn" : "open");
      ok.addEventListener("click", function(){ finish(true); });
      if (cancel) cancel.addEventListener("click", function(){ finish(false); });
      if (isConfirm) ov.addEventListener("pointerdown", function(e){ if (e.target === ov) finish(false); });
      setTimeout(function(){ try{ (isConfirm && o.danger && cancel ? cancel : ok).focus(); }catch(e){} }, 60);
    });
  }
  function alertDlg(msg, o){ return dialog(msg, o, false); }
  function confirmDlg(msg, o){ return dialog(msg, o, true); }

  /* ----- قصاصات الاحتفال (Canvas خفيف، يتوقف تلقائيًا) ----- */
  function confetti(canvas, color){
    var ctx = canvas.getContext("2d");
    if (!ctx) return function(){};
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var W = canvas.width = Math.floor(window.innerWidth * dpr);
    var H = canvas.height = Math.floor(window.innerHeight * dpr);
    var cols = [color, "#ffd36b", "#ffffff", "#ffb400", "#a78bfa"];
    var parts = [], N = 120, i;
    for (i = 0; i < N; i++){
      parts.push({
        x: Math.random() * W, y: -Math.random() * H * 0.5,
        w: (5 + Math.random() * 7) * dpr, h: (8 + Math.random() * 10) * dpr,
        vx: (Math.random() - .5) * 2.4 * dpr, vy: (2 + Math.random() * 3.2) * dpr,
        rot: Math.random() * 6.28, vr: (Math.random() - .5) * .3,
        c: cols[(Math.random() * cols.length) | 0]
      });
    }
    var t0 = performance.now(), raf = 0, stopped = false;
    function frame(now){
      if (stopped) return;
      var el_ = now - t0;
      ctx.clearRect(0, 0, W, H);
      var alive = 0;
      for (var k = 0; k < parts.length; k++){
        var p = parts[k];
        p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.vy += 0.025 * dpr;
        if (p.y < H + 30){ alive++; }
        var fade = el_ > 2600 ? Math.max(0, 1 - (el_ - 2600) / 900) : 1;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (el_ < 3500 && alive) raf = requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, W, H);
    }
    raf = requestAnimationFrame(frame);
    return function stop(){ stopped = true; cancelAnimationFrame(raf); };
  }

  function celebrate(o){
    o = o || {};
    if (!o._d && shouldDefer()){
      return new Promise(function(res){
        defer(function(){ celebrate(Object.assign({}, o, { _d: 1 })).then(res); });
      });
    }
    return enqueue(function(done){
      var kind = o.kind || "level";
      var color = colorFor(kind === "badge" ? "reward" : kind, o.color);
      var ov = el("div", "ho-cele");
      ov.style.setProperty("--ho-c", color);
      var cv = el("canvas"); cv.setAttribute("aria-hidden", "true");
      var medal = el("div", "ho-cele-medal");
      var icon = o.icon || (kind === "level" ? "level" : "reward");
      if (P[icon]) medal.innerHTML = svg(icon);
      else medal.appendChild(el("span", "emoji", icon));
      ov.appendChild(cv);
      ov.appendChild(medal);
      if (o.kicker) ov.appendChild(el("div", "ho-cele-kicker", o.kicker));
      if (o.title)  ov.appendChild(el("div", "ho-cele-title", o.title));
      if (o.value != null) ov.appendChild(el("div", "ho-cele-value", String(o.value)));
      if (o.sub)    ov.appendChild(el("div", "ho-cele-sub", o.sub));
      var ok = el("button", "ho-btn primary", o.okText || "رائع!");
      ok.type = "button";
      ov.appendChild(ok);
      var stopConf = null, finished = false, unmount;
      function finish(){
        if (finished) return; finished = true;
        if (stopConf) stopConf();
        unmount(); done(true);
      }
      unmount = mount(ov, finish);
      ok.addEventListener("click", finish);
      if (!reduced()) stopConf = confetti(cv, color);
      playSound(o.sound === false ? null : (o.sound || SOUND_BY_TYPE[kind === "badge" ? "reward" : kind] || "badge"));
      buzz([60, 40, 90]);
      setTimeout(function(){ try{ ok.focus(); }catch(e){} }, 700);
    });
  }

  /* ==================== توافق مع الدوال القديمة في الصفحات ==================== */
  window.appAlert = function(message){ alertDlg(message); };
  window.appConfirm = function(message, onConfirmed){
    confirmDlg(message).then(function(ok){ if (ok && onConfirmed) onConfirmed(); });
  };

  /* ==================== إشعار التحديث (Service Worker) ====================
     الـ SW يفعّل نفسه فورًا؛ إن كانت الصفحة مفتوحة بنسخة قديمة نعرض زر تحديث بدل أن تتعارض النسختان. */
  try{
    if ("serviceWorker" in navigator){
      var hadController = !!navigator.serviceWorker.controller, shown = false;
      navigator.serviceWorker.addEventListener("controllerchange", function(){
        if (!hadController || shown) return;
        shown = true;
        toast({
          id: "sw-update", type: "info", icon: "refresh", sticky: true,
          title: "تحديث جديد جاهز", text: "حدّث الصفحة لتستفيد من آخر التحسينات.",
          action: { label: "تحديث", onClick: function(){ location.reload(); } }
        });
      });
    }
  }catch(e){}

  function demo(){
    toast({ type:"info", title:"معلومة", text:"هذا إشعار عادي" });
    setTimeout(function(){ toast({ type:"success", text:"تم الحفظ بنجاح" }); }, 350);
    setTimeout(function(){ toast({ type:"warn", text:"تنبيه: افتح مؤقتًا واحدًا فقط" }); }, 700);
    setTimeout(function(){ toast({ type:"reward", title:"جائزة جديدة", text:"فتحت نمط Neon" }); }, 1050);
    setTimeout(function(){
      confirmDlg("هل تريد المتابعة؟", { title:"تأكيد" }).then(function(){
        celebrate({ kind:"level", kicker:"ترقية!", title:"المستوى الجديد", value:5, sub:"استمر، أنت تتقدم بثبات." });
      });
    }, 1500);
  }

  window.HOUI = { toast: toast, dismiss: dismiss, alert: alertDlg, confirm: confirmDlg, celebrate: celebrate, demo: demo, version: 1 };
})();

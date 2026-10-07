/* ==========================================================
   nav-lock.js — قفل التنقل أثناء عمل المؤقت
   عندما يكون المؤقت شغّالًا: تُمنع أزرار الرجوع وروابط الصفحات الأخرى
   وزر الرجوع في الجهاز/المتصفح، ويظهر تنبيه يشرح السبب.
   يُفتح القفل تلقائيًا عند إيقاف المؤقت مؤقتًا أو إنهائه أو انتهاء وقته.
   الاستخدام داخل كل صفحة:  NavLock.track(() => تعيد true لو المؤقت شغّال);
   ========================================================== */
(function(){
  "use strict";
  var check = function(){ return false; };
  var locked = false;
  var trapped = false;   /* هل أضفنا عنصرًا إضافيًا لسجل التصفح */
  var toastEl = null, toastTimer = null;
  var MSG = "المؤقت شغّال. أوقفه مؤقتًا أو أنهِه أولًا حتى تتمكن من الرجوع.";

  function isLocked(){ try{ return !!check(); }catch(e){ return false; } }

  function injectStyle(){
    if (document.getElementById("navlock-style")) return;
    var s = document.createElement("style");
    s.id = "navlock-style";
    s.textContent =
      ".nav-locked .back-link, .nav-locked .back-btn{ opacity:.4; cursor:not-allowed; }" +
      "#navlockToast{ position:fixed; left:50%; bottom:calc(24px + env(safe-area-inset-bottom,0px));" +
      " transform:translate(-50%,16px); max-width:min(92vw,380px); padding:12px 18px; border-radius:14px;" +
      " background:var(--panel-2,#17171e); color:var(--text,#f3f4f8); border:1px solid var(--accent,var(--amber,#ffb400));" +
      " font:700 14px/1.6 'Tajawal',sans-serif; text-align:center; box-shadow:0 12px 36px rgba(0,0,0,.55);" +
      " opacity:0; pointer-events:none; transition:opacity .2s, transform .2s; z-index:99999; }" +
      "#navlockToast.show{ opacity:1; transform:translate(-50%,0); }";
    document.head.appendChild(s);
  }

  function toast(){
    injectStyle();
    if (!toastEl){
      toastEl = document.createElement("div");
      toastEl.id = "navlockToast";
      toastEl.setAttribute("role", "status");
      toastEl.setAttribute("aria-live", "polite");
      toastEl.textContent = MSG;
      document.body.appendChild(toastEl);
    }
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ toastEl.classList.remove("show"); }, 2800);
  }

  function pushTrap(){
    try{ history.pushState({ navLock:1 }, "", location.href); }catch(e){}
  }

  function apply(){
    var now = isLocked();
    if (now === locked) return;
    locked = now;
    if (document.body) document.body.classList.toggle("nav-locked", locked);
    if (locked && !trapped){ pushTrap(); trapped = true; }
  }

  /* زر الرجوع في الجهاز أو المتصفح */
  window.addEventListener("popstate", function(){
    if (isLocked()){ pushTrap(); toast(); }
    else if (trapped){ trapped = false; history.back(); }   /* أول ضغطة بعد فتح القفل ترجع فعليًا */
  });

  /* أزرار الرجوع وروابط الصفحات الأخرى */
  document.addEventListener("click", function(e){
    if (!isLocked()) return;
    var t = e.target;
    if (!t || !t.closest) return;
    var el = t.closest(".back-btn, .back-link, a[href]");
    if (!el) return;
    if (!el.matches(".back-btn, .back-link")){
      var h = el.getAttribute("href") || "";
      if (!h || h.charAt(0) === "#" || /^(javascript|mailto|tel):/i.test(h)) return;
      try{
        var u = new URL(h, location.href);
        if (u.origin === location.origin && u.pathname === location.pathname) return;
      }catch(x){}
    }
    e.preventDefault();
    e.stopImmediatePropagation();
    toast();
  }, true);

  window.NavLock = {
    track: function(fn){ if (typeof fn === "function"){ check = fn; apply(); } },
    isLocked: isLocked
  };

  setInterval(apply, 300);
  window.addEventListener("pageshow", apply);
  document.addEventListener("visibilitychange", apply);
})();

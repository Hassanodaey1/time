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
  var MSG = "المؤقت شغّال. أوقفه مؤقتًا أو أنهِه أولًا حتى تتمكن من الرجوع.";

  function isLocked(){ try{ return !!check(); }catch(e){ return false; } }

  function injectStyle(){
    if (document.getElementById("navlock-style")) return;
    var s = document.createElement("style");
    s.id = "navlock-style";
    s.textContent = ".nav-locked .back-link, .nav-locked .back-btn{ opacity:.4; cursor:not-allowed; }";
    document.head.appendChild(s);
  }

  /* الإشعار بتصميم اللعبة الموحّد (ui.js يُحمَّل قبل هذا الملف في كل صفحة تستخدمه) */
  function toast(){
    if (window.HOUI) window.HOUI.toast({ id: "navlock", type: "info", icon: "lock", text: MSG, duration: 2800 });
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

  injectStyle();

  window.NavLock = {
    track: function(fn){ if (typeof fn === "function"){ check = fn; apply(); } },
    isLocked: isLocked
  };

  setInterval(apply, 300);
  window.addEventListener("pageshow", apply);
  document.addEventListener("visibilitychange", apply);
})();

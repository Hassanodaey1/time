/* ================================================================
   إصلاح الواجهة داخل متصفح تيليجرام فقط.
   شريط تيليجرام العلوي (إغلاق / القائمة) يغطي الأزرار الثابتة أعلى الصفحة (رجوع، ADMIN، ملء الشاشة...)،
   فنُنزّلها تحت الشريط ونزيح المحتوى قليلاً. خارج تيليجرام لا يحدث أي شيء.
   للتجربة من أي متصفح أضف ?tg=1 للرابط.
   ================================================================ */
(function(){
  var tg = false;
  try{
    tg = /Telegram/i.test(navigator.userAgent || "")
      || !!window.TelegramWebview || !!window.TelegramWebviewProxy
      || !!(window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData)
      || /[?&]tg=1\b/.test(location.search);
  }catch(e){}
  if (!tg) return;
  window.IN_TELEGRAM = true;
  document.documentElement.classList.add("in-telegram");
  var st = document.createElement("style");
  st.textContent =
    "html.in-telegram{--tg-top:60px;}" +
    "html.in-telegram .back-link, html.in-telegram .back-btn, html.in-telegram .tally, html.in-telegram .fs-btn{" +
      "top:calc(var(--tg-top) + 12px + env(safe-area-inset-top, 0px)) !important;}" +
    "html.in-telegram body:not([data-theme]){" +
      "padding-top:calc(var(--tg-top) + 36px + env(safe-area-inset-top, 0px)) !important;}";
  (document.head || document.documentElement).appendChild(st);
})();

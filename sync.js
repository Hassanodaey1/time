/* ================================================================
   sync.js — مزامنة النجوم والمشتريات بين أجهزة الطالب (تُحمَّل في index.html فقط)
   ----------------------------------------------------------------
   • المسار: studyShop/{uid}  ← يكتبه ويقرؤه صاحبه فقط (انظر القواعد أدناه).
   • الدمج بلا تضارب: كل الخرائط (legacy / claims / spent / owned) تُدمج باتحاد المفاتيح،
     فلا يوجد عدّ مزدوج ولا يضيع شيء عند الكتابة من جهازين. التجهيز (eq) يفوز فيه الأحدث.
   • التطبيق يعمل محليًا أولًا؛ إن فشلت المزامنة (بلا اتصال أو القواعد غير منشورة) لا يتأثر شيء.
   • لا يحتاج Cloud Function: النجوم مظهرية فقط، فلا قيمة للتلاعب بها.

   أضف هذا إلى قواعد Realtime Database (داخل "rules") ثم انشرها:
     "studyShop": {
       "$uid": {
         ".read":  "auth != null && auth.uid === $uid",
         ".write": "auth != null && auth.uid === $uid",
         "legacy": { "$d": { ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 100000" } },
         "claims": { "$k": { ".validate": "newData.isNumber() && newData.val() > 0 && newData.val() <= 10" } },
         "spent":  { "$k": { ".validate": "newData.isNumber() && newData.val() > 0 && newData.val() <= 500" } },
         "owned":  { "$k": { ".validate": "newData.val() === 1" } },
         "eq":     { "$t": { ".validate": "newData.isString() && newData.val().length <= 16" } },
         "eqAt":   { ".validate": "newData.isNumber()" },
         "$other": { ".validate": false }
       }
     }

   الواجهة: HOSync.start(db, uid) · HOSync.pullNow() · HOSync.status()
   ================================================================ */
(function(){
  "use strict";
  if (window.HOSync) return;

  var ref = null, started = false, serverCache = null, pushTimer = null, lastPull = 0, busy = false;
  var st = { ok: null, error: "" };
  var MAPS = ["legacy", "claims", "spent", "owned"];

  function safeKey(k){ return String(k).replace(/[.$#\[\]\/]/g, "_"); }
  function localDoc(){
    var L = window.HOMissions ? window.HOMissions.exportLedger() : {};
    var I = window.HOShop ? window.HOShop.exportInv() : {};
    return { legacy: L.legacy || {}, claims: L.claims || {}, spent: L.spent || {}, owned: I.owned || {}, eq: I.eq || {}, eqAt: I.eqAt || 0 };
  }
  /* ما ينقص السيرفر مما عندنا (مفاتيح جديدة فقط) */
  function diff(local, server){
    var up = {}, n = 0;
    MAPS.forEach(function(m){
      var s = (server && server[m]) || {}, l = local[m] || {};
      Object.keys(l).forEach(function(k){
        if (s[safeKey(k)] === undefined){ up[m + "/" + safeKey(k)] = l[k]; n++; }
      });
    });
    if ((local.eqAt || 0) > ((server && server.eqAt) || 0)){
      ["frame", "bg", "pack"].forEach(function(t){ up["eq/" + t] = (local.eq && local.eq[t]) || ""; });
      up.eqAt = local.eqAt; n++;
    }
    return n ? up : null;
  }
  function applyToCache(up){
    if (!serverCache) serverCache = {};
    Object.keys(up).forEach(function(path){
      var parts = path.split("/"), o = serverCache;
      for (var i = 0; i < parts.length - 1; i++){ o[parts[i]] = o[parts[i]] || {}; o = o[parts[i]]; }
      o[parts[parts.length - 1]] = up[path];
    });
  }
  function fail(e){
    st.ok = false; st.error = (e && e.message) || String(e);
    if (!fail.warned){ fail.warned = true; try{ console.warn("HOSync: تعذّرت المزامنة (هل نُشرت قواعد studyShop؟) —", st.error); }catch(x){} }
  }

  /* سحب من السيرفر ← دمج محليًا ← دفع الناقص */
  function pullNow(){
    if (!ref || busy) return Promise.resolve(false);
    busy = true;
    return ref.once("value").then(function(snap){
      var doc = snap.val() || {};
      serverCache = doc;
      var a = window.HOMissions ? window.HOMissions.mergeLedger(doc) : false;
      var b = window.HOShop ? window.HOShop.mergeInv(doc) : false;
      lastPull = Date.now();
      var up = diff(localDoc(), serverCache);
      if (up){ return ref.update(up).then(function(){ applyToCache(up); }); }
    }).then(function(){ st.ok = true; st.error = ""; return true; })
      .catch(function(e){ fail(e); return false; })
      .then(function(r){ busy = false; return r; });
  }
  function pushSoon(){
    if (!ref) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function(){
      if (!serverCache){ pullNow(); return; }
      var up = diff(localDoc(), serverCache);
      if (!up) return;
      ref.update(up).then(function(){ applyToCache(up); st.ok = true; }).catch(fail);
    }, 1500);
  }

  function start(db, uid){
    if (started || !db || !uid) return;
    started = true;
    try{ ref = db.ref("studyShop/" + uid); }catch(e){ fail(e); return; }
    if (window.HOMissions) window.HOMissions.onChange(pushSoon);
    if (window.HOShop) window.HOShop.onChange(pushSoon);
    document.addEventListener("visibilitychange", function(){
      if (document.visibilityState === "visible" && Date.now() - lastPull > 60000) pullNow();
    });
    pullNow();
  }
  window.HOSync = { start: start, pullNow: pullNow, status: function(){ return { ok: st.ok, error: st.error, started: started }; } };
})();

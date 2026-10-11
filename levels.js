/* ================================================================
   levels.js — مصدر واحد للمستوى والألقاب والشارات (مركز المؤقتات)
   ----------------------------------------------------------------
   • معادلة المستوى كما هي بالضبط (المستوى n يبدأ عند n×(n−1) ساعة) حتى تبقى
     متوافقة مع إشعارات السيرفر (Cloud Function). تغيير المنحنى يتطلب تعديل السيرفر أيضًا.
   • الألقاب: 10 رتب بطابع حضارات الرافدين وعلمائها. غيّر الأسماء/الألوان من مصفوفة TIERS فقط.
   • الاحتفال: عند ارتفاع المستوى أو الحصول على شارة جديدة يُعرض احتفال HOUI.celebrate مرة واحدة.
     أثناء عمل المؤقت يُؤجَّل الاحتفال تلقائيًا (ui.js) حتى لا يقاطع الطالب.
   الواجهة:
     HOLevel.info(totalSeconds)  → { lvl, pct, maxed, remainSec, tier, tierIndex, nextTier }
     HOLevel.titleOf(lvl) · colorOf(lvl) · iconOf(lvl)
     HOLevel.chip(totalSeconds)  → وسم HTML صغير (م5) للقوائم
     HOLevel.check(uid, record)  → يكشف الترقية/الشارات الجديدة ويحتفل بها
     HOLevel.recheck()           → يعيد الفحص على آخر سجل معروف
   ================================================================ */
(function(){
  "use strict";
  if (window.HOLevel) return;

  var MAX = 50;
  function svg(p){ return '<svg class="ho-ic" viewBox="0 0 24 24" aria-hidden="true">' + p + '</svg>'; }

  /* min = أول مستوى يحمل اللقب */
  var TIERS = [
    { min: 1,  name: "لوح طيني",           color: "#b98a5e", icon: svg('<rect x="5" y="4" width="14" height="16" rx="2"/><path d="M8.5 9h7M8.5 12.5h7M8.5 16h4"/>') },
    { min: 3,  name: "كاتب سومري",         color: "#48cae4", icon: svg('<path d="M4 20l1-4L17 4l3 3L8 19Z"/><path d="M14.5 6.5l3 3"/>') },
    { min: 5,  name: "فلكي بابلي",         color: "#7aa2ff", icon: svg('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/><path d="M17 4.5v3M15.5 6h3"/>') },
    { min: 8,  name: "مهندس الزقورة",      color: "#ff9f43", icon: svg('<path d="M3 20h18"/><path d="M6 20v-3h12v3"/><path d="M8.5 17v-3h7v3"/><path d="M10.5 14v-3h3v3"/><path d="M12 11V8"/>') },
    { min: 11, name: "حكيم بابل",          color: "#2ecc71", icon: svg('<path d="M4 5.5C6.5 4.5 9.5 4.5 12 6c2.5-1.5 5.5-1.5 8-.5V19c-2.5-1-5.5-1-8 .5-2.5-1.5-5.5-1.5-8-.5Z"/><path d="M12 6v13.5"/>') },
    { min: 15, name: "عالم المستنصرية",    color: "#f06bb0", icon: svg('<path d="M3 20h18"/><path d="M5 20V10l7-5 7 5v10"/><path d="M9.5 20v-5a2.5 2.5 0 0 1 5 0v5"/>') },
    { min: 20, name: "فيلسوف بيت الحكمة",  color: "#ffb400", icon: svg('<circle cx="12" cy="12" r="3.6"/><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M18 6l-1.6 1.6M7.6 16.4 6 18"/>') },
    { min: 27, name: "الخوارزمي",          color: "#a78bfa", icon: svg('<path d="M12 3v3"/><path d="M12 6 5 20"/><path d="M12 6l7 14"/><path d="M8 15h8"/>') },
    { min: 35, name: "ابن الهيثم",         color: "#5eead4", icon: svg('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>') },
    { min: 45, name: "أسطورة الرافدين",    color: "#ffd36b", icon: svg('<path d="M4 18 3.5 8l5 4L12 5l3.5 7 5-4L20 18Z"/><path d="M4 20.5h16"/>') }
  ];

  /* الشارات (نفس شروط الملف الشخصي الحالية) */
  var BADGES = [
    { name: "البداية",    req: "ساعة",     type: "hours",  val: 1,   icon: "clock", color: "#48cae4", emoji: "⏱️" },
    { name: "برونزية",    req: "10 ساعات", type: "hours",  val: 10,  icon: "medal", color: "#cd7f32", emoji: "🥉" },
    { name: "فضية",       req: "50 ساعة",  type: "hours",  val: 50,  icon: "medal", color: "#c0c8d4", emoji: "🥈" },
    { name: "ذهبية",      req: "150 ساعة", type: "hours",  val: 150, icon: "medal", color: "#ffb400", emoji: "🥇" },
    { name: "3 أيام",     req: "سلسلة 3",  type: "streak", val: 3,   icon: "flame", color: "#ff9f43", emoji: "🔥" },
    { name: "أسبوع",      req: "سلسلة 7",  type: "streak", val: 7,   icon: "flame", color: "#ff6b3d", emoji: "🔥" },
    { name: "شهر",        req: "سلسلة 30", type: "streak", val: 30,  icon: "flame", color: "#ff3b30", emoji: "🔥" },
    { name: "المستوى 10", req: "مستوى 10", type: "level",  val: 10,  icon: "star",  color: "#a78bfa", emoji: "⭐" }
  ];

  function tierIndex(lvl){
    var idx = 0;
    for (var i = 0; i < TIERS.length; i++){ if (lvl >= TIERS[i].min) idx = i; }
    return idx;
  }
  function info(totalSeconds){
    var h = Math.max(0, (totalSeconds || 0) / 3600);
    var lvl = Math.floor((1 + Math.sqrt(1 + 4 * h)) / 2);
    if (lvl > MAX) lvl = MAX;
    if (lvl < 1) lvl = 1;
    var floorH = lvl * (lvl - 1), ceilH = lvl * (lvl + 1);
    var maxed = lvl >= MAX;
    var pct = maxed ? 100 : Math.max(0, Math.min(100, ((h - floorH) / (ceilH - floorH)) * 100));
    var ti = tierIndex(lvl);
    return {
      lvl: lvl, pct: pct, maxed: maxed,
      remainSec: maxed ? 0 : Math.max(0, (ceilH - h) * 3600),
      tierIndex: ti, tier: TIERS[ti], nextTier: TIERS[ti + 1] || null
    };
  }
  function tierOf(lvl){ return TIERS[tierIndex(lvl)]; }
  function titleOf(lvl){ return tierOf(lvl).name; }
  function colorOf(lvl){ return tierOf(lvl).color; }
  function iconOf(lvl){ return tierOf(lvl).icon; }
  function hoursFor(lvl){ return lvl * (lvl - 1); }
  function chip(totalSeconds){
    var L = info(totalSeconds);
    return '<span class="lvl-chip" style="--tc:' + L.tier.color + '" title="' + L.tier.name + '">م' + L.lvl + '</span>';
  }
  function fmtHM(sec){
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    return h > 0 ? (h + " س " + m + " د") : (m + " د");
  }
  function badgeOk(b, total, bestStreak, lvl){
    return b.type === "hours" ? (total / 3600) >= b.val : b.type === "streak" ? bestStreak >= b.val : lvl >= b.val;
  }

  /* ===================== كشف الترقية والشارات الجديدة ===================== */
  function lsGet(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
  function lsSet(k, v){ try{ localStorage.setItem(k, v); }catch(e){} }
  var last = { uid: null, val: null };

  function check(uid, val){
    if (!uid || !val) return false;
    last.uid = uid; last.val = val;
    var total = val.totalSeconds || 0, streak = val.streak || 0;
    var kStreak = "pv_best_streak_" + uid;
    var storedBest = parseInt(lsGet(kStreak) || "0", 10) || 0;
    var best = Math.max(streak, storedBest);
    if (best > storedBest) lsSet(kStreak, String(best));
    var L = info(total);
    var events = [];

    /* المستوى: أول مرة نسجّل بصمت (حتى لا يُحتفل بمستوى قديم)، وانخفاض المستوى (تعديل المشرف) يُسجَّل بصمت أيضًا */
    var kLvl = "ho_lvl_seen_" + uid;
    var seen = parseInt(lsGet(kLvl), 10);
    if (isNaN(seen) || L.lvl < seen){
      lsSet(kLvl, String(L.lvl));
    } else if (L.lvl > seen){
      lsSet(kLvl, String(L.lvl));
      var tierChanged = tierIndex(seen) !== L.tierIndex;
      var parts = [];
      if (tierChanged) parts.push("لقب جديد في رحلتك");
      if (L.lvl - seen > 1) parts.push("قفزت من المستوى " + seen);
      parts.push(L.maxed ? "وصلت لأعلى مستوى!" : ("باقي " + fmtHM(L.remainSec) + " للمستوى التالي"));
      events.push({
        kind: "level", kicker: tierChanged ? "لقب جديد!" : "ترقية! المستوى الجديد",
        title: L.tier.name, value: L.lvl, sub: parts.join(" · "),
        icon: L.tier.icon, color: L.tier.color, okText: "متابعة"
      });
    }

    /* الشارات */
    var kB = "ho_badges_seen_" + uid;
    var earned = BADGES.filter(function(b){ return badgeOk(b, total, best, L.lvl); });
    var rawB = lsGet(kB);
    if (rawB == null){
      lsSet(kB, JSON.stringify(earned.map(function(b){ return b.name; })));
    } else {
      var seenB = [];
      try{ seenB = JSON.parse(rawB) || []; }catch(e){}
      var fresh = earned.filter(function(b){ return seenB.indexOf(b.name) < 0; });
      if (fresh.length){
        lsSet(kB, JSON.stringify(seenB.concat(fresh.map(function(b){ return b.name; }))));
        fresh.forEach(function(b){
          events.push({ kind: "badge", kicker: "شارة جديدة!", title: b.name, sub: "حققت: " + b.req, icon: b.emoji, color: b.color, okText: "رائع!", sound: "badge" });
        });
      }
    }

    if (events.length && window.HOUI){ events.forEach(function(e){ window.HOUI.celebrate(e); }); }
    return events.length > 0;
  }
  function recheck(){
    if (last.uid && last.val){ check(last.uid, last.val); return true; }
    return false;
  }

  window.HOLevel = {
    MAX: MAX, TIERS: TIERS, BADGES: BADGES,
    info: info, tierOf: tierOf, titleOf: titleOf, colorOf: colorOf, iconOf: iconOf,
    hoursFor: hoursFor, chip: chip, fmtHM: fmtHM, badgeOk: badgeOk,
    check: check, recheck: recheck
  };
})();

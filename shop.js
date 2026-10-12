/* ================================================================
   shop.js — متجر الجوائز (مركز المؤقتات)
   ----------------------------------------------------------------
   • العملة: «النجوم» من المهام (missions.js). الشراء يخصم الرصيد عبر HOMissions.spend().
   • الفتح بالمستوى والنجوم معًا: لكل عنصر minLevel (من levels.js) وسعر بالنجوم.
   • الأقسام: صور مميزة · إطارات للصورة · خلفيات للملف الشخصي · حزم أصوات.
   • الإطار الافتراضي «تلقائي» بلون لقب اللاعب (يتغير مع المستوى) ويراه الجميع في الترتيب.
   • لا يلمس أي إعداد يتحكم به المشرف (نمط/ثيم المؤقت). الأصوات الشخصية لا تعمل في شاشتي المشرف.
   • الحالة بالجهاز. الإطار المُجهَّز يُكتب أيضًا في studyLeaderboard/{uid}/frame ليراه الآخرون
     (إن رفضت قواعد Firebase الحقل فيبقى الإطار محليًا ولا يتأثر شيء).
   الواجهة: HOShop.state() · buy(key) · equip(type,id) · frameFor(rec,isMe) · applyFrame(el,id,total)
            applyBg(el) · ownedAvatars() · onChange(fn)
   ================================================================ */
(function(){
  "use strict";
  if (window.HOShop) return;

  var RAR = {
    rare:      { name: "نادر",   color: "#48cae4" },
    epic:      { name: "ملحمي",  color: "#a78bfa" },
    legendary: { name: "أسطوري", color: "#ffb400" },
    normal:    { name: "عادي",   color: "#9094a3" }
  };
  var TYPES = { avatar: "صورة", frame: "إطار", bg: "خلفية", pack: "حزمة صوت" };

  function av(emoji, name, rarity, price, min){ return { type: "avatar", id: emoji, emoji: emoji, name: name, rarity: rarity, price: price, minLevel: min }; }
  function it(type, id, name, rarity, price, min, extra){
    var o = { type: type, id: id, name: name, rarity: rarity, price: price, minLevel: min };
    for (var k in (extra || {})) o[k] = extra[k];
    return o;
  }
  var ITEMS = [
    /* صور مميزة */
    av("🦅", "الصقر", "rare", 30, 3), av("🐺", "الذئب", "rare", 30, 3), av("🦈", "القرش", "rare", 30, 3),
    av("🦖", "الديناصور", "rare", 30, 3), av("🦚", "الطاووس", "rare", 30, 3), av("🐙", "الأخطبوط", "rare", 30, 3),
    av("🐉", "التنين", "epic", 60, 8), av("🧞", "المارد", "epic", 60, 8), av("🧛", "الكونت", "epic", 60, 8),
    av("🧜‍♀️", "حورية البحر", "epic", 60, 8), av("🧝", "الجنّية", "epic", 60, 8), av("🦹", "المتخفّي", "epic", 60, 8),
    av("🐲", "تنين الأساطير", "legendary", 120, 15), av("🔱", "رمح البحار", "legendary", 120, 15), av("👑", "التاج", "legendary", 120, 15),
    av("🌌", "المجرّة", "legendary", 120, 15), av("🌠", "النجم الساقط", "legendary", 120, 15), av("💎", "الماسة", "legendary", 120, 15),
    /* إطارات */
    it("frame", "gold",    "ذهب ملكي",     "rare",      20, 3),
    it("frame", "ruby",    "ياقوت",        "rare",      25, 4),
    it("frame", "emerald", "زمرد",         "rare",      25, 4),
    it("frame", "ice",     "جليد",         "rare",      30, 5),
    it("frame", "flame",   "لهب",          "epic",      40, 8),
    it("frame", "volt",    "برق",          "epic",      50, 8),
    it("frame", "rainbow", "قوس قزح",      "epic",      60, 10),
    it("frame", "crown",   "تاج الرافدين", "legendary", 120, 20),
    /* خلفيات الملف الشخصي */
    it("bg", "dusk",  "غسق الفرات",  "rare", 30, 3),
    it("bg", "night", "ليل دجلة",    "rare", 30, 3),
    it("bg", "sand",  "رمال بابل",   "epic", 45, 6),
    it("bg", "palm",  "نخيل البصرة", "epic", 60, 10),
    /* حزم الأصوات */
    it("pack", "ney",     "ناي الرافدين", "rare", 40, 5),
    it("pack", "crystal", "كريستال",      "rare", 40, 5),
    it("pack", "retro",   "ريترو",        "epic", 50, 8)
  ];
  ITEMS.forEach(function(x){ x.key = x.type + ":" + x.id; });
  var FRAMES = ITEMS.filter(function(x){ return x.type === "frame"; }).map(function(x){ return x.id; });
  var DEFAULTS = {
    frame: { id: "", name: "تلقائي بلون لقبك", sub: "يتغير لونه مع كل رتبة" },
    bg:    { id: "", name: "الافتراضية",        sub: "الخلفية الأصلية" },
    pack:  { id: "", name: "الجرس الكلاسيكي",    sub: "الصوت الأصلي" }
  };

  function jget(k, d){ try{ var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }catch(e){ return d; } }
  function jset(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
  function uid(){ return jget("ho_ms_cur", null) || "guest"; }
  var memInv = {};
  function inv(){
    var k = "ho_shop_" + uid();
    var v = jget(k, null) || memInv[k] || {};
    v.owned = v.owned || {}; v.eq = v.eq || {}; v.eqAt = v.eqAt || 0;
    return v;
  }
  function saveInv(v){ var k = "ho_shop_" + uid(); memInv[k] = v; jset(k, v); }
  /* آخر مستوى معروف (يكتبه levels.js) — يعمل حتى بدون اتصال */
  function level(){
    try{ var n = parseInt(localStorage.getItem("ho_lvl_seen_" + uid()), 10); return n > 0 ? n : 1; }catch(e){ return 1; }
  }
  function tierColor(total){
    try{ return window.HOLevel ? window.HOLevel.info(total || 0).tier.color : "#ffb400"; }catch(e){ return "#ffb400"; }
  }

  var listeners = [];
  function emit(){ listeners.forEach(function(f){ try{ f(); }catch(e){} }); }

  function state(){
    var S = window.HOMissions ? window.HOMissions.state() : { stars: 0 };
    var I = inv(), L = level();
    var items = ITEMS.map(function(x){
      var o = {};
      for (var k in x) o[k] = x[k];
      o.owned = !!I.owned[x.key];
      o.equipped = x.type !== "avatar" && (I.eq[x.type] || "") === x.id && o.owned;
      o.locked = L < x.minLevel;
      o.affordable = S.stars >= x.price;
      return o;
    });
    return { stars: S.stars, level: L, items: items, eq: I.eq, defaults: DEFAULTS };
  }

  function buy(key){
    var x = ITEMS.filter(function(i){ return i.key === key; })[0];
    if (!x) return { ok: false, reason: "missing" };
    var I = inv();
    if (I.owned[key]) return { ok: false, reason: "owned" };
    if (level() < x.minLevel) return { ok: false, reason: "level", need: x.minLevel };
    if (!window.HOMissions || !window.HOMissions.spend(x.price, key)) return { ok: false, reason: "stars" };
    I.owned[key] = 1;
    saveInv(I);
    emit();
    return { ok: true, item: x };
  }
  /* equip('frame','gold') · equip('frame','') = الافتراضي */
  function equip(type, id){
    var I = inv();
    if (id && !I.owned[type + ":" + id]) return { ok: false, reason: "not-owned" };
    I.eq[type] = id || "";
    I.eqAt = Date.now();
    saveInv(I);
    if (type === "pack" && window.HOSound) window.HOSound.set("pack", id || "bell");
    emit();
    return { ok: true };
  }
  function ownedAvatars(){
    var I = inv();
    return ITEMS.filter(function(x){ return x.type === "avatar" && I.owned[x.key]; }).map(function(x){ return x.emoji; });
  }

  /* ----------------------------- الإطارات والخلفيات ----------------------------- */
  function frameFor(rec, isMe){
    var id = (isMe && inv().eq.frame) || (rec && rec.frame) || "";
    if (FRAMES.indexOf(id) >= 0) return { cls: "fr fr-" + id, style: "" };
    return { cls: "fr fr-auto", style: "--fc:" + tierColor(rec && rec.totalSeconds) };
  }
  function applyFrame(el, id, total){
    if (!el) return;
    var keep = String(el.className || "").split(/\s+/).filter(function(c){ return c && !/^fr(-|$)/.test(c); });
    var known = FRAMES.indexOf(id) >= 0;
    el.className = keep.concat(["fr", known ? "fr-" + id : "fr-auto"]).join(" ");
    if (known) el.style.removeProperty("--fc"); else el.style.setProperty("--fc", tierColor(total));
  }
  function applyBg(el){
    if (!el) return;
    var id = inv().eq.bg || "";
    var keep = String(el.className || "").split(/\s+/).filter(function(c){ return c && c !== "has-bg" && !/^bg-/.test(c); });
    el.className = keep.concat(id ? ["has-bg", "bg-" + id] : []).join(" ");
  }

  /* ----- المزامنة بين الأجهزة: المشتريات اتحاد، والتجهيز يفوز فيه الأحدث ----- */
  function exportInv(){ var I = inv(); return { owned: I.owned, eq: I.eq, eqAt: I.eqAt }; }
  function mergeInv(doc){
    if (!doc) return false;
    var I = inv(), ch = false, known = {};
    ITEMS.forEach(function(x){ known[x.key] = x; });
    Object.keys(doc.owned || {}).forEach(function(k){
      if (known[k] && !I.owned[k]){ I.owned[k] = 1; ch = true; }
    });
    var at = Number(doc.eqAt) || 0;
    if (at > (I.eqAt || 0) && doc.eq){
      ["frame", "bg", "pack"].forEach(function(t){
        var v = String(doc.eq[t] || "");
        if (v && !I.owned[t + ":" + v]) v = "";                    /* لا نجهّز ما لا نملكه */
        if ((I.eq[t] || "") !== v){ I.eq[t] = v; ch = true; }
      });
      I.eqAt = at;
      if (window.HOSound) window.HOSound.set("pack", I.eq.pack || "bell");
    }
    if (ch){ saveInv(I); emit(); }
    return ch;
  }

  window.HOShop = {
    exportInv: exportInv, mergeInv: mergeInv,
    RAR: RAR, TYPES: TYPES, ITEMS: ITEMS, FRAMES: FRAMES, DEFAULTS: DEFAULTS,
    state: state, buy: buy, equip: equip, ownedAvatars: ownedAvatars,
    frameFor: frameFor, applyFrame: applyFrame, applyBg: applyBg,
    eqFrame: function(){ return inv().eq.frame || ""; },
    onChange: function(fn){ if (typeof fn === "function") listeners.push(fn); }
  };
})();

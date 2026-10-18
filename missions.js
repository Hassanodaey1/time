/* ================================================================
   missions.js — المهام اليومية والأسبوعية (مركز المؤقتات)
   ----------------------------------------------------------------
   التصميم (بدون أي تعديل على السيرفر):
   • وقت الدراسة يُحسب من رصيد السيرفر الموثوق (studyLeaderboard: totalSeconds / weeklySeconds)
     كفرق عن بداية اليوم، مضافًا إليه جلسات مؤقت الطالب المحلية. لا يمكن تزويره بتغيير الواجهة.
   • الجلسات المحلية (بومودورو، إنجاز مهمة) تُسجَّل من student-timer عبر HOMissions.event / addStudy
     (addStudy تُهمَل لمن لديه ملف شخصي لأن وقته يصل من السيرفر، منعًا للعدّ المزدوج).
   • المكافآت «نجوم» مظهرية فقط (لا تدخل في الترتيب ولا في المستوى)، فالتلاعب بها لا يعطي أفضلية.
   • اليوم والأسبوع بتوقيت بغداد (UTC+3) وبنفس معادلة weekIndex المستخدمة في السيرفر.
   • الحالة محفوظة بالجهاز. لنقلها للسيرفر لاحقًا يكفي استبدال load()/save()/claim() دون لمس الواجهة.
   • مهام يضعها المشرف: Firebase  missionPlans/daily/{يوم}  و  missionPlans/weekly/{أسبوع}  (من صفحة admin.html).
     إن لم توجد خطة لليوم/الأسبوع تعمل المهام التلقائية (البنوك أدناه) كاحتياط، فلا تظهر قائمة فارغة أبدًا.
     كل قيمة قادمة من الخطة تُفحص وتُقيَّد بحدود صارمة (cleanPlan) قبل استخدامها، وآخر خطة تُحفظ بالجهاز للعمل بلا إنترنت.
   الواجهة:
     HOMissions.update(uid, record)  ← من مستمع studyLeaderboard/{uid}
     HOMissions.event('pomo' | 'task', id?)   HOMissions.addStudy(seconds)
     HOMissions.startPlans(db)   ← يبدأ مراقبة خطة اليوم/الأسبوع (مرة واحدة بعد تسجيل الدخول)
     HOMissions.state() / claim(id) / onChange(fn)
   ================================================================ */
(function(){
  "use strict";
  if (window.HOMissions) return;

  var BAGHDAD = 3 * 3600 * 1000, DAY = 86400000;
  function dayIdx(){ return Math.floor((Date.now() + BAGHDAD) / DAY); }
  function weekOf(d){ return Math.floor(d / 7); }              /* = floor((now+3h)/604800000) كما في السيرفر */
  var MIN_DAY_STUDY = 600;                                      /* 10 دقائق تُحتسب يوم دراسة */
  var BONUS_STARS = 2;

  function ic(p){ return '<svg class="ho-ic" viewBox="0 0 24 24" aria-hidden="true">' + p + '</svg>'; }
  var ICON = {
    study: ic('<circle cx="12" cy="12" r="8.2"/><path d="M12 7.5V12l3 2"/>'),
    pomo:  ic('<circle cx="12" cy="13.5" r="6.8"/><path d="M12 10.5v3l2 1.3"/><path d="M9.5 3.5h5"/><path d="M12 3.5v3.2"/>'),
    task:  ic('<rect x="4.5" y="4.5" width="15" height="15" rx="3"/><path d="M8.5 12.3l2.6 2.6 4.6-5.2"/>'),
    hours: ic('<path d="M6 3h12M6 21h12"/><path d="M7 3c0 4 3.2 5.2 5 6.3-1.8 1.1-5 2.3-5 6.3"/><path d="M17 3c0 4-3.2 5.2-5 6.3 1.8 1.1 5 2.3 5 6.3"/>'),
    days:  ic('<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/><path d="M9 14.5l2 2 4-4"/>')
  };
  var COLOR = { study: "#ffb400", pomo: "#ff6b3d", task: "#2ecc71", hours: "#48cae4", days: "#a78bfa" };

  /* بنوك المهام: الاختيار ثابت لليوم (بذرة = المستخدم + اليوم) فلا تتغير بإعادة فتح الصفحة */
  var POOL_A = [{ k: "study", t: 15 }, { k: "study", t: 20 }, { k: "study", t: 30 }];
  var POOL_B = [{ k: "study", t: 45 }, { k: "study", t: 60 }, { k: "pomo", t: 2 }];
  var POOL_C = [{ k: "task", t: 1 }, { k: "task", t: 2 }, { k: "pomo", t: 1 }];
  var WEEK_HOURS = [3, 5, 8], WEEK_DAYS = [3, 4, 5];

  /* ----- خطط المشرف: الأنواع المسموحة وحدودها (يجب أن تطابق admin.html وقواعد الـ RTDB) ----- */
  var DAILY_KINDS  = { study: { min: 5, max: 300 }, pomo: { min: 1, max: 12 }, task: { min: 1, max: 15 } };
  var WEEKLY_KINDS = { hours: { min: 1, max: 40 }, days: { min: 1, max: 7 }, wpomo: { min: 1, max: 60 }, wtask: { min: 1, max: 60 } };
  var SLOTS = ["A", "B", "C"];
  var VIS = { study: "study", pomo: "pomo", task: "task", hours: "hours", days: "days", wpomo: "pomo", wtask: "task" };
  var plans = { day: 0, week: 0, daily: null, weekly: null };

  function cleanPlan(raw, kinds){
    if (!raw || typeof raw !== "object") return null;
    var src = raw.items;
    if (!src || typeof src !== "object") return null;
    var items = [];
    SLOTS.forEach(function(slot){
      var it = src[slot];
      if (!it || typeof it !== "object") return;
      var k = String(it.k || "");
      if (!Object.prototype.hasOwnProperty.call(kinds, k)) return;
      var spec = kinds[k], t = Math.floor(Number(it.t)), s = Math.floor(Number(it.s));
      if (!(t >= spec.min && t <= spec.max) || !(s >= 1 && s <= 10)) return;
      items.push({
        slot: slot, k: k, t: t, s: s,
        title: typeof it.title === "string" ? it.title.trim().slice(0, 40) : "",
        note: typeof it.note === "string" ? it.note.trim().slice(0, 90) : ""
      });
    });
    if (!items.length) return null;
    var bonus = Math.floor(Number(raw.bonus));
    if (!(bonus >= 0 && bonus <= 10)) bonus = BONUS_STARS;
    return { items: items, bonus: bonus };
  }

  function hash(s){ var h = 5381; for (var i = 0; i < s.length; i++){ h = ((h << 5) + h + s.charCodeAt(i)) | 0; } return Math.abs(h); }
  function pick(pool, seed){ return pool[hash(seed) % pool.length]; }

  /* ----------------------------- التخزين ----------------------------- */
  function jget(k, d){ try{ var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }catch(e){ return d; } }
  function jset(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
  var mem = {};                                                  /* احتياط إن كان التخزين غير متاح */
  /* ===== دفتر النجوم (قابل للمزامنة بين الأجهزة بدمج بسيط بلا تضارب) =====
     الرصيد = مجموع legacy (رصيد كل جهاز عند أول ترحيل) + مجموع claims (نجوم المهام المستلمة) − مجموع spent (المشتريات).
     كل خريطة مفاتيحها فريدة، فدمج جهازين = اتحاد المفاتيح بلا عدّ مزدوج. */
  function devId(){
    var d = null;
    try{ d = localStorage.getItem("ho_dev"); }catch(e){}
    if (!d){
      d = Math.random().toString(36).slice(2, 10);
      try{ localStorage.setItem("ho_dev", d); }catch(e){}
    }
    return d;
  }
  function sumMap(o){ var t = 0; for (var k in o){ var v = Number(o[k]); if (v > 0) t += v; } return t; }
  function balance(st){ return Math.max(0, sumMap(st.legacy) + sumMap(st.claims) - sumMap(st.spent)); }
  function cleanNum(v, max){ v = Number(v); return v > 0 && v <= max ? Math.floor(v) : 0; }
  function curUid(){ return jget("ho_ms_cur", null) || "guest"; }
  function loadSt(uid){
    var k = "ho_ms_" + uid;
    var st = jget(k, null) || mem[k] || {};
    st.day = st.day || 0; st.base = st.base || 0; st.total = st.total || 0;
    st.claimed = st.claimed || {}; st.notified = st.notified || {}; st.days = st.days || [];
    st.stars = st.stars || 0; st.bonusDay = st.bonusDay || 0;
    st.claims = st.claims || {}; st.spent = st.spent || {};
    if (!st.legacy){ st.legacy = {}; st.legacy[devId()] = st.stars || 0; }   /* ترحيل الرصيد القديم مرة واحدة */
    st.stars = balance(st);
    st.wkIdx = st.wkIdx || 0; st.wkSec = st.wkSec || 0;
    return st;
  }
  function saveSt(uid, st){
    var k = "ho_ms_" + uid;
    mem[k] = st;
    ["claimed", "notified"].forEach(function(f){
      var keys = Object.keys(st[f]);
      if (keys.length > 60){ keys.slice(0, keys.length - 60).forEach(function(x){ delete st[f][x]; }); }
    });
    st.days = st.days.slice(-21);
    jset(k, st);
  }
  /* الأحداث المحلية (بدون uid لأن student-timer لا يعرفه) */
  function loadEv(){
    var ev = jget("ho_ms_ev", null) || {};
    var d = dayIdx();
    if (ev.day !== d){ ev = { day: d, pomo: 0, localSec: 0, tasks: [], wkIdx: ev.wkIdx, wkSec: ev.wkSec, wkPomo: ev.wkPomo, wkTask: ev.wkTask }; }
    var w = weekOf(d);
    if (ev.wkIdx !== w){ ev.wkIdx = w; ev.wkSec = 0; ev.wkPomo = 0; ev.wkTask = 0; }
    ev.tasks = ev.tasks || []; ev.pomo = ev.pomo || 0; ev.localSec = ev.localSec || 0; ev.wkSec = ev.wkSec || 0;
    ev.wkPomo = ev.wkPomo || 0; ev.wkTask = ev.wkTask || 0;
    return ev;
  }
  function saveEv(ev){ jset("ho_ms_ev", ev); }

  /* ----------------------------- الحساب ----------------------------- */
  /* فرق السيرفر يُحتسب فقط إن كان خط الأساس من اليوم نفسه (وإلا ننتظر أول تحديث من السيرفر) */
  function studySecToday(st, ev){ return (st.day === dayIdx() ? Math.max(0, st.total - st.base) : 0) + ev.localSec; }

  /* ----- صياغة العناوين (يجب أن تطابق معاينة admin.html) ----- */
  function cnt(n, one, two, few, many){ return n === 1 ? one : n === 2 ? two : n <= 10 ? (n + " " + few) : (n + " " + many); }
  function dailyDescribe(k, t, ev, todaySec){
    var prog, title, desc, label;
    if (k === "study"){
      prog = Math.floor(todaySec / 60);
      title = "ادرس " + cnt(t, "دقيقة واحدة", "دقيقتين", "دقائق", "دقيقة") + " اليوم"; desc = "من مؤقت التحدي أو مؤقت الطالب";
      label = Math.min(prog, t) + " / " + t + " د";
    } else if (k === "pomo"){
      prog = ev.pomo;
      title = "أنهِ " + cnt(t, "جلسة تركيز", "جلستي تركيز", "جلسات تركيز", "جلسة تركيز") + " بومودورو"; desc = "جلسة كاملة بدون تخطي";
      label = Math.min(prog, t) + " / " + t;
    } else {
      prog = ev.tasks.length;
      title = "أنجز " + cnt(t, "مهمة", "مهمتين", "مهام", "مهمة") + " من لائحتك"; desc = "علّم المهمة كمنجزة في مؤقت الطالب";
      label = Math.min(prog, t) + " / " + t;
    }
    return { prog: prog, title: title, desc: desc, label: label };
  }
  function weeklyDescribe(k, t, wkSec, daysCnt, ev){
    var prog, title, desc, label;
    if (k === "hours"){
      prog = wkSec / 3600;
      title = "ادرس " + cnt(t, "ساعة واحدة", "ساعتين", "ساعات", "ساعة") + " هذا الأسبوع"; desc = "المجموع من كل مؤقتاتك";
      label = Math.min(prog, t).toFixed(1) + " / " + t + " س";
    } else if (k === "days"){
      prog = daysCnt;
      title = t === 1 ? "ادرس في يوم واحد" : t === 2 ? "ادرس في يومين مختلفين" : "ادرس في " + t + " أيام مختلفة"; desc = "يوم الدراسة = 10 دقائق فأكثر";
      label = Math.min(prog, t) + " / " + t + " أيام";
    } else if (k === "wpomo"){
      prog = ev.wkPomo;
      title = "أنهِ " + cnt(t, "جلسة تركيز", "جلستي تركيز", "جلسات تركيز", "جلسة تركيز") + " بومودورو هذا الأسبوع"; desc = "جلسات كاملة بدون تخطي";
      label = Math.min(prog, t) + " / " + t;
    } else {
      prog = ev.wkTask;
      title = "أنجز " + cnt(t, "مهمة", "مهمتين", "مهام", "مهمة") + " من لائحتك هذا الأسبوع"; desc = "علّم مهامك كمنجزة في مؤقت الطالب";
      label = Math.min(prog, t) + " / " + t;
    }
    return { prog: prog, title: title, desc: desc, label: label };
  }

  /* ----- خطة المشرف: تخزين محلي + مراقبة فايربيس ----- */
  function loadPlanCache(){
    var c = jget("ho_ms_plans", null) || {}, d = dayIdx(), w = weekOf(d);
    plans.day = d; plans.week = w;
    plans.daily = c.day === d ? cleanPlan(c.dailyRaw, DAILY_KINDS) : null;
    plans.weekly = c.week === w ? cleanPlan(c.weeklyRaw, WEEKLY_KINDS) : null;
  }
  function planFor(scope){
    if (plans.day !== dayIdx()) loadPlanCache();
    return scope === "daily" ? plans.daily : plans.weekly;
  }
  function setPlanRaw(scope, idx, raw){
    var c = jget("ho_ms_plans", null) || {};
    if (scope === "daily"){ c.day = idx; c.dailyRaw = raw === undefined ? null : raw; }
    else { c.week = idx; c.weeklyRaw = raw === undefined ? null : raw; }
    jset("ho_ms_plans", c);
    loadPlanCache();
    changed();
  }
  var plansDb = null, watched = { d: null, w: null, dRef: null, wRef: null, dCb: null, wCb: null };
  function watchPlans(){
    if (!plansDb) return;
    var d = dayIdx(), w = weekOf(d);
    try{
      if (watched.d !== d){
        if (watched.dRef){ try{ watched.dRef.off("value", watched.dCb); }catch(e){} }
        var rd = plansDb.ref("missionPlans/daily/" + d);
        var cd = function(snap){ setPlanRaw("daily", d, snap.val()); };
        rd.on("value", cd, function(){});
        watched.d = d; watched.dRef = rd; watched.dCb = cd;
      }
      if (watched.w !== w){
        if (watched.wRef){ try{ watched.wRef.off("value", watched.wCb); }catch(e){} }
        var rw = plansDb.ref("missionPlans/weekly/" + w);
        var cw = function(snap){ setPlanRaw("weekly", w, snap.val()); };
        rw.on("value", cw, function(){});
        watched.w = w; watched.wRef = rw; watched.wCb = cw;
      }
    }catch(e){}
  }
  function startPlans(db){
    if (!db || plansDb) return;
    plansDb = db;
    loadPlanCache();
    watchPlans();
    setInterval(watchPlans, 30000);
    try{ document.addEventListener("visibilitychange", function(){ if (!document.hidden){ loadPlanCache(); watchPlans(); emit(); } }); }catch(e){}
  }

  /* هل استُلمت المهمة؟ (بمعرّفها أو بأي معرّف يبدأ بإحدى البادئات — يمنع الاستلام المزدوج لو بدّل المشرف الخطة) */
  function hasClaim(st, id, prefixes){
    if (st.claimed[id] || st.claims[id] !== undefined) return true;
    if (!prefixes) return false;
    var maps = [st.claimed, st.claims];
    for (var i = 0; i < prefixes.length; i++){
      for (var j = 0; j < 2; j++){
        for (var key in maps[j]){ if (key.indexOf(prefixes[i]) === 0) return true; }
      }
    }
    return false;
  }

  function compute(uid){
    var st = loadSt(uid), ev = loadEv(), d = dayIdx(), w = weekOf(d);
    var todaySec = studySecToday(st, ev);
    var pd = planFor("daily"), pw = planFor("weekly");

    var specs;
    if (pd){
      specs = pd.items.map(function(it){
        return { s: { k: it.k, t: it.t }, stars: it.s, slot: it.slot, title: it.title, note: it.note, planned: true };
      });
    } else {
      var seed = uid + ":" + d;
      var a = pick(POOL_A, seed + "A"), b = pick(POOL_B, seed + "B"), c = pick(POOL_C, seed + "C");
      if (b.k === "pomo" && c.k === "pomo") c = { k: "task", t: 1 };
      specs = [{ s: a, stars: 1, slot: "A" }, { s: b, stars: 2, slot: "B" }, { s: c, stars: 1, slot: "C" }];
    }

    var daily = specs.map(function(x){
      var s = x.s, f = dailyDescribe(s.k, s.t, ev, todaySec);
      var base = "d:" + d + ":" + x.slot + ":";
      var id = base + (x.planned ? "p" : (s.k + s.t));
      return mk(id, s.k, x.title || f.title, x.note || f.desc, f.prog, s.t, f.label, x.stars, "daily", st, [base], !!x.planned);
    });
    var dayBonus = daily.length >= 2 ? (pd ? pd.bonus : BONUS_STARS) : 0;

    /* الأسبوعية: وقت الدراسة = سيرفر (weeklySeconds) + محلي، وأيام الدراسة من سجل الأيام */
    var wkSec = (st.wkIdx === w ? st.wkSec : 0) + (ev.wkIdx === w ? ev.wkSec : 0);
    var daysCnt = st.days.filter(function(x){ return weekOf(x) === w; }).length;
    var weekly;
    if (pw){
      weekly = pw.items.map(function(it){
        var f = weeklyDescribe(it.k, it.t, wkSec, daysCnt, ev);
        var base = "w:" + w + ":" + it.slot + ":";
        var pre = [base];
        if (it.k === "hours") pre.push("w:" + w + ":H"); else if (it.k === "days") pre.push("w:" + w + ":D");
        return mk(base + "p", it.k, it.title || f.title, it.note || f.desc, f.prog, it.t, f.label, it.s, "weekly", st, pre, true);
      });
    } else {
      var hT = pick(WEEK_HOURS, uid + ":" + w + ":H"), dT = pick(WEEK_DAYS, uid + ":" + w + ":D");
      var fh = weeklyDescribe("hours", hT, wkSec, daysCnt, ev), fd = weeklyDescribe("days", dT, wkSec, daysCnt, ev);
      weekly = [
        mk("w:" + w + ":H" + hT, "hours", fh.title, fh.desc, fh.prog, hT, fh.label, 5, "weekly", st, null, false),
        mk("w:" + w + ":D" + dT, "days", fd.title, fd.desc, fd.prog, dT, fd.label, 4, "weekly", st, null, false)
      ];
    }

    var claimable = 0, dailyDone = 0, dailyClaimed = 0, weeklyDone = 0;
    daily.forEach(function(m){ if (m.done) dailyDone++; if (m.claimed) dailyClaimed++; if (m.done && !m.claimed) claimable++; });
    weekly.forEach(function(m){ if (m.done) weeklyDone++; if (m.done && !m.claimed) claimable++; });
    return {
      uid: uid, day: d, week: w, stars: balance(st), daily: daily, weekly: weekly,
      dailyDone: dailyDone, dailyClaimed: dailyClaimed, weeklyDone: weeklyDone, claimable: claimable,
      planned: { daily: !!pd, weekly: !!pw },
      bonusTaken: st.bonusDay === d || st.claims["b:" + d] !== undefined, bonusStars: dayBonus, _st: st
    };
  }
  function mk(id, kind, title, desc, prog, target, label, stars, scope, st, prefixes, fromAdmin){
    var done = prog >= target, vis = VIS[kind] || kind;
    return {
      id: id, kind: kind, scope: scope, title: title, desc: desc, icon: ICON[vis], color: COLOR[vis],
      progress: prog, target: target, pct: Math.max(0, Math.min(100, (prog / target) * 100)),
      label: label, stars: stars, done: done, claimed: hasClaim(st, id, prefixes), admin: !!fromAdmin
    };
  }
  function publicState(){ var s = compute(curUid()); delete s._st; return s; }

  /* ----------------------------- التنبيه والتغيير ----------------------------- */
  var listeners = [];
  function emit(){ listeners.forEach(function(f){ try{ f(); }catch(e){} }); }
  function notifyDone(){
    var uid = curUid(), S = compute(uid), st = S._st, changed = false;
    S.daily.concat(S.weekly).forEach(function(m){
      if (m.done && !st.notified[m.id]){
        st.notified[m.id] = 1; changed = true;
        if (window.HOUI && !m.claimed){
          HOUI.toast({
            id: "ms-" + m.id, type: "success", icon: "level", soft: true, duration: 5200, sound: "mission",
            title: "أنجزت مهمة!", text: m.title + " — استلم نجومك من «المهام»",
            onClick: typeof window.openMissions === "function" ? window.openMissions : undefined
          });
        }
      }
    });
    if (changed) saveSt(uid, st);
  }
  function changed(){ notifyDone(); emit(); }

  /* ----------------------------- مصادر التقدّم ----------------------------- */
  function update(uid, val){
    if (!uid || !val) return;
    var prev = jget("ho_ms_cur", null);
    if (prev !== uid) jset("ho_ms_cur", uid);
    var st = loadSt(uid), d = dayIdx();
    var total = val.totalSeconds || 0;
    if (st.day !== d){ st.day = d; st.base = total; }          /* أول ظهور لليوم: خط الأساس */
    if (total < st.base) st.base = total;                       /* تعديل المشرف خفّض الرصيد */
    st.total = total;
    var wk = weekOf(d);
    st.wkIdx = (val.weekIndex === wk) ? wk : st.wkIdx;
    st.wkSec = (val.weekIndex === wk) ? (val.weeklySeconds || 0) : (st.wkIdx === wk ? st.wkSec : 0);
    if (studySecToday(st, loadEv()) >= MIN_DAY_STUDY && st.days.indexOf(d) < 0) st.days.push(d);
    saveSt(uid, st);
    changed();
  }
  function event(kind, id){
    var ev = loadEv();
    if (kind === "pomo"){ ev.pomo++; ev.wkPomo++; }
    else if (kind === "task"){
      if (id == null || ev.tasks.indexOf(id) >= 0) return;      /* كل مهمة تُحتسب مرة واحدة باليوم */
      ev.tasks.push(id); ev.wkTask++;
    } else return;
    saveEv(ev);
    changed();
  }
  /* من لديه ملف شخصي يُودَع وقت مؤقت الطالب في رصيد السيرفر (time-bank.js) وسيصل هنا عبر update()،
     فلو أضفناه محليًا أيضًا لحُسب مرتين. المحلي يُستخدم فقط للضيف بلا ملف (لا يُودَع له شيء). */
  function hasProfile(){ try{ return !!localStorage.getItem("studyChallengeProfile"); }catch(e){ return false; } }
  function addStudy(seconds){
    seconds = Math.round(seconds || 0);
    if (seconds <= 0 || hasProfile()) return;
    var ev = loadEv();
    ev.localSec += seconds; ev.wkSec += seconds;
    saveEv(ev);
    var uid = curUid(), st = loadSt(uid), d = dayIdx();
    if (st.day !== d){ st.day = d; st.base = st.total; }
    if (studySecToday(st, ev) >= MIN_DAY_STUDY && st.days.indexOf(d) < 0){ st.days.push(d); }
    saveSt(uid, st);
    changed();
  }

  /* ----------------------------- الاستلام ----------------------------- */
  function claim(id){
    var uid = curUid(), S = compute(uid), st = S._st;
    var m = S.daily.concat(S.weekly).filter(function(x){ return x.id === id; })[0];
    if (!m || !m.done || m.claimed) return { ok: false };
    st.claimed[id] = 1;
    st.claims[id] = m.stars;
    var gotBonus = false;
    if (m.scope === "daily"){
      var allClaimed = S.daily.every(function(x){ return x.id === id || x.claimed; });
      if (allClaimed && !S.bonusTaken && S.bonusStars > 0){ st.bonusDay = S.day; st.claims["b:" + S.day] = S.bonusStars; gotBonus = true; }
    }
    st.stars = balance(st);
    saveSt(uid, st);
    if (window.HOUI){
      HOUI.dismiss("ms-" + id);
      HOUI.toast({ type: "reward", icon: "reward", title: "+" + m.stars + " ★", text: m.title, duration: 3000, sound: "mission" });
      if (gotBonus){
        HOUI.celebrate({
          kind: "reward", icon: "🎁", color: "#a78bfa", sound: "chest",
          kicker: "أنجزت كل مهام اليوم!", title: "مكافأة اليوم", value: "+" + S.bonusStars + " ★",
          sub: "رصيدك الآن " + st.stars + " نجمة", okText: "رائع!"
        });
      }
    }
    emit();
    return { ok: true, stars: m.stars, bonus: gotBonus ? S.bonusStars : 0, total: st.stars };
  }

  /* خصم نجوم (للمتجر). يرجع true عند النجاح */
  function spend(n, key){
    n = Math.floor(n || 0);
    var uid = curUid(), st = loadSt(uid);
    if (n <= 0 || balance(st) < n) return false;
    st.spent[key || ("x:" + Date.now())] = n;
    st.stars = balance(st);
    saveSt(uid, st);
    emit();
    return true;
  }

  /* ----- المزامنة: تصدير الدفتر ودمج دفتر قادم من جهاز آخر (اتحاد المفاتيح) ----- */
  function exportLedger(){
    var st = loadSt(curUid());
    return { legacy: st.legacy, claims: st.claims, spent: st.spent };
  }
  function mergeLedger(doc){
    if (!doc) return false;
    var uid = curUid(), st = loadSt(uid), ch = false;
    [["legacy", 100000], ["claims", 10], ["spent", 500]].forEach(function(p){
      var src = doc[p[0]];
      if (!src) return;
      Object.keys(src).forEach(function(k){
        if (st[p[0]][k] !== undefined) return;
        var v = cleanNum(src[k], p[1]);
        if (p[0] === "legacy" ? !(Number(src[k]) >= 0) : v <= 0) return;
        st[p[0]][k] = p[0] === "legacy" ? cleanNum(src[k], 100000) : v;
        ch = true;
      });
    });
    Object.keys(st.claims).forEach(function(k){
      if (k.indexOf("b:") !== 0 && !st.claimed[k]){ st.claimed[k] = 1; ch = true; }   /* مهمة استلمها جهاز آخر */
    });
    if (ch){ st.stars = balance(st); saveSt(uid, st); emit(); }
    return ch;
  }

  window.HOMissions = {
    exportLedger: exportLedger, mergeLedger: mergeLedger,
    update: update, event: event, addStudy: addStudy, state: publicState, claim: claim, spend: spend, startPlans: startPlans,
    onChange: function(fn){ if (typeof fn === "function") listeners.push(fn); }
  };
})();

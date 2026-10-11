/* ================================================================
   missions.js — المهام اليومية والأسبوعية (مركز المؤقتات)
   ----------------------------------------------------------------
   التصميم (بدون أي تعديل على السيرفر):
   • وقت الدراسة يُحسب من رصيد السيرفر الموثوق (studyLeaderboard: totalSeconds / weeklySeconds)
     كفرق عن بداية اليوم، مضافًا إليه جلسات مؤقت الطالب المحلية. لا يمكن تزويره بتغيير الواجهة.
   • الجلسات المحلية (بومودورو، إنجاز مهمة) تُسجَّل من student-timer عبر HOMissions.event / addStudy.
   • المكافآت «نجوم» مظهرية فقط (لا تدخل في الترتيب ولا في المستوى)، فالتلاعب بها لا يعطي أفضلية.
   • اليوم والأسبوع بتوقيت بغداد (UTC+3) وبنفس معادلة weekIndex المستخدمة في السيرفر.
   • الحالة محفوظة بالجهاز. لنقلها للسيرفر لاحقًا يكفي استبدال load()/save()/claim() دون لمس الواجهة.
   الواجهة:
     HOMissions.update(uid, record)  ← من مستمع studyLeaderboard/{uid}
     HOMissions.event('pomo' | 'task', id?)   HOMissions.addStudy(seconds)
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

  function hash(s){ var h = 5381; for (var i = 0; i < s.length; i++){ h = ((h << 5) + h + s.charCodeAt(i)) | 0; } return Math.abs(h); }
  function pick(pool, seed){ return pool[hash(seed) % pool.length]; }

  /* ----------------------------- التخزين ----------------------------- */
  function jget(k, d){ try{ var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }catch(e){ return d; } }
  function jset(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
  var mem = {};                                                  /* احتياط إن كان التخزين غير متاح */
  function curUid(){ return jget("ho_ms_cur", null) || "guest"; }
  function loadSt(uid){
    var k = "ho_ms_" + uid;
    var st = jget(k, null) || mem[k] || {};
    st.day = st.day || 0; st.base = st.base || 0; st.total = st.total || 0;
    st.claimed = st.claimed || {}; st.notified = st.notified || {}; st.days = st.days || [];
    st.stars = st.stars || 0; st.bonusDay = st.bonusDay || 0;
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
    if (ev.day !== d){ ev = { day: d, pomo: 0, localSec: 0, tasks: [], wkIdx: ev.wkIdx, wkSec: ev.wkSec }; }
    var w = weekOf(d);
    if (ev.wkIdx !== w){ ev.wkIdx = w; ev.wkSec = 0; }
    ev.tasks = ev.tasks || []; ev.pomo = ev.pomo || 0; ev.localSec = ev.localSec || 0; ev.wkSec = ev.wkSec || 0;
    return ev;
  }
  function saveEv(ev){ jset("ho_ms_ev", ev); }

  /* ----------------------------- الحساب ----------------------------- */
  /* فرق السيرفر يُحتسب فقط إن كان خط الأساس من اليوم نفسه (وإلا ننتظر أول تحديث من السيرفر) */
  function studySecToday(st, ev){ return (st.day === dayIdx() ? Math.max(0, st.total - st.base) : 0) + ev.localSec; }

  function compute(uid){
    var st = loadSt(uid), ev = loadEv(), d = dayIdx(), w = weekOf(d);
    var todaySec = studySecToday(st, ev);
    var seed = uid + ":" + d;
    var a = pick(POOL_A, seed + "A"), b = pick(POOL_B, seed + "B"), c = pick(POOL_C, seed + "C");
    if (b.k === "pomo" && c.k === "pomo") c = { k: "task", t: 1 };
    var specs = [{ s: a, stars: 1, slot: "A" }, { s: b, stars: 2, slot: "B" }, { s: c, stars: 1, slot: "C" }];

    var daily = specs.map(function(x){
      var s = x.s, prog, target = s.t, label, title, desc;
      if (s.k === "study"){
        prog = Math.floor(todaySec / 60);
        title = "ادرس " + s.t + " دقيقة اليوم"; desc = "من مؤقت التحدي أو مؤقت الطالب";
        label = Math.min(prog, target) + " / " + target + " د";
      } else if (s.k === "pomo"){
        prog = ev.pomo;
        title = "أنهِ " + (s.t === 1 ? "جلسة تركيز" : s.t + " جلسات تركيز") + " بومودورو"; desc = "جلسة كاملة بدون تخطي";
        label = Math.min(prog, target) + " / " + target;
      } else {
        prog = ev.tasks.length;
        title = "أنجز " + (s.t === 1 ? "مهمة" : s.t + " مهام") + " من لائحتك"; desc = "علّم المهمة كمنجزة في مؤقت الطالب";
        label = Math.min(prog, target) + " / " + target;
      }
      var id = "d:" + d + ":" + x.slot + ":" + s.k + s.t;
      return mk(id, s.k, title, desc, prog, target, label, x.stars, "daily", st);
    });

    /* الأسبوعية: وقت الدراسة = سيرفر (weeklySeconds) + محلي، وأيام الدراسة من سجل الأيام */
    var hT = pick(WEEK_HOURS, uid + ":" + w + ":H"), dT = pick(WEEK_DAYS, uid + ":" + w + ":D");
    var wkSec = (st.wkIdx === w ? st.wkSec : 0) + (ev.wkIdx === w ? ev.wkSec : 0);
    var daysCnt = st.days.filter(function(x){ return weekOf(x) === w; }).length;
    var weekly = [
      mk("w:" + w + ":H" + hT, "hours", "ادرس " + hT + " ساعات هذا الأسبوع", "المجموع من كل مؤقتاتك",
         wkSec / 3600, hT, (Math.min(wkSec / 3600, hT)).toFixed(1) + " / " + hT + " س", 5, "weekly", st),
      mk("w:" + w + ":D" + dT, "days", "ادرس في " + dT + " أيام مختلفة", "يوم الدراسة = 10 دقائق فأكثر",
         daysCnt, dT, Math.min(daysCnt, dT) + " / " + dT + " أيام", 4, "weekly", st)
    ];

    var claimable = 0, dailyDone = 0, dailyClaimed = 0, weeklyDone = 0;
    daily.forEach(function(m){ if (m.done) dailyDone++; if (m.claimed) dailyClaimed++; if (m.done && !m.claimed) claimable++; });
    weekly.forEach(function(m){ if (m.done) weeklyDone++; if (m.done && !m.claimed) claimable++; });
    return {
      uid: uid, day: d, week: w, stars: st.stars, daily: daily, weekly: weekly,
      dailyDone: dailyDone, dailyClaimed: dailyClaimed, weeklyDone: weeklyDone, claimable: claimable,
      bonusTaken: st.bonusDay === d, bonusStars: BONUS_STARS, _st: st
    };
  }
  function mk(id, kind, title, desc, prog, target, label, stars, scope, st){
    var done = prog >= target;
    return {
      id: id, kind: kind, scope: scope, title: title, desc: desc, icon: ICON[kind], color: COLOR[kind],
      progress: prog, target: target, pct: Math.max(0, Math.min(100, (prog / target) * 100)),
      label: label, stars: stars, done: done, claimed: !!st.claimed[id]
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
    if (kind === "pomo") ev.pomo++;
    else if (kind === "task"){
      if (id == null || ev.tasks.indexOf(id) >= 0) return;      /* كل مهمة تُحتسب مرة واحدة باليوم */
      ev.tasks.push(id);
    } else return;
    saveEv(ev);
    changed();
  }
  function addStudy(seconds){
    seconds = Math.round(seconds || 0);
    if (seconds <= 0) return;
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
    st.stars += m.stars;
    var gotBonus = false;
    if (m.scope === "daily"){
      var allClaimed = S.daily.every(function(x){ return x.id === id || x.claimed; });
      if (allClaimed && st.bonusDay !== S.day){ st.bonusDay = S.day; st.stars += BONUS_STARS; gotBonus = true; }
    }
    saveSt(uid, st);
    if (window.HOUI){
      HOUI.dismiss("ms-" + id);
      HOUI.toast({ type: "reward", icon: "reward", title: "+" + m.stars + " ★", text: m.title, duration: 3000, sound: "mission" });
      if (gotBonus){
        HOUI.celebrate({
          kind: "reward", icon: "🎁", color: "#a78bfa", sound: "chest",
          kicker: "أنجزت كل مهام اليوم!", title: "مكافأة اليوم", value: "+" + BONUS_STARS + " ★",
          sub: "رصيدك الآن " + st.stars + " نجمة", okText: "رائع!"
        });
      }
    }
    emit();
    return { ok: true, stars: m.stars, bonus: gotBonus ? BONUS_STARS : 0, total: st.stars };
  }

  window.HOMissions = {
    update: update, event: event, addStudy: addStudy, state: publicState, claim: claim,
    onChange: function(fn){ if (typeof fn === "function") listeners.push(fn); }
  };
})();

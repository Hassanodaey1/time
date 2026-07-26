// أصوات المؤقتات - Web Audio API، بدون ملفات صوت خارجية
//
// ملاحظتين مهمتين عن هذا التعديل:
// 1) الدقة: التوقيت الآن مجدوَل مباشرة على ساعة السياق الصوتي (AudioContext.currentTime)
//    بدل سلسلة setTimeout متتالية. هذا أدق فعليًا لأن setTimeout يتأخر بشكل متراكم
//    (خصوصًا إذا الصفحة مصغّرة أو الجهاز مشغول)، بينما جدولة Web Audio ثابتة الدقة.
// 2) الجمالية: كل نغمة الآن لها "مغلّف صوتي" (attack/release) بدل قطع الصوت فجأة —
//    هذا يمنع صوت "الطقطقة" المزعج ويخلي النغمة ناعمة أشبه بجرس هادئ.

// سياق صوتي واحد مشترك (بدل إنشاء AudioContext جديد مع كل نغمة، وهو مكلف ويسبب تقطيع)
let _audioCtx = null;
function _getCtx(){
  if (!_audioCtx){
    try{ _audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch(e){ return null; }
  }
  if (_audioCtx.state === "suspended"){ _audioCtx.resume().catch(() => {}); }
  return _audioCtx;
}

// نغمة واحدة ناعمة: صعود سريع للصوت ثم هبوط تدريجي، بدل بداية/نهاية حادة
function _tone(ctx, freq, startAt, duration, peakVolume){
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, startAt);

  const attack = 0.015;
  const release = Math.min(0.14, duration * 0.5);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(peakVolume, startAt + attack);
  gain.gain.setValueAtTime(peakVolume, Math.max(startAt + attack, startAt + duration - release));
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.03);
}

// تشغيل تسلسل نغمات مجدول بدقة بدل setTimeout المتراكم الخطأ
function _playSequence(notes){
  const ctx = _getCtx();
  if (!ctx) return;
  const base = ctx.currentTime + 0.02;
  notes.forEach(n => _tone(ctx, n.freq, base + n.delay, n.duration, n.volume || 0.15));
}

// أنماط تنبيه مميزة لكل حالة — نغمات موسيقية متناغمة (مقام بسيط) بدل نغمة واحدة حادة متكررة
window.playTimerAlert = function(kind){
  if (kind === "mid"){
    // E5 مرتين بلطف — تذكير خفيف بمنتصف الوقت
    _playSequence([
      { freq: 659.25, delay: 0,    duration: 0.16 },
      { freq: 659.25, delay: 0.24, duration: 0.16 }
    ]);
  } else if (kind === "lastMinute"){
    // G5, G5, A5 — إلحاح لطيف بدون إزعاج
    _playSequence([
      { freq: 783.99, delay: 0,    duration: 0.14 },
      { freq: 783.99, delay: 0.2,  duration: 0.14 },
      { freq: 880.00, delay: 0.4,  duration: 0.2  }
    ]);
  } else if (kind === "finish"){
    // C5 - E5 - G5 — ثلاثية صاعدة مبهجة عند الانتهاء
    _playSequence([
      { freq: 523.25, delay: 0,    duration: 0.18 },
      { freq: 659.25, delay: 0.19, duration: 0.18 },
      { freq: 783.99, delay: 0.38, duration: 0.42 }
    ]);
  } else if (kind === "start"){
    // نغمة بداية واحدة هادئة
    _playSequence([
      { freq: 587.33, delay: 0, duration: 0.16 }
    ]);
  }
};

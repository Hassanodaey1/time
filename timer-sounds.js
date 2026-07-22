// أصوات المؤقتات - يعتمد على Web Audio API، لا يحتاج ملفات صوت خارجية
function _beep(freq, duration, delay, volume){
  delay = delay || 0;
  volume = volume || 0.18;
  setTimeout(() => {
    try{
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.value = volume;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      setTimeout(() => { osc.stop(); ctx.close(); }, duration);
    }catch(e){ /* الصوت غير مدعوم، تجاهل بصمت */ }
  }, delay);
}

// أنماط تنبيه مميزة لكل حالة
window.playTimerAlert = function(kind){
  if (kind === "mid"){
    _beep(660, 140, 0);
    _beep(660, 140, 220);
  } else if (kind === "lastMinute"){
    _beep(880, 130, 0);
    _beep(880, 130, 200);
    _beep(880, 130, 400);
  } else if (kind === "finish"){
    _beep(523, 160, 0);
    _beep(659, 160, 180);
    _beep(784, 320, 360);
  } else if (kind === "start"){
    _beep(440, 120, 0);
  }
};

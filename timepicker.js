/* ================================================================
   timepicker.js — منتقي الوقت (ساعات:دقائق) بتصميم اللعبة، مشترك بين student-timer و study-challenge
   ----------------------------------------------------------------
   كان منسوخًا حرفيًا في الصفحتين. الـ HTML والـ CSS بقيا في كل صفحة (عناصر timePickerOverlay / pickerHourNum / pickerMinuteNum).
   عند التأكيد يُطلق الحدث "timepicker:confirm" على document (detail: {targetId, value}) لتتصرف الصفحة بما يخصها
   (مثل إلغاء تفعيل أزرار الأوقات الجاهزة). تعريفات فقط، لا ينفّذ شيئًا عند التحميل.
   ================================================================ */
let pickerHour = 0, pickerMinute = 30;
let pickerTargetId = "customTime";
let pickerDisplayId = "customTimeDisplay";
window.openTimePicker = function(targetId, displayId){
  pickerTargetId = targetId || "customTime";
  pickerDisplayId = displayId || "customTimeDisplay";
  const existing = document.getElementById(pickerTargetId).value;
  if (existing){
    const parts = existing.split(":").map(Number);
    if (!isNaN(parts[0]) && !isNaN(parts[1])){ pickerHour = parts[0]; pickerMinute = parts[1]; }
  }
  renderTimePicker();
  document.getElementById("timePickerOverlay").classList.add("show");
};
window.closeTimePicker = function(){
  document.getElementById("timePickerOverlay").classList.remove("show");
};
function renderTimePicker(){
  document.getElementById("pickerHourNum").innerText = String(pickerHour).padStart(2, "0");
  document.getElementById("pickerMinuteNum").innerText = String(pickerMinute).padStart(2, "0");
}
window.adjustPickerHour = function(delta){
  pickerHour = Math.max(0, Math.min(23, pickerHour + delta));
  renderTimePicker();
};
window.adjustPickerMinute = function(delta){
  let total = pickerHour * 60 + pickerMinute + delta;
  total = Math.max(0, Math.min(23 * 60 + 59, total));
  pickerHour = Math.floor(total / 60);
  pickerMinute = total % 60;
  renderTimePicker();
};
window.confirmTimePicker = function(){
  if (pickerHour === 0 && pickerMinute === 0){
    if (typeof appAlert === "function") appAlert("حدد وقتًا أكبر من صفر");
    else if (typeof showSessionNotice === "function") showSessionNotice("⚠️ حدد وقتًا أكبر من صفر");
    else alert("حدد وقتًا أكبر من صفر");
    return;
  }
  const hh = String(pickerHour).padStart(2, "0");
  const mm = String(pickerMinute).padStart(2, "0");
  const val = hh + ":" + mm;
  document.getElementById(pickerTargetId).value = val;
  const displayEl = document.getElementById(pickerDisplayId);
  displayEl.innerText = val + " ساعة:دقيقة";
  displayEl.classList.add("set");
  document.dispatchEvent(new CustomEvent("timepicker:confirm", { detail: { targetId: pickerTargetId, value: val } }));
  closeTimePicker();
};

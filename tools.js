/* ================================================================
   tools.js — الأدوات العائمة المشتركة: الحاسبة العلمية + السبورة (مركز المؤقتات)
   ----------------------------------------------------------------
   كانت منسوخة حرفيًا داخل 4 صفحات (student-timer · study-challenge · challenge-timer · display)
   بحجم ~16KB لكل نسخة. صارت الآن ملفًا واحدًا: أي إصلاح أو تحسين يُكتب مرة واحدة.
   • الملف تعريفات فقط (دوال ومتغيرات و window.openCalc/openBoard...) ولا ينفّذ شيئًا عند التحميل.
   • الأنماط (CSS) والـ HTML بقيت داخل كل صفحة عمدًا: لكل صفحة مقياس خطوط وثيم مختلف
     (شاشتا المشرف بخلفية سوداء ولون الثيم) فنقلها كان سيغيّر المظهر.
   • الدفتر السريع خاص بـ student-timer فبقي فيها.
   ================================================================ */

/* ================= الحاسبة العلمية العائمة ================= */
/* محرك حساب آمن بالكامل — بدون eval(). يدعم: + - × ÷ ^ ( ) √ ∛ x² x³ 1/x x!
   sin cos tan sin⁻¹ cos⁻¹ tan⁻¹ log ln π e nPr nCr % Ans ذاكرة (M+ M- MR MC) وضع درجة/راديان.
   كل خطأ رياضي (قسمة على صفر، جذر لعدد سالب، log لعدد غير موجب، مدى دوال معكوسة...) يُرصد
   ويُعرض "خطأ" بدل نتيجة غير صحيحة — لا يوجد أي احتمال لإرجاع رقم رياضياً خاطئ. */
let calcExpr = "";
let calcMode = "DEG"; // "DEG" أو "RAD"
let calcMemory = 0;
let calcAns = 0;

window.openCalc = function(){
  document.getElementById("calcOverlay").classList.add("show");
  calcUpdateStatus();
};
window.closeCalc = function(){
  document.getElementById("calcOverlay").classList.remove("show");
};

function calcRender(){
  document.getElementById("calcExprLine").innerHTML = calcExpr ? calcExpr : "&nbsp;";
}

function calcUpdateStatus(){
  document.getElementById("calcMemIndicator").innerText = "M: " + calcNumToDisplay(calcMemory);
  document.getElementById("calcModeIndicator").innerText = calcMode;
  document.getElementById("calcModeBtn").innerText = calcMode;
}

/* تقريب لـ 10 خانات عشرية للأعداد العادية فقط. الأعداد الضخمة (مثل 170!) كان n*1e10 يحوّلها إلى ∞ فتظهر نتيجة خاطئة؛
   وأيضًا نتخلّص من الصفر السالب (-0) الناتج عن تقريب أعداد سالبة صغيرة جدًا مثل sin(-180°). */
function calcRound(n){
  const r = Math.abs(n) < 1e15 ? Math.round(n * 1e10) / 1e10 : n;
  return r === 0 ? 0 : r;
}
function calcNumToDisplay(n){
  const rounded = calcRound(n);
  return rounded.toLocaleString("en-US", { maximumFractionDigits: 10, useGrouping: false });
}

window.calcToggleMode = function(){
  calcMode = calcMode === "DEG" ? "RAD" : "DEG";
  calcUpdateStatus();
};
window.calcMemClear = function(){
  calcMemory = 0;
  calcUpdateStatus();
};
/* إدراج قيمة جاهزة (MR / Ans). كانت تُلصق نصًّا كما هي: 5 ثم MR (والذاكرة 3) يصير «53» رقمًا جديدًا،
   و5 ثم MR (والذاكرة -3) يصير «5-3» أي طرحًا. الآن: ضرب صريح بعد أي قيمة سابقة، وقوسان حول السالب. */
function calcInsertValue(v){
  let s = calcNumToDisplay(v);
  if (calcRound(v) < 0) s = "(" + s + ")";
  const last = calcExpr.slice(-1);
  if (/[0-9.)πe%²³!]/.test(last) || calcExpr.endsWith("⁻¹")) calcExpr += "×";
  calcExpr += s;
  calcRender();
}
window.calcMemRecall = function(){
  calcInsertValue(calcMemory);
};
window.calcMemAdd = function(){
  const val = parseFloat(document.getElementById("calcResultLine").innerText.replace(/,/g, ""));
  if (!isNaN(val) && isFinite(val)) calcMemory += val;
  calcUpdateStatus();
};
window.calcMemSub = function(){
  const val = parseFloat(document.getElementById("calcResultLine").innerText.replace(/,/g, ""));
  if (!isNaN(val) && isFinite(val)) calcMemory -= val;
  calcUpdateStatus();
};
window.calcInsertAns = function(){
  calcInsertValue(calcAns);
};

const CALC_OPS = ["+", "-", "×", "÷", "^"];
const CALC_POSTFIX = ["%", "²", "³", "!"];
const CALC_FUNC_TOKENS = ["asin(", "acos(", "atan(", "sin(", "cos(", "tan(", "log(", "ln(", "nPr(", "nCr(", "√(", "∛("];

window.calcInput = function(ch){
  const last = calcExpr.slice(-1);
  const endsWithFunc = CALC_FUNC_TOKENS.some(f => calcExpr.endsWith(f));
  const endsWithRecip = calcExpr.endsWith("⁻¹");
  const atStart = calcExpr === "" || last === "(" || endsWithFunc;

  // منع رقم عشري ثاني داخل نفس العدد (مثل 3.5.6)
  if (ch === "."){
    const seg = calcExpr.match(/[0-9]*\.?[0-9]*$/)[0];
    if (seg.includes(".")) return;
    if (seg === "") calcExpr += "0"; // .5 تصير 0.5
  }

  // منع بداية بعملية غير منطقية (× ÷ ^ في البداية)، السماح بـ "-" فقط كإشارة سالبة
  if (CALC_OPS.includes(ch)){
    if (atStart && ch !== "-") return; // إشارة سالبة مسموحة دائماً كبداية عدد، حتى داخل الأقواس أو الدوال (مثل sin(-30) أو √(-4))
    // السماح بإشارة سالبة بعد × ÷ ^ (مثل 5×-3 و 2^-3)، وإلا نستبدل العمليات المعلّقة بدل تكديسها
    const signAfterMulDiv = (ch === "-" && ["×", "÷", "^"].includes(last));
    if (!signAfterMulDiv){
      while (CALC_OPS.includes(calcExpr.slice(-1))) calcExpr = calcExpr.slice(0, -1);
      if (calcExpr === "" && ch !== "-"){ calcRender(); return; }
    }
  }

  // % ² ³ ! يحتاجون عدد أو قوس مغلق أو نتيجة قبلهم
  if (CALC_POSTFIX.includes(ch)){
    if (calcExpr === "" || CALC_OPS.includes(last) || last === "(" || endsWithFunc || endsWithRecip) return;
  }

  // 1/x (⁻¹) نفس الشرط
  if (ch === "⁻¹"){
    if (calcExpr === "" || CALC_OPS.includes(last) || last === "(" || endsWithFunc) return;
  }

  // منع قوس إغلاق بدون قوس مفتوح مقابل له
  if (ch === ")"){
    const opens = (calcExpr.match(/\(/g) || []).length;
    const closes = (calcExpr.match(/\)/g) || []).length;
    if (closes >= opens || atStart) return;
  }

  // الفاصلة (لـ nPr و nCr) لا تُضاف في بداية المعادلة أو بعد عملية
  if (ch === ","){
    if (calcExpr === "" || CALC_OPS.includes(last) || last === "(" || last === ",") return;
  }

  calcExpr += ch;
  calcRender();
};
window.calcBackspace = function(){
  calcExpr = calcExpr.slice(0, -1);
  calcRender();
};
window.calcClear = function(){
  calcExpr = "";
  document.getElementById("calcResultLine").innerText = "0";
  calcRender();
};

function calcToRad(v){ return calcMode === "DEG" ? v * Math.PI / 180 : v; }
function calcFromRad(v){ return calcMode === "DEG" ? v * 180 / Math.PI : v; }

function calcFactorial(n){
  if (n < 0 || !Number.isInteger(n)) throw new Error("domain");
  if (n > 170) throw new Error("overflow");
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}
/* nPr و nCr بأعداد صحيحة دقيقة (BigInt) ثم تحويل لأقرب رقم ممكن. الطريقة القديمة بالفاصلة العائمة كانت تعطي نتيجة
   خاطئة بمقدار 1 أو أكثر حين يتجاوز الناتج نحو 1.7×10¹⁵ (مثل nCr(54,25) و nCr(55,27))، وتفشل أو تتجمّد مع الأعداد الكبيرة. */
const CALC_HAS_BIGINT = typeof BigInt === "function";
function calcCheckPerm(n, r){
  if (!Number.isInteger(n) || !Number.isInteger(r) || n < 0 || r < 0 || r > n) throw new Error("domain");
}
function calcBigToNumber(big){
  const v = Number(big);
  if (!isFinite(v)) throw new Error("overflow");
  return v;
}
/* احتياط للمتصفحات القديمة بلا BigInt: الطريقة القديمة نفسها لكن مع منع الحلقات الطويلة */
function calcNPRFloat(n, r){
  let res = 1;
  for (let i = 0; i < r; i++) res *= (n - i);
  return res;
}
function calcNCRFloat(n, r){
  const k = Math.min(r, n - r);
  if (k > 170) throw new Error("overflow");
  return Math.round(calcNPRFloat(n, k) / calcFactorial(k));
}
function calcNPR(n, r){
  calcCheckPerm(n, r);
  if (r > 170) throw new Error("overflow");          // nPr ≥ r! و171! أكبر من أكبر عدد ممكن
  if (!CALC_HAS_BIGINT) return calcBigToNumber(calcNPRFloat(n, r));
  const N = BigInt(n);
  let p = 1n;
  for (let i = 0; i < r; i++) p *= (N - BigInt(i));
  return calcBigToNumber(p);
}
function calcNCR(n, r){
  calcCheckPerm(n, r);
  if (!CALC_HAS_BIGINT) return calcBigToNumber(calcNCRFloat(n, r));
  const N = BigInt(n), R = BigInt(r);
  const K = (R < N - R) ? R : N - R;
  if (K > 1030n) throw new Error("overflow");        // C(n,k) ≥ C(2k,k) وهو أكبر من 10^308 عند k > 1030
  let c = 1n;
  for (let i = 1n; i <= K; i++) c = c * (N - K + i) / i;   // كل ناتج جزئي هو C(n-k+i, i) أي عدد صحيح دائمًا
  return calcBigToNumber(c);
}

/* محلّل آمن للتعبيرات — بدون eval(). يدعم كل الدوال والعمليات المذكورة أعلاه مع فحص كامل لنطاقات كل دالة. */
function calcTokenize(str){
  const tokens = [];
  let i = 0;
  const multi = ["asin(", "acos(", "atan(", "sin(", "cos(", "tan(", "log(", "ln(", "nPr(", "nCr(", "√(", "∛("];
  while (i < str.length){
    const c = str[i];
    if (c === " "){ i++; continue; }
    let matched = false;
    for (let m = 0; m < multi.length; m++){
      const tok = multi[m];
      if (str.startsWith(tok, i)){
        tokens.push({ type: "func", name: tok.slice(0, -1) });
        tokens.push({ type: "(" });
        i += tok.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    if (str.startsWith("⁻¹", i)){ tokens.push({ type: "recip" }); i += 2; continue; }
    if (/[0-9.]/.test(c)){
      let num = "";
      while (i < str.length && /[0-9.]/.test(str[i])){ num += str[i]; i++; }
      if ((num.match(/\./g) || []).length > 1) throw new Error("bad-number");
      tokens.push({ type: "num", value: parseFloat(num) });
      continue;
    }
    if (c === "π"){ tokens.push({ type: "num", value: Math.PI }); i++; continue; }
    if (c === "e"){ tokens.push({ type: "num", value: Math.E }); i++; continue; }
    if ("+-()%!²³,".includes(c)){ tokens.push({ type: c }); i++; continue; }
    if (c === "^"){ tokens.push({ type: "^" }); i++; continue; }
    if (c === "×"){ tokens.push({ type: "*" }); i++; continue; }
    if (c === "÷"){ tokens.push({ type: "/" }); i++; continue; }
    throw new Error("bad-char:" + c);
  }
  return tokens;
}

function calcParse(tokens){
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];
  const expect = (t) => { if (!peek() || peek().type !== t) throw new Error("syntax"); return next(); };

  function parseExpr(){
    let left = parseTerm();
    while (peek() && (peek().type === "+" || peek().type === "-")){
      const op = next().type;
      const right = parseTerm();
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }
  function parseTerm(){
    let left = parseImplicit();
    while (peek() && (peek().type === "*" || peek().type === "/")){
      const op = next().type;
      const right = parseImplicit();
      if (op === "*") left = left * right;
      else { if (right === 0) throw new Error("div0"); left = left / right; }
    }
    return left;
  }
  // ضرب ضمني: 2π ، 3(4+1) ، π(3)
  function parseImplicit(){
    let left = parseUnary();
    while (peek() && (peek().type === "num" || peek().type === "(" || peek().type === "func")){
      const right = parseUnary();
      left = left * right;
    }
    return left;
  }
  function parseUnary(){
    if (peek() && peek().type === "-"){ next(); return -parseUnary(); }
    if (peek() && peek().type === "+"){ next(); return parseUnary(); }
    return parsePower();
  }
  function parsePower(){
    const base = parsePostfix();
    if (peek() && peek().type === "^"){
      next();
      const exp = parseUnary(); // ترابط لليمين، يسمح بأس سالب
      const result = Math.pow(base, exp);
      if (!isFinite(result)) throw new Error("domain");
      return result;
    }
    return base;
  }
  function parsePostfix(){
    let val = parsePrimary();
    while (peek() && (peek().type === "%" || peek().type === "!" || peek().type === "²" || peek().type === "³" || peek().type === "recip")){
      const op = next().type;
      if (op === "%") val = val / 100;
      else if (op === "!") val = calcFactorial(val);
      else if (op === "²") val = val * val;
      else if (op === "³") val = val * val * val;
      else if (op === "recip"){ if (val === 0) throw new Error("div0"); val = 1 / val; }
    }
    return val;
  }
  function parsePrimary(){
    const t = peek();
    if (!t) throw new Error("unexpected-end");
    if (t.type === "num"){ next(); return t.value; }
    if (t.type === "("){
      next();
      const val = parseExpr();
      expect(")");
      return val;
    }
    if (t.type === "func"){
      next();
      expect("(");
      const name = t.name;
      if (name === "nPr" || name === "nCr"){
        const a = parseExpr();
        expect(",");
        const b = parseExpr();
        expect(")");
        return name === "nPr" ? calcNPR(a, b) : calcNCR(a, b);
      }
      const arg = parseExpr();
      expect(")");
      switch(name){
        case "√": if (arg < 0) throw new Error("domain"); return Math.sqrt(arg);
        case "∛": return Math.cbrt(arg);
        case "sin": return Math.sin(calcToRad(arg));
        case "cos": return Math.cos(calcToRad(arg));
        case "tan": {
          const rad = calcToRad(arg);
          if (Math.abs(Math.cos(rad)) < 1e-12) throw new Error("domain");
          return Math.tan(rad);
        }
        case "asin": if (arg < -1 || arg > 1) throw new Error("domain"); return calcFromRad(Math.asin(arg));
        case "acos": if (arg < -1 || arg > 1) throw new Error("domain"); return calcFromRad(Math.acos(arg));
        case "atan": return calcFromRad(Math.atan(arg));
        case "log": if (arg <= 0) throw new Error("domain"); return Math.log10(arg);
        case "ln": if (arg <= 0) throw new Error("domain"); return Math.log(arg);
        default: throw new Error("unknown-func");
      }
    }
    throw new Error("unexpected-token");
  }

  if (!tokens.length) return 0;
  const result = parseExpr();
  if (pos !== tokens.length) throw new Error("trailing");
  if (typeof result !== "number" || isNaN(result) || !isFinite(result)) throw new Error("domain");
  return result;
}

window.calcEquals = function(){
  if (!calcExpr){ return; }
  let expr = calcExpr;
  const lastChar = expr.slice(-1);
  const endsWithFunc = CALC_FUNC_TOKENS.some(f => expr.endsWith(f));
  // منع إنهاء المعادلة بعملية معلّقة (مثل 5+) قبل حتى محاولة الحساب
  if (CALC_OPS.includes(lastChar) || lastChar === "(" || endsWithFunc || lastChar === ","){
    document.getElementById("calcResultLine").innerText = "خطأ";
    return;
  }
  // إغلاق تلقائي للأقواس الناقصة (مثل الآلات الحاسبة العلمية الحقيقية)
  const opens = (expr.match(/\(/g) || []).length;
  const closes = (expr.match(/\)/g) || []).length;
  if (opens > closes) expr += ")".repeat(opens - closes);

  try{
    const result = calcParse(calcTokenize(expr));
    if (!isFinite(result) || isNaN(result)) throw new Error("invalid");
    const rounded = calcRound(result);
    calcAns = rounded;
    document.getElementById("calcResultLine").innerText = rounded.toLocaleString("en-US", { maximumFractionDigits: 10, useGrouping: false });
  }catch(e){
    document.getElementById("calcResultLine").innerText = "خطأ";
  }
};

/* ================= السبورة العائمة ================= */
/* مستقلة تماماً عن منطق المؤقت: فتحها أو إغلاقها لا يوقف أو يبطئ أي مؤقت شغّال بالخلفية. */
let boardCtx = null;
let boardDrawing = false;
let boardColor = "#000000";
let boardSize = 6;
let boardEraser = false;
let boardUndoStack = [];
let boardLastX = 0, boardLastY = 0;
let boardEventsBound = false;

window.openBoard = function(){
  document.getElementById("boardOverlay").classList.add("show");
  requestAnimationFrame(boardSetupCanvas);
};
window.closeBoard = function(){
  document.getElementById("boardOverlay").classList.remove("show");
};

/* تحجيم صورة (ImageData) إلى مقاس جديد: عند تدوير الجهاز يتغير عرض السبورة */
function boardRescale(imageData, w, h){
  const src = document.createElement("canvas");
  src.width = imageData.width; src.height = imageData.height;
  src.getContext("2d").putImageData(imageData, 0, 0);
  const dst = document.createElement("canvas");
  dst.width = w; dst.height = h;
  const dctx = dst.getContext("2d");
  dctx.fillStyle = "#ffffff";
  dctx.fillRect(0, 0, w, h);
  dctx.imageSmoothingEnabled = true;
  try{ dctx.imageSmoothingQuality = "high"; }catch(e){}
  dctx.drawImage(src, 0, 0, src.width, src.height, 0, 0, w, h);
  return dctx.getImageData(0, 0, w, h);
}

function boardSetupCanvas(){
  const canvas = document.getElementById("boardCanvas");
  const wrap = canvas.parentElement;
  const w = Math.round(wrap.clientWidth);
  const h = Math.round(w * 0.72);
  if (canvas.width === w && canvas.height === h && boardCtx) return; // نفس المقاس، ما نمسح الرسمة الحالية
  const prevDrawing = (canvas.width && canvas.height && boardCtx) ? boardCtx.getImageData(0, 0, canvas.width, canvas.height) : null;
  canvas.width = w;
  canvas.height = h;
  boardCtx = canvas.getContext("2d");
  boardCtx.fillStyle = "#ffffff";
  boardCtx.fillRect(0, 0, w, h);
  boardCtx.lineCap = "round";
  boardCtx.lineJoin = "round";
  /* الرسم القديم يُحجَّم للمقاس الجديد (كان يُلصق بحجمه الأصلي فيُقصّ أو يبقى في زاوية). وكذلك سجل التراجع،
     وإلا أعاد «تراجع» صورة بمقاس قديم فوق السبورة. */
  if (prevDrawing){ try{ boardCtx.putImageData(boardRescale(prevDrawing, w, h), 0, 0); }catch(e){} }
  boardUndoStack = boardUndoStack.map(img => { try{ return boardRescale(img, w, h); }catch(e){ return null; } }).filter(Boolean);
  boardBindEvents(canvas);
}

function boardBindEvents(canvas){
  if (boardEventsBound) return;
  boardEventsBound = true;
  canvas.addEventListener("pointerdown", boardStart);
  canvas.addEventListener("pointermove", boardMove);
  window.addEventListener("pointerup", boardEnd);
  window.addEventListener("pointercancel", boardEnd);
}

function boardGetPos(e, canvas){
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
}

function boardPushUndo(){
  if (!boardCtx) return;
  const canvas = document.getElementById("boardCanvas");
  try{
    boardUndoStack.push(boardCtx.getImageData(0, 0, canvas.width, canvas.height));
    if (boardUndoStack.length > 25) boardUndoStack.shift();
  }catch(e){}
}

function boardStart(e){
  if (!boardCtx) return;
  const canvas = document.getElementById("boardCanvas");
  boardPushUndo();
  boardDrawing = true;
  const pos = boardGetPos(e, canvas);
  boardLastX = pos.x; boardLastY = pos.y;
  try{ canvas.setPointerCapture(e.pointerId); }catch(err){}
  boardCtx.beginPath();
  boardCtx.arc(pos.x, pos.y, (boardEraser ? boardSize * 2 : boardSize) / 2, 0, Math.PI * 2);
  boardCtx.fillStyle = boardEraser ? "#ffffff" : boardColor;
  boardCtx.fill();
}
function boardMove(e){
  if (!boardDrawing || !boardCtx) return;
  const canvas = document.getElementById("boardCanvas");
  const pos = boardGetPos(e, canvas);
  boardCtx.strokeStyle = boardEraser ? "#ffffff" : boardColor;
  boardCtx.lineWidth = boardEraser ? boardSize * 2 : boardSize;
  boardCtx.beginPath();
  boardCtx.moveTo(boardLastX, boardLastY);
  boardCtx.lineTo(pos.x, pos.y);
  boardCtx.stroke();
  boardLastX = pos.x; boardLastY = pos.y;
}
function boardEnd(){
  boardDrawing = false;
}

window.boardSetColor = function(color, btn){
  boardColor = color;
  boardEraser = false;
  document.querySelectorAll(".board-color").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  document.getElementById("boardEraserBtn").classList.remove("active");
};
window.boardSetSize = function(size, btn){
  boardSize = size;
  document.querySelectorAll(".board-size-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
};
window.boardToggleEraser = function(){
  boardEraser = !boardEraser;
  document.getElementById("boardEraserBtn").classList.toggle("active", boardEraser);
};
window.boardUndo = function(){
  if (!boardUndoStack.length || !boardCtx) return;
  const imgData = boardUndoStack.pop();
  boardCtx.putImageData(imgData, 0, 0);
};
window.boardClear = function(){
  if (!boardCtx) return;
  boardPushUndo();
  const canvas = document.getElementById("boardCanvas");
  boardCtx.fillStyle = "#ffffff";
  boardCtx.fillRect(0, 0, canvas.width, canvas.height);
};

/* ================= تذكير قاعدة 20-20-20 لراحة العين (مشترك بين student-timer و study-challenge) ================= */
let eyeReminderElapsed = 0;
const EYE_REMINDER_INTERVAL_SEC = 20 * 60; // كل 20 دقيقة
function eyeReminderTick(sec){
  eyeReminderElapsed += (sec === undefined ? 1 : sec);
  if (eyeReminderElapsed >= EYE_REMINDER_INTERVAL_SEC){
    eyeReminderElapsed = 0;
    showEyeToast();
  }
}
function showEyeToast(){
  if (typeof window.isDeepFocus === "function" && window.isDeepFocus()) return; // وضع التركيز العميق: بدون تنبيهات جانبية
  HOUI.toast({ id: "eye", type: "info", icon: "eye", text: "قاعدة 20-20-20: انظر لشي يبعد 6 أمتار لمدة 20 ثانية لراحة عينك", duration: 20000, soft: true, sound: false });
}

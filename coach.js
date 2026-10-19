/* ================================================================
   coach.js — «مساعد الدراسة»: زر عائم يحرّكه الطالب + لوحة فيها فكرة اليوم
   ونصائح لكل مادة وحافز. ملف مستقل: يُضاف بسطر <script src="coach.js"></script>.

   • الزر: يُسحب بحرية، وعند الإفلات يلتصق بأقرب جانب (يمين/يسار) ويحفظ ارتفاعه.
     بعد ثوانٍ بلا لمس ينسحب نصفه خلف الحافة. نقطة صغيرة تنبّه بفكرة اليوم الجديدة.
   • يختفي تلقائيًا أثناء تشغيل مؤقت الطالب (#runningView / #pomoRunningView).
   • المحتوى: بنك نصائح مبني على أبحاث علم النفس التعليمي والتوصيات الصحية، ولكل نصيحة مصدرها (ولفكرة اليوم قوة الدليل أيضًا). لا يحتاج إنترنت ولا مفتاح ذكاء اصطناعي.
     فكرة اليوم تتبدّل كل يوم (بتوقيت بغداد) ولا تتكرر قبل أن تنتهي الدورة كاملة.
     المحادثة الحية (تبويب «اسأل المساعد»): تمر عبر الـ Worker (/coach/chat) بتوكن فايربيس، وتظهر فقط حين
     يفعّلها الأدمن (coachSettings/enabled). السجل يُحفظ في جهاز الطالب فقط (آخر 30 رسالة).
   ================================================================ */
(function(){
  "use strict";
  if (window.HOCoach) return;
  var styleEl = null;

  var LS_POS = "ho_coach_pos", LS_SEEN = "ho_coach_seen";
  var SIZE = 54, MARGIN = 8, IDLE_MS = 4000, DRAG_PX = 8;

  /* ============================ المحتوى ============================ */
  /* ================= المحتوى =================
     كل فكرة/نصيحة مبنية على أبحاث علم النفس التعليمي أو توصيات صحية رسمية، ويُعرض مصدرها تحتها.
     k: idea = فكرة دراسة، push = حافز، habit = عادة.  a = «جرّب الآن».
     e (قوة الدليل): قوي = دعم متكرر من تجارب ومراجعات كبيرة | متوسط = دعم جيد لكن أضيق أو أقل تكرارًا | مبدئي = نتائج واعدة وتحتاج مزيدًا من البحث | توصية صحية = إرشاد رسمي.
     s = المصدر (المؤلف، السنة). الأسماء كُتبت بالإنجليزية ليسهل البحث عنها. */
  var DAILY = [
    { k:"idea", t:"اختبر نفسك بدل إعادة القراءة", b:"أغلق الكتاب واكتب كل ما تتذكره عن الدرس، ثم افتحه وصحّح. في تجارب علمية، تذكّر من اختبر نفسه أكثر بعد أسبوع من الذي أعاد القراءة فقط.", a:"اكتب 5 أشياء تتذكرها من آخر درس درسته.", e:"قوي", s:"Roediger & Karpicke, 2006; Dunlosky et al., 2013" },
    { k:"idea", t:"وزّع مراجعتك على أيام", b:"مراجعة الدرس على عدة أيام تثبّته أطول من حشده في جلسة واحدة. وكلما كان الامتحان أبعد، كان الفاصل المناسب بين المراجعات أطول.", a:"اختر درسًا من الأسبوع الماضي وراجعه 10 دقائق من الذاكرة.", e:"قوي", s:"Cepeda et al., 2006; Cepeda et al., 2008; Dunlosky et al., 2013" },
    { k:"idea", t:"جرّب قبل أن ترى الحل", b:"محاولتك الإجابة قبل أن تعرف الجواب، حتى لو أخطأت، تساعدك على تذكّر الجواب الصحيح بعد أن تراه. المهم أن تراجع الحل الصحيح بعد المحاولة.", a:"حاول حل مسألة قبل أن ترى طريقة حلها، ثم قارن.", e:"متوسط", s:"Kornell et al., 2009" },
    { k:"idea", t:"اشرح لنفسك: لماذا؟", b:"بعد كل خطوة أو معلومة اسأل نفسك: لماذا هي صحيحة؟ وكيف ترتبط بما أعرفه؟ الشرح الذاتي ساعد الطلاب على فهم أعمق وعلى حل مسائل جديدة.", a:"اختر قاعدة واحدة واشرح سبب صحتها بكلماتك.", e:"متوسط", s:"Chi et al., 1989; Dunlosky et al., 2013" },
    { k:"idea", t:"علّم غيرك", b:"حين تستعد لتعليم أحد الدرس ثم تشرحه له، فأنت تنظّم المعلومات وتكتشف ما لا تفهمه. وأظهرت تجارب أن الاستعداد للتعليم ثم الشرح يحسّن التعلم مقارنة بالدراسة للاختبار فقط.", a:"اشرح فكرة واحدة في دقيقة لمن حولك أو أمام المرآة.", e:"متوسط", s:"Fiorella & Mayer, 2013" },
    { k:"idea", t:"ابدأ بمثال محلول", b:"عند تعلم نوع جديد من المسائل، ادرس مثالًا محلولًا خطوة بخطوة، ثم حاول مسألة مشابهة وحدك. هذا مفيد للمبتدئ خاصة، ومع الخبرة يصبح حل المسائل مباشرة أنفع.", a:"ادرس مثالًا محلولًا ثم حل مسألة مشابهة دون النظر إليه.", e:"متوسط", s:"Sweller & Cooper, 1985; Kalyuga et al., 2003" },
    { k:"idea", t:"اخلط أنواع المسائل", b:"بعد أن تتقن كل نوع على حدة، اخلط الأنواع في واجب واحد. في تجربة على 54 صفًا من الصف السابع، حصل من تدربوا بخلط الأنواع على 61% في اختبار بعد شهر، مقابل 38% لمن تدربوا على نوع واحد في كل مرة. والخلط يستغرق وقتًا أطول، وهذا طبيعي.", a:"ضع في واجب اليوم مسألتين من كل نوع بترتيب مختلط.", e:"قوي", s:"Rohrer et al., 2020" },
    { k:"habit", t:"النوم الكافي جزء من الدراسة", b:"توصي الأكاديمية الأمريكية لطب النوم بـ 9 إلى 12 ساعة يوميًا للأعمار من 6 إلى 12 سنة، و8 إلى 10 ساعات من 13 إلى 18 سنة. والنقص المتكرر عن ذلك يرتبط بمشكلات في الانتباه والتعلم. كما يساعد النوم على تثبيت ما تعلمته.", a:"حدّد موعد نومك الليلة وأطفئ الشاشة قبله.", e:"توصية صحية", s:"Paruthi et al., 2016; Diekelmann & Born, 2010" },
    { k:"habit", t:"لا تسهر من أجل المذاكرة", b:"في دراسة يومية على طلاب الثانوية، الطلاب الذين نقصوا من نومهم ليدرسوا أكثر واجهوا صعوبة أكبر في الفهم وأداءً أضعف في اليوم التالي. السهر للمذاكرة قد يضرّك أكثر مما ينفعك.", a:"اجعل آخر مراجعة مبكرة وانم في وقتك المعتاد.", e:"متوسط", s:"Gillen-O'Neel et al., 2013" },
    { k:"habit", t:"أبعد الهاتف عنك", b:"مجرد وصول إشعار إلى هاتفك قد يشتّت انتباهك حتى لو لم تنظر إليه، وكل انتقال بين مهمتين يكلّفك وقتًا وجهدًا ذهنيًا.", a:"ضع الهاتف في غرفة أخرى أو فعّل «عدم الإزعاج» في جلسة اليوم.", e:"متوسط", s:"Stothart et al., 2015; Rubinstein et al., 2001" },
    { k:"habit", t:"حدّد هدفًا واضحًا للجلسة", b:"الأهداف المحددة والصعبة قليلًا تحسّن الأداء أكثر من قول «سأبذل جهدي». بدل «سأدرس الرياضيات» قل: سأحل 10 مسائل من الفصل الثالث.", a:"اكتب هدف جلسة اليوم بأرقام واضحة.", e:"قوي", s:"Locke & Latham, 2002" },
    { k:"habit", t:"خطة «إذا... فإنني...»", b:"اربط الدراسة بموقف ثابت: إذا انتهيت من العشاء فسأفتح كتاب الرياضيات. أظهرت مراجعة لعشرات الدراسات أن هذه الخطط ترفع احتمال تنفيذ ما نخطط له.", a:"أكمل الجملة: إذا ... فسأبدأ الدراسة.", e:"قوي", s:"Gollwitzer & Sheeran, 2006" },
    { k:"habit", t:"العادة تحتاج صبرًا", b:"لا تحتاج العادة إلى 21 يومًا كما يُشاع. في دراسة تتبّعت أشخاصًا، تراوح الوقت اللازم لتصبح العادة شبه تلقائية بين 18 و254 يومًا، ومتوسطه نحو 66 يومًا. وفوات يوم واحد لم يُفسد العملية.", a:"اختر وقتًا ثابتًا للدراسة غدًا، وإن فاتك يوم فعُد في اليوم التالي.", e:"متوسط", s:"Lally et al., 2010" },
    { k:"idea", t:"صحّح أخطاءك واعرف سببها", b:"التدرب مع تصحيح الخطأ ومعرفة سببه يعلّمك أكثر من التدرب وحده. دوّن الخطأ وسببه والحل الصحيح، وراجع دفتر الأخطاء قبل الامتحان.", a:"أضف خطأً واحدًا من آخر واجب إلى دفترك مع سببه.", e:"متوسط", s:"Hattie & Timperley, 2007; Metcalfe, 2017" },
    { k:"idea", t:"الإحساس بالسهولة قد يخدعك", b:"إعادة قراءة الدرس تجعله مألوفًا فتشعر أنك فهمته، لكن الألفة ليست تذكّرًا. الأساليب التي تبدو أصعب، كاختبار النفس والمراجعة المتباعدة، تعطي نتائج أفضل على المدى البعيد.", a:"بعد أن تنهي درسًا، أغلق الكتاب وحاول أن تشرحه قبل أن تقول: فهمته.", e:"قوي", s:"Bjork & Bjork, 2011; Dunlosky et al., 2013" },
    { k:"idea", t:"ارسم من الذاكرة", b:"ارسم مخططًا أو خريطة للدرس من ذاكرتك ثم قارنها بالكتاب. في تجربة، تفوّق الاسترجاع من الذاكرة على بناء خريطة مفاهيم والنص مفتوح أمامك.", a:"ارسم خريطة صغيرة لدرس اليوم من ذاكرتك ثم صحّحها.", e:"متوسط", s:"Karpicke & Blunt, 2011; Fiorella & Zhang, 2018" },
    { k:"idea", t:"اقرأ بصوت مسموع", b:"ما تنطقه بصوتك يُحفظ غالبًا أفضل مما تقرؤه بصمت، وهذا مفيد للأبيات والمفردات والتعريفات.", a:"اقرأ تعريفًا أو بيتًا بصوت مسموع ثلاث مرات.", e:"متوسط", s:"MacLeod et al., 2010" },
    { k:"habit", t:"استراحة هادئة بعد التعلم", b:"في تجربة على بالغين، من استراحوا نحو 10 دقائق في غرفة هادئة بعد التعلم تذكّروا أكثر بعد أسبوع ممن لم يفعلوا. جرّب استراحة هادئة بلا شاشة بعد الجلسة، وعدد الدقائق المناسب يختلف من شخص لآخر.", a:"بعد هذه الجلسة ارتح 5 إلى 10 دقائق بلا شاشة.", e:"مبدئي", s:"Dewar et al., 2012" },
    { k:"habit", t:"تحرّك كل يوم", b:"توصي منظمة الصحة العالمية بنحو 60 دقيقة يوميًا من النشاط البدني المتوسط إلى القوي لمن هم بين 5 و17 سنة. وتشير مراجعات إلى أن النشاط البدني يفيد الانتباه والأداء الدراسي بدرجة متواضعة، فهو يدعم الدراسة ولا يغني عنها.", a:"امشِ أو العب 10 دقائق قبل جلسة الدراسة أو بعدها.", e:"توصية صحية", s:"WHO, 2020; Donnelly et al., 2016" },
    { k:"push", t:"الخطأ جزء من التعلم", b:"الخطأ الذي تصحّحه يعلّمك. تشير الأبحاث إلى أن معرفة الجواب الصحيح بعد الخطأ قد تعزّز التذكّر، فلا تخجل من أخطائك.", a:"أعد حل سؤال أخطأت فيه بهدوء، ثم اشرح سبب الخطأ.", e:"متوسط", s:"Metcalfe, 2017" },
    { k:"push", t:"كن لطيفًا مع نفسك عند الإخفاق", b:"في تجارب على طلاب جامعيين، من تعاملوا مع إخفاقهم بلطف بدل لوم النفس بذلوا وقتًا أطول في الدراسة بعد الإخفاق.", a:"قل لنفسك: أخطأت وسأتعلم، ثم ابدأ بخطوة صغيرة.", e:"مبدئي", s:"Breines & Chen, 2012" },
    { k:"push", t:"تابع تقدّمك", b:"مراجعة لأكثر من 130 دراسة وجدت أن متابعة التقدم نحو الهدف تزيد احتمال بلوغه، وتزيد الفائدة حين تسجّل التقدم كتابةً.", a:"سجّل ما أنجزته اليوم قبل أن تنام.", e:"متوسط", s:"Harkin et al., 2016" },
    { k:"idea", t:"لخّص من ذاكرتك لا من الكتاب", b:"التلخيص والكتاب مفتوح أمامك قليل الفائدة في المتوسط. أما كتابة ملخص من ذاكرتك ثم مقارنته بالدرس فهو اختبار لنفسك.", a:"لخّص درس اليوم في 5 أسطر من ذاكرتك ثم قارن.", e:"متوسط", s:"Dunlosky et al., 2013" }
  ];
  var KIND = { idea:{ n:"فكرة اليوم", c:"#48cae4" }, push:{ n:"حافز اليوم", c:"#ff6b3d" }, habit:{ n:"عادة اليوم", c:"#2ecc71" } };

  var PUSH = [
    "كل مسألة تحلّها اليوم تبني ثقتك غدًا.",
    "لا يهم أن تكون بطيئًا، المهم ألّا تتوقف.",
    "المهارة تقوى بالتدريب المنتظم، وهذا ينطبق عليك أنت أيضًا.",
    "الدقيقة التي تدرسها الآن تُحسب في رصيدك.",
    "ابدأ صغيرًا: دقيقتان فقط تكفيان لتكسر حاجز البداية.",
    "الخطأ دليل أنك تحاول، وتصحيحه يعلّمك.",
    "لا تنتظر أن تشعر بالرغبة. ابدأ بخطوة صغيرة وغالبًا ستأتي الرغبة بعدها.",
    "قارن نفسك بما كنت عليه أمس، لا بالآخرين.",
    "نجومك وسلسلتك تكبر مع كل جلسة، فأكمل الطريق.",
    "الاستمرار الهادئ أقوى من الحماس المؤقت.",
    "خطوة اليوم أفضل من خطة مؤجلة.",
    "أنت لا تدرس للامتحان فقط، بل لتبني معرفة تبقى معك.",
    "إن تعثّرت اليوم فعُد غدًا. يوم واحد لا يهدم ما بنيته.",
    "تذكّر لماذا بدأت، وضع هدفك أمام عينيك.",
    "من صبر على التعب ذاق لذة الإنجاز.",
    "كل جلسة تنهيها هي فوز صغير."
  ];

  /* نصائح المواد: لكل نصيحة مصدرها في s */
  var SUBJECTS = [
    { id:"math", n:"الرياضيات", c:"#ffb400", tips:[
      { t:"افهم القاعدة قبل حفظها", b:"اسأل: من أين جاء هذا القانون؟ وجرّب مثالًا بسيطًا بيدك. الفهم والتدرب على الحل يدعمان بعضهما، والفهم يعينك على مسائل لم ترها من قبل.", s:"Rittle-Johnson et al., 2001" },
      { t:"مثال محلول ثم مسألة بنفسك", b:"ادرس حلًّا كاملًا خطوة بخطوة، واشرح لنفسك لماذا كُتبت كل خطوة، ثم حل مسألة مشابهة وحدك دون النظر.", s:"Sweller & Cooper, 1985; Chi et al., 1989" },
      { t:"حاول قبل أن تفتح الجواب", b:"جرّب حل المسألة عدة دقائق ولو تعثرت، ثم راجع الحل الصحيح. المحاولة الأولى تساعدك على تذكّر الحل بعد أن تراه.", s:"Kornell et al., 2009" },
      { t:"اخلط أنواع المسائل", b:"بعد أن تتعلم عدة أنواع، حل مسائل مختلطة في الواجب الواحد بدل نوع واحد مكرر. يستغرق وقتًا أطول لكنه يعطي تذكّرًا أفضل بعد أسابيع.", s:"Rohrer et al., 2020" },
      { t:"اكتب القوانين من ذاكرتك", b:"اكتب قوانين الفصل من ذاكرتك ثم قارنها بالكتاب وأكمل الناقص. هذا أنفع من نسخها أو قراءتها مرارًا.", s:"Roediger & Karpicke, 2006" },
      { t:"صنّف أخطاءك", b:"بعد كل واجب صنّف كل خطأ: فهم أم حساب أم تسرّع؟ معرفة نوع الخطأ تقودك إلى علاجه.", s:"Hattie & Timperley, 2007" }
    ]},
    { id:"arabic", n:"اللغة العربية", c:"#2ecc71", tips:[
      { t:"اقرأ كثيرًا لتتسع مفرداتك", b:"القراءة المنتظمة من نصوص تناسب مستواك من أهم مصادر نمو المفردات. كل مرة تمرّ بك الكلمة في سياق جديد يزداد فهمك لها.", s:"Nagy et al., 1985" },
      { t:"القواعد بالتطبيق والاختبار", b:"حلّل جملة واحدة يوميًا وعلّل الإعراب، ثم اختبر نفسك على القاعدة دون النظر إليها.", s:"Dunlosky et al., 2013" },
      { t:"الإملاء بتكرار متباعد", b:"اكتب الكلمات التي تخطئ فيها في بطاقات، واختبر نفسك عليها على أيام متباعدة بدل تكرارها عشر مرات دفعة واحدة.", s:"Cepeda et al., 2006" },
      { t:"احفظ بالمعنى وبالصوت", b:"افهم معنى الأبيات أولًا، ثم اقرأها بصوت مسموع، ثم أغلق النص وحاول قولها من الذاكرة.", s:"Craik & Lockhart, 1972; MacLeod et al., 2010" },
      { t:"خطّط قبل أن تكتب التعبير", b:"ضع ثلاث أفكار رئيسية قبل الكتابة، ثم اكتب لكل فكرة فقرة وراجع ما كتبت. تعلّم استراتيجيات التخطيط والمراجعة من أنفع ما يحسّن الكتابة لدى المراهقين.", s:"Graham & Perin, 2007" },
      { t:"لخّص النص من ذاكرتك", b:"بعد قراءة نص، أغلقه واكتب الفكرة العامة وأهم فكرة جزئية في جملتين، ثم قارن بالنص.", s:"Karpicke & Blunt, 2011" }
    ]},
    { id:"physics", n:"الفيزياء", c:"#48cae4", tips:[
      { t:"ارسم المسألة", b:"ارسم شكلًا واكتب عليه المعطيات والمطلوب قبل أن تختار قانونًا. الرسم يوضح العلاقات ويقلل الأخطاء.", s:"Larkin & Simon, 1987" },
      { t:"تنبّأ قبل أن تحسب", b:"قبل أن تحل أو تشاهد تجربة، اكتب توقعك للنتيجة ولماذا، ثم قارن. التوقع الخاطئ يريك ما تحتاج لتعديله في فهمك.", s:"Crouch et al., 2004" },
      { t:"افهم المعنى قبل التعويض", b:"اسأل: ماذا يعني كل رمز في القانون؟ وماذا يحدث للنتيجة لو زادت قيمته؟ فهم المفاهيم أهم من التعويض الآلي في الأرقام.", s:"Hake, 1998" },
      { t:"اشرح لنفسك خطوات الحل", b:"عند قراءة حل جاهز، اشرح لنفسك سبب كل خطوة: لماذا استُخدم هذا القانون هنا؟ هذه الطريقة درسها الباحثون على طلاب الفيزياء تحديدًا.", s:"Chi et al., 1989" },
      { t:"اختبر نفسك على القوانين", b:"اكتب كل قانون مع معنى رموزه من ذاكرتك، ثم صحّح من الكتاب.", s:"Roediger & Karpicke, 2006" },
      { t:"راجع على أيام", b:"وزّع مراجعة الفصل على عدة أيام، ورجّع إلى مسائله القديمة بعد أسبوع.", s:"Cepeda et al., 2006" }
    ]},
    { id:"chem", n:"الكيمياء", c:"#a78bfa", tips:[
      { t:"فكّر بثلاثة مستويات", b:"اربط ما تراه في التجربة بالرمز في المعادلة وبما يحدث للذرات والجزيئات. كثير من صعوبة الكيمياء سببه الانتقال بين هذه المستويات الثلاثة.", s:"Johnstone, 1991" },
      { t:"بطاقات للمصطلحات", b:"اكتب المصطلح على وجه والتعريف على الآخر، واختبر نفسك على أيام متباعدة، خاصة في الأحماض والقواعد والكيمياء العضوية.", s:"Dunlosky et al., 2013" },
      { t:"وازن المعادلات بالتدريب", b:"ابدأ بمثال موزون خطوة بخطوة، ثم حل معادلات بنفسك وعُدّ الذرات في الطرفين.", s:"Sweller & Cooper, 1985" },
      { t:"مسائل المول بخطة ثابتة", b:"استخدم الخطوات نفسها كل مرة: حوّل المعطيات إلى مولات، ثم استخدم نسب المعادلة الموزونة، ثم حوّل إلى الوحدة المطلوبة.", s:"Sweller et al., 1998" },
      { t:"اسأل: لماذا يحدث التفاعل؟", b:"بدل حفظ التفاعل اسأل: لماذا يحدث؟ وماذا يحدث للإلكترونات؟ أسئلة «لماذا» تربط المعلومة بما تعرفه.", s:"Dunlosky et al., 2013" },
      { t:"تدرّب بصيغة الامتحان", b:"بعد أن تذاكر، حل أسئلة بصيغة الامتحان. الاختبار نفسه تدريب على التذكّر.", s:"Roediger & Karpicke, 2006" }
    ]},
    { id:"bio", n:"الأحياء", c:"#2ecc71", tips:[
      { t:"ارسم وسمِّ من الذاكرة", b:"ارسم الخلية أو الجهاز وضع الأسماء من ذاكرتك، ثم صحّح من الكتاب.", s:"Fiorella & Zhang, 2018; Roediger & Karpicke, 2006" },
      { t:"رتّب العملية كسلسلة", b:"اكتب خطوات العملية (كالهضم أو التنفس الخلوي) بالترتيب من ذاكرتك، ثم قارن بالكتاب وأكمل الناقص.", s:"Roediger & Karpicke, 2006" },
      { t:"اسأل: لماذا؟", b:"بدل حفظ أن القلب له أربع حجرات، اسأل: لماذا أربع؟ أسئلة «لماذا» تربط المعلومة بما تعرفه.", s:"Dunlosky et al., 2013" },
      { t:"قارن بين المفاهيم المتشابهة", b:"قارن بين مفهومين متشابهين، كالانقسام المتساوي والمنصّف، في جدول بنقاط محددة. المقارنة تُبرز الفروق التي تُنسى حين تدرس كل مفهوم وحده.", s:"Alfieri et al., 2013" },
      { t:"عرّف المصطلح بكلماتك", b:"حاول كتابة التعريف من ذاكرتك بكلماتك، ثم قارنه بالكتاب. المعلومة التي تصوغها بنفسك تُتذكّر أفضل.", s:"Slamecka & Graf, 1978" },
      { t:"وزّع المراجعة على أيام", b:"راجع كل جهاز أو فصل على عدة أيام بدل جلسة واحدة طويلة.", s:"Cepeda et al., 2006" }
    ]},
    { id:"english", n:"اللغة الإنجليزية", c:"#ff6b3d", tips:[
      { t:"الكلمة داخل جملة", b:"احفظ الكلمة مع جملة وردت فيها، ثم اكتب جملة من عندك. هكذا تعرف كيف تُستعمل الكلمة لا معناها فقط.", s:"Nation, 2001" },
      { t:"مفردات بتكرار متباعد", b:"راجع المفردات بالبطاقات على أيام متباعدة بدل تكرارها كثيرًا في جلسة واحدة.", s:"Cepeda et al., 2006" },
      { t:"وازن بين المهارات", b:"تعلّم اللغة يحتاج استماعًا وقراءة، ثم كلامًا وكتابة، ثم تعلّم المفردات والقواعد، ثم تكرار ما تعرفه بسرعة. لا تكتفِ بواحدة منها.", s:"Nation, 2007" },
      { t:"اقرأ بصوت عالٍ", b:"قراءة نص قصير بصوت عالٍ تدرّب النطق، وتساعد على تذكّر المفردات.", s:"MacLeod et al., 2010" },
      { t:"يوميات قصيرة", b:"اكتب 3 جمل عن يومك بالإنجليزية. محاولة التعبير تكشف لك ما ينقصك من كلمات وقواعد.", s:"Swain, 1985" },
      { t:"القاعدة بأمثلتك أنت", b:"لكل قاعدة اكتب 3 جمل من عندك، ثم اختبر نفسك عليها بعد يوم.", s:"Slamecka & Graf, 1978; Cepeda et al., 2006" }
    ]},
    { id:"social", n:"الاجتماعيات", c:"#ffb400", tips:[
      { t:"شريط زمني من الذاكرة", b:"ارسم الخط الزمني ثم املأه بالأحداث والتواريخ من ذاكرتك، وصحّح بعدها من الكتاب.", s:"Karpicke & Blunt, 2011" },
      { t:"سبب ونتيجة", b:"لكل حدث اكتب سببه ونتيجته. سؤال «لماذا حدث هذا؟» يربط الحقائق ببعضها فيسهل تذكّرها.", s:"Dunlosky et al., 2013" },
      { t:"ارسم الخرائط بيدك", b:"في الجغرافيا ارسم الخريطة من ذاكرتك وضع عليها الأسماء، ثم صحّح.", s:"Karpicke & Blunt, 2011" },
      { t:"قارن في جدول", b:"قارن بين حضارتين أو إقليمين في جدول بنقاط محددة. المقارنة تُبرز الفروق التي تُنسى حين تدرس كل واحد وحده.", s:"Alfieri et al., 2013" },
      { t:"بطاقات للأسماء والتواريخ", b:"اكتب الأسماء والتواريخ الصعبة في بطاقات واختبر نفسك عليها على أيام متباعدة.", s:"Cepeda et al., 2006" },
      { t:"احكِ الحدث بصوتك", b:"اشرح الحدث كقصة لمن حولك: من؟ ومتى؟ ولماذا؟ وماذا نتج؟ الشرح لغيرك يكشف ما لم تفهمه.", s:"Fiorella & Mayer, 2013" }
    ]},
    { id:"islamic", n:"التربية الإسلامية", c:"#a78bfa", tips:[
      { t:"افهم المعنى ثم احفظ", b:"اقرأ المعنى أولًا ثم احفظ الآية أو الحديث. المعلومة التي تُعالَج بمعناها تُتذكّر أفضل من التي تُحفظ كأصوات فقط.", s:"Craik & Lockhart, 1972" },
      { t:"حفظ على دفعات صغيرة", b:"احفظ آية أو سطرين في كل مرة، وراجع ما حفظته على أيام متباعدة بدل تكراره كله في يوم واحد.", s:"Cepeda et al., 2006" },
      { t:"اقرأ بصوت مسموع", b:"ما تنطقه بصوتك يُحفظ غالبًا أفضل مما تقرؤه بصمت.", s:"MacLeod et al., 2010" },
      { t:"اكتب ما حفظت من الذاكرة", b:"اكتب ما حفظته من الذاكرة ثم صحّح من المصحف أو الكتاب. الكتابة تكشف الأخطاء الخفية.", s:"Roediger & Karpicke, 2006" },
      { t:"اربط الدرس بحياتك", b:"اسأل: كيف أطبّق هذا في يومي؟ ربط المعلومة بنفسك وبحياتك يقوّي تذكّرها.", s:"Rogers et al., 1977" },
      { t:"جدول للأحكام المتشابهة", b:"رتّب الأحكام المتشابهة، كأحكام التجويد، في جدول: الحكم، وتعريفه، ومثال. مقارنتها معًا تُبرز الفروق بينها.", s:"Alfieri et al., 2013" }
    ]}
  ];

  /* ============================ أدوات ============================ */
  var DAY = 86400000, BAGHDAD = 3 * 3600000;
  var DAYN = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
  var MONTHN = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  function dayIdx(){ return Math.floor((Date.now() + BAGHDAD) / DAY); }
  function dateText(d){ var x = new Date(d * DAY); return DAYN[x.getUTCDay()] + " " + x.getUTCDate() + " " + MONTHN[x.getUTCMonth()]; }
  function gcd(a, b){ return b ? gcd(b, a % b) : a; }
  function stride(n){ var c = [7, 11, 13, 17, 19, 23]; for (var i = 0; i < c.length; i++){ if (gcd(c[i], n) === 1) return c[i]; } return 1; }
  function lsGet(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
  function lsSet(k, v){ try{ localStorage.setItem(k, v); }catch(e){} }
  function el(tag, cls, text){ var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function reduced(){ try{ return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }catch(e){ return false; } }

  /* فكرة اليوم: خطوة ثابتة مع طول الدورة، فيمرّ البنك كله دون أي تكرار قبل اكتمال الدورة */
  function getToday(d){
    d = d == null ? dayIdx() : d;
    var n = DAILY.length;
    return DAILY[((d * stride(n)) % n + n) % n];
  }
  function getSubjectTip(subjectIdx, offset, d){
    var s = SUBJECTS[subjectIdx], n = s.tips.length;
    d = d == null ? dayIdx() : d;
    var i = (((d + subjectIdx * 2 + (offset || 0)) % n) + n) % n;
    return { tip: s.tips[i], i: i, n: n };
  }

  /* ============================ الأنماط ============================ */
  var CSS = [
    ".ho-coach-fab{position:fixed;left:0;top:0;width:" + SIZE + "px;height:" + SIZE + "px;border-radius:50%;z-index:25;",
    " display:flex;align-items:center;justify-content:center;padding:0;border:1px solid color-mix(in srgb,var(--accent,var(--amber,#ffb400)) 55%,var(--border,#24242e));",
    " background:radial-gradient(circle at 30% 25%,color-mix(in srgb,var(--accent,var(--amber,#ffb400)) 38%,var(--panel-2,#17171e)),var(--panel,#101015) 72%);",
    " color:var(--accent,var(--amber,#ffb400));cursor:grab;touch-action:none;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;",
    " box-shadow:0 6px 18px rgba(0,0,0,.5),0 0 0 4px color-mix(in srgb,var(--accent,var(--amber,#ffb400)) 12%,transparent);",
    " transition:left .28s cubic-bezier(.2,.8,.2,1),top .28s cubic-bezier(.2,.8,.2,1),transform .28s cubic-bezier(.2,.8,.2,1),opacity .28s;opacity:1;}",
    ".ho-coach-fab.drag{transition:none;cursor:grabbing;transform:scale(1.1);}",
    ".ho-coach-fab.peek-l{transform:translateX(-40%);opacity:.72;}",
    ".ho-coach-fab.peek-r{transform:translateX(40%);opacity:.72;}",
    ".ho-coach-fab:active{filter:brightness(1.1);}",
    ".ho-coach-fab svg{width:26px;height:26px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;pointer-events:none;}",
    ".ho-coach-dot{position:absolute;top:4px;right:4px;width:12px;height:12px;border-radius:50%;background:#ff3b30;border:2px solid var(--panel,#101015);display:none;}",
    ".ho-coach-fab.has-new .ho-coach-dot{display:block;}",
    "body:has(#runningView:not(.hidden)) .ho-coach-fab,body:has(#pomoRunningView:not(.hidden)) .ho-coach-fab{display:none !important;}",

    ".ho-coach-ov{position:fixed;inset:0;z-index:8500;display:none;align-items:flex-end;justify-content:center;background:rgba(3,5,10,.72);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);}",
    ".ho-coach-ov.show{display:flex;animation:hoCoachFade .2s ease both;}",
    ".ho-coach-sheet{width:min(560px,100%);height:min(86vh,700px);display:flex;flex-direction:column;border:1px solid var(--border,#24242e);border-bottom:none;",
    " border-radius:24px 24px 0 0;background:linear-gradient(180deg,var(--panel-2,#17171e),var(--panel,#101015));box-shadow:0 -18px 48px rgba(0,0,0,.55);",
    " padding-bottom:var(--safe-b,env(safe-area-inset-bottom,0px));animation:hoCoachUp .3s cubic-bezier(.2,.8,.2,1) both;touch-action:pan-y;}",
    ".ho-coach-grip{padding:10px 0 4px;cursor:grab;touch-action:none;}",
    ".ho-coach-grip i{display:block;width:42px;height:4px;border-radius:4px;background:var(--border,#24242e);margin:0 auto;}",
    ".ho-coach-head{display:flex;align-items:center;gap:10px;padding:6px 18px 12px;}",
    ".ho-coach-head .av{width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--accent,var(--amber,#ffb400));",
    " background:color-mix(in srgb,var(--accent,var(--amber,#ffb400)) 16%,var(--panel,#101015));border:1px solid color-mix(in srgb,var(--accent,var(--amber,#ffb400)) 45%,var(--border,#24242e));}",
    ".ho-coach-head .av svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;}",
    ".ho-coach-head h2{margin:0;font-size:1.05rem;font-weight:900;color:var(--text,#f3f4f8);line-height:1.3;}",
    ".ho-coach-head small{display:block;color:var(--muted,#9094a3);font-size:.78rem;font-weight:700;}",
    ".ho-coach-x{margin-inline-start:auto;width:38px;height:38px;border-radius:12px;border:1px solid var(--border,#24242e);background:var(--panel,#101015);color:var(--muted,#9094a3);font-size:1.1rem;cursor:pointer;font-family:inherit;}",
    ".ho-coach-body{flex:1;min-height:0;display:flex;flex-direction:column;padding:0 18px 14px;}",
    ".ho-coach-pane{flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;}",
    ".ho-coach-tabs{display:none;gap:6px;padding:0 18px 12px;}",
    ".ho-coach-tabs.show{display:flex;}",
    ".ho-coach-tab{flex:1;padding:9px;border-radius:12px;border:1px solid var(--border,#24242e);background:var(--panel,#101015);color:var(--muted,#9094a3);font-weight:900;font-family:inherit;font-size:.86rem;cursor:pointer;}",
    ".ho-coach-tab.on{color:var(--accent,var(--amber,#ffb400));border-color:var(--accent,var(--amber,#ffb400));background:color-mix(in srgb,var(--accent,var(--amber,#ffb400)) 10%,var(--panel,#101015));}",
    ".ho-coach-chat{display:none;flex-direction:column;flex:1;min-height:0;}",
    ".ho-coach-chat.show{display:flex;}",
    ".ho-coach-msgs{flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;display:flex;flex-direction:column;gap:8px;padding:2px 2px 10px;}",
    ".ho-coach-msg{max-width:88%;padding:10px 13px;border-radius:16px;font-size:.92rem;line-height:1.85;white-space:pre-wrap;word-break:break-word;color:var(--text,#f3f4f8);}",
    ".ho-coach-msg.user{align-self:flex-start;border-end-start-radius:4px;background:color-mix(in srgb,var(--accent,var(--amber,#ffb400)) 20%,var(--panel,#101015));border:1px solid color-mix(in srgb,var(--accent,var(--amber,#ffb400)) 45%,var(--border,#24242e));}",
    ".ho-coach-msg.assistant{align-self:flex-end;border-end-end-radius:4px;background:var(--panel,#101015);border:1px solid var(--border,#24242e);}",
    ".ho-coach-msg.note{align-self:center;max-width:96%;text-align:center;font-size:.8rem;color:#ff9f43;background:rgba(255,159,67,.08);border:1px solid rgba(255,159,67,.3);}",
    ".ho-coach-msg.intro{align-self:stretch;max-width:100%;}",
    ".ho-coach-typing{display:inline-flex;gap:5px;align-items:center;}",
    ".ho-coach-typing i{width:7px;height:7px;border-radius:50%;background:var(--muted,#9094a3);animation:hoCoachDot 1s infinite ease-in-out;}",
    ".ho-coach-typing i:nth-child(2){animation-delay:.15s;}.ho-coach-typing i:nth-child(3){animation-delay:.3s;}",
    ".ho-coach-quick{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;}",
    ".ho-coach-q{padding:8px 12px;border-radius:99px;border:1px solid var(--border,#24242e);background:var(--panel-2,#17171e);color:#d6d7de;font-family:inherit;font-weight:800;font-size:.82rem;cursor:pointer;}",
    ".ho-coach-bar{display:flex;gap:8px;align-items:flex-end;padding-top:8px;border-top:1px solid var(--border,#24242e);}",
    ".ho-coach-in{flex:1;min-width:0;resize:none;max-height:110px;padding:10px 12px;border-radius:14px;border:1px solid var(--border,#24242e);background:var(--panel,#101015);color:var(--text,#f3f4f8);font-family:inherit;font-size:16px;line-height:1.6;outline:none;}",
    ".ho-coach-in:focus{border-color:var(--accent,var(--amber,#ffb400));}",
    ".ho-coach-send{width:46px;height:44px;flex-shrink:0;border-radius:14px;border:none;background:var(--accent,var(--amber,#ffb400));color:#1a1305;font-size:1.15rem;font-weight:900;cursor:pointer;}",
    ".ho-coach-send:disabled{opacity:.45;cursor:default;}",
    ".ho-coach-meta{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 2px 0;font-size:.74rem;color:var(--muted,#9094a3);font-weight:700;}",
    ".ho-coach-clear{background:none;border:none;color:var(--muted,#9094a3);font-family:inherit;font-weight:800;font-size:.74rem;cursor:pointer;text-decoration:underline;padding:2px;}",
    "@keyframes hoCoachDot{0%,80%,100%{transform:scale(.6);opacity:.4}40%{transform:scale(1);opacity:1}}",
    ".ho-coach-today{border-radius:18px;padding:16px;margin-bottom:16px;border:1px solid color-mix(in srgb,var(--kc,#48cae4) 45%,var(--border,#24242e));",
    " background:linear-gradient(160deg,color-mix(in srgb,var(--kc,#48cae4) 16%,var(--panel,#101015)),var(--panel,#101015) 70%);}",
    ".ho-coach-badge{display:inline-flex;align-items:center;gap:6px;font-size:.74rem;font-weight:900;color:var(--kc,#48cae4);padding:3px 10px;border-radius:99px;background:color-mix(in srgb,var(--kc,#48cae4) 14%,transparent);}",
    ".ho-coach-date{float:left;font-size:.74rem;color:var(--muted,#9094a3);font-weight:700;margin-top:3px;}",
    ".ho-coach-today h3{margin:10px 0 6px;font-size:1.12rem;font-weight:900;color:var(--text,#f3f4f8);line-height:1.5;}",
    ".ho-coach-today p{margin:0;color:#d6d7de;font-size:.92rem;line-height:1.9;}",
    ".ho-coach-do{margin-top:12px;padding:10px 12px;border-radius:12px;background:rgba(0,0,0,.28);border:1px dashed color-mix(in srgb,var(--kc,#48cae4) 50%,var(--border,#24242e));color:var(--text,#f3f4f8);font-size:.86rem;line-height:1.8;}",
    ".ho-coach-do b{color:var(--kc,#48cae4);margin-inline-end:4px;}",
    ".ho-coach-nudge{margin-top:10px;font-size:.8rem;color:var(--accent,var(--amber,#ffb400));font-weight:800;}",
    ".ho-coach-src{margin-top:10px;font-size:.72rem;line-height:1.8;color:var(--muted,#9094a3);}",
    ".ho-coach-src .lvl{font-weight:800;color:var(--kc,var(--sc,#48cae4));}",
    ".ho-coach-src bdi{unicode-bidi:isolate;font-family:inherit;}",
    ".ho-coach-sec{margin:0 0 10px;font-size:.82rem;font-weight:900;color:var(--muted,#9094a3);}",
    ".ho-coach-chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;}",
    ".ho-coach-chip{padding:8px 13px;border-radius:99px;border:1px solid var(--border,#24242e);background:var(--panel,#101015);color:#d6d7de;font-family:inherit;font-weight:800;font-size:.84rem;cursor:pointer;}",
    ".ho-coach-chip.on{border-color:var(--sc);color:var(--sc);background:color-mix(in srgb,var(--sc) 12%,var(--panel,#101015));}",
    ".ho-coach-tip{border-radius:16px;padding:14px;border:1px solid var(--border,#24242e);border-inline-start:4px solid var(--sc,#ffb400);background:var(--panel,#101015);margin-bottom:10px;}",
    ".ho-coach-tip h4{margin:0 0 6px;font-size:1rem;font-weight:900;color:var(--text,#f3f4f8);}",
    ".ho-coach-tip p{margin:0;color:#d6d7de;font-size:.9rem;line-height:1.9;}",
    ".ho-coach-row{display:flex;gap:8px;align-items:center;}",
    ".ho-coach-btn{flex:1;padding:11px;border-radius:12px;border:1px solid var(--border,#24242e);background:var(--panel-2,#17171e);color:var(--text,#f3f4f8);font-family:inherit;font-weight:900;font-size:.88rem;cursor:pointer;}",
    ".ho-coach-btn.pri{background:var(--accent,var(--amber,#ffb400));border-color:var(--accent,var(--amber,#ffb400));color:#1a1305;}",
    ".ho-coach-count{font-size:.76rem;color:var(--muted,#9094a3);font-weight:800;min-width:38px;text-align:center;}",
    ".ho-coach-push{margin-top:16px;}",
    ".ho-coach-bubble{margin-top:10px;padding:12px 14px;border-radius:16px 16px 16px 4px;background:color-mix(in srgb,var(--accent,var(--amber,#ffb400)) 12%,var(--panel,#101015));",
    " border:1px solid color-mix(in srgb,var(--accent,var(--amber,#ffb400)) 40%,var(--border,#24242e));color:var(--text,#f3f4f8);font-weight:800;font-size:.92rem;line-height:1.8;}",
    ".ho-coach-bubble:empty{display:none;}",
    ".ho-coach-bubble.pop{animation:hoCoachPop .35s cubic-bezier(.2,.8,.2,1) both;}",
    ".ho-coach-foot{margin:16px 0 0;font-size:.72rem;color:var(--muted,#9094a3);text-align:center;line-height:1.7;}",
    "@keyframes hoCoachFade{from{opacity:0}to{opacity:1}}",
    "@keyframes hoCoachUp{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}",
    "@keyframes hoCoachPop{from{transform:scale(.94);opacity:0}to{transform:none;opacity:1}}",
    "@media (prefers-reduced-motion:reduce){.ho-coach-fab,.ho-coach-sheet,.ho-coach-ov.show,.ho-coach-bubble.pop{animation:none !important;transition:none !important;}}"
  ].join("\n");

  var ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2l1.9 4.4 4.7.5-3.5 3.2 1 4.7L12 13.5 7.9 16l1-4.7L5.4 8.1l4.7-.5Z"/><path d="M18.5 16.5l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7Z"/></svg>';
  var ICON_BULB = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2h5c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3Z"/></svg>';

  /* ============================ الحالة والواجهة ============================ */
  var fab, dotEl, ov, sheet, bodyEl, todayBox, subjBox, bubble;
  var pos = { side: "l", y: 0.58 };
  var cur = { l: 0, t: 0 };
  var dragState = null, dragging = false, justDragged = false, idleTimer = null, probe = null;
  var subjIdx = 0, subjOffset = 0, lastPush = -1, lastFocus = null, inited = false;

  /* ---------- المحادثة الحية ---------- */
  var LS_CHAT = "ho_coach_chat", MAX_HIST = 30, SEND_CTX = 8, MAX_IN = 500;
  var tabsEl, tabToday, tabChat, paneToday, paneChat, msgsEl, inputEl, sendBtn, metaEl;
  var chat = [], chatEnabled = false, sending = false, remaining = null, noteText = "", lastEnabledCheck = 0, tab = "today";
  var QUICK = ["كيف أبدأ الدراسة الآن؟", "اعمل لي خطة مراجعة لمادة", "أحتاج حافزًا", "كيف أزيد تركيزي؟"];
  var ERR = {
    "disabled": "المحادثة متوقفة حاليًا.",
    "no-profile": "أنشئ ملفك الشخصي من الصفحة الرئيسية لتستخدم المحادثة.",
    "daily-limit": "انتهت رسائلك لليوم. عُد غدًا، وفي الأثناء جرّب نصائح المواد!",
    "slow-down": "على مهلك! انتظر ثوانٍ ثم أرسل.",
    "global-limit": "المساعد مشغول اليوم. حاول غدًا.",
    "bad-input": "تعذّر إرسال هذه الرسالة، جرّب صياغة أخرى.",
    "firebase-not-ready": "تأكد من اتصالك بالإنترنت ثم حاول.",
    "no-user": "تأكد من اتصالك بالإنترنت ثم حاول."
  };
  function loadChat(){
    try{
      var a = JSON.parse(lsGet(LS_CHAT) || "[]");
      if (Array.isArray(a)) chat = a.filter(function(m){ return m && (m.role === "user" || m.role === "assistant") && typeof m.text === "string" && m.text; })
        .slice(-MAX_HIST).map(function(m){ return { role: m.role, text: m.text.slice(0, 1200) }; });
    }catch(e){ chat = []; }
  }
  function saveChat(){ lsSet(LS_CHAT, JSON.stringify(chat.slice(-MAX_HIST))); }

  function loadPos(){
    try{
      var o = JSON.parse(lsGet(LS_POS) || "null");
      if (o && (o.side === "l" || o.side === "r") && typeof o.y === "number" && isFinite(o.y)) pos = { side: o.side, y: Math.max(0, Math.min(1, o.y)) };
    }catch(e){}
  }
  function savePos(){ lsSet(LS_POS, JSON.stringify(pos)); }

  function safe(){
    if (!probe){
      probe = el("div");
      probe.style.cssText = "position:fixed;visibility:hidden;pointer-events:none;left:0;top:0;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px);";
      document.body.appendChild(probe);
    }
    var cs = getComputedStyle(probe);
    return { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
  }
  function bounds(){
    var s = safe(), vw = window.innerWidth, vh = window.innerHeight;
    return {
      minX: s.l + MARGIN, maxX: vw - SIZE - MARGIN - s.r,
      minY: s.t + 64, maxY: Math.max(s.t + 64, vh - SIZE - MARGIN - s.b - 8)
    };
  }
  function place(animate){
    var b = bounds();
    cur.l = pos.side === "l" ? b.minX : b.maxX;
    cur.t = Math.round(b.minY + pos.y * (b.maxY - b.minY));
    if (!animate) fab.style.transition = "none";
    fab.style.left = cur.l + "px"; fab.style.top = cur.t + "px";
    if (!animate){ void fab.offsetWidth; fab.style.transition = ""; }
  }
  function setPeek(on){
    fab.classList.remove("peek-l", "peek-r");
    if (on && !dragging && !ov.classList.contains("show")) fab.classList.add(pos.side === "l" ? "peek-l" : "peek-r");
  }
  function wake(){
    setPeek(false);
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function(){ setPeek(true); }, IDLE_MS);
  }

  function onDown(e){
    if (e.button != null && e.button !== 0) return;
    dragState = { x: e.clientX, y: e.clientY, l: cur.l, t: cur.t };
    dragging = false;
    try{ fab.setPointerCapture(e.pointerId); }catch(err){}
    wake();
  }
  function onMove(e){
    if (!dragState) return;
    var dx = e.clientX - dragState.x, dy = e.clientY - dragState.y;
    if (!dragging && Math.sqrt(dx * dx + dy * dy) > DRAG_PX){ dragging = true; fab.classList.add("drag"); setPeek(false); }
    if (!dragging) return;
    var b = bounds();
    cur.l = Math.max(b.minX, Math.min(b.maxX, dragState.l + dx));
    cur.t = Math.max(b.minY, Math.min(b.maxY, dragState.t + dy));
    fab.style.left = cur.l + "px"; fab.style.top = cur.t + "px";
    if (e.cancelable) e.preventDefault();
  }
  function onUp(){
    if (!dragState) return;
    var wasDrag = dragging;
    dragState = null; dragging = false;
    fab.classList.remove("drag");
    if (wasDrag){
      var b = bounds();
      pos.side = (cur.l + SIZE / 2) < window.innerWidth / 2 ? "l" : "r";
      pos.y = b.maxY > b.minY ? Math.max(0, Math.min(1, (cur.t - b.minY) / (b.maxY - b.minY))) : 0.5;
      savePos(); place(true);
      justDragged = true; setTimeout(function(){ justDragged = false; }, 60);
    }
    wake();
  }

  /* سطر المصدر وقوة الدليل تحت النصيحة */
  function srcLine(level, src){
    var d = el("div", "ho-coach-src");
    if (level){ d.appendChild(el("span", "lvl", "قوة الدليل: " + level)); d.appendChild(document.createTextNode(" · ")); }
    d.appendChild(document.createTextNode("المصدر: "));
    var b = document.createElement("bdi"); b.setAttribute("dir", "ltr"); b.textContent = src; d.appendChild(b);
    return d;
  }

  /* ---------- اللوحة ---------- */
  function renderToday(){
    var it = getToday(), kd = KIND[it.k] || KIND.idea;
    todayBox.style.setProperty("--kc", kd.c);
    todayBox.textContent = "";
    var top = el("div");
    var badge = el("span", "ho-coach-badge", kd.n);
    var date = el("span", "ho-coach-date", dateText(dayIdx()));
    top.appendChild(badge); top.appendChild(date);
    todayBox.appendChild(top);
    todayBox.appendChild(el("h3", "", it.t));
    todayBox.appendChild(el("p", "", it.b));
    var d = el("div", "ho-coach-do"); d.appendChild(el("b", "", "جرّب الآن:")); d.appendChild(document.createTextNode(it.a));
    todayBox.appendChild(d);
    if (it.s) todayBox.appendChild(srcLine(it.e, it.s));
    /* تذكير مفيد فقط إن وُجدت نجوم جاهزة للاستلام */
    try{
      if (window.HOMissions && typeof HOMissions.state === "function"){
        var S = HOMissions.state();
        if (S && S.claimable > 0) todayBox.appendChild(el("div", "ho-coach-nudge", "لديك " + S.claimable + (S.claimable === 1 ? " مهمة جاهزة" : " مهام جاهزة") + " لتستلم نجومها ★"));
      }
    }catch(e){}
  }
  function renderSubjects(){
    subjBox.textContent = "";
    var chips = el("div", "ho-coach-chips");
    SUBJECTS.forEach(function(s, i){
      var c = el("button", "ho-coach-chip" + (i === subjIdx ? " on" : ""), s.n);
      c.type = "button"; c.style.setProperty("--sc", s.c);
      c.addEventListener("click", function(){ if (i !== subjIdx){ subjIdx = i; subjOffset = 0; } renderSubjects(); });
      chips.appendChild(c);
    });
    subjBox.appendChild(chips);
    var r = getSubjectTip(subjIdx, subjOffset), s = SUBJECTS[subjIdx];
    var card = el("div", "ho-coach-tip"); card.style.setProperty("--sc", s.c);
    card.appendChild(el("h4", "", r.tip.t)); card.appendChild(el("p", "", r.tip.b));
    if (r.tip.s) card.appendChild(srcLine(null, r.tip.s));
    subjBox.appendChild(card);
    var row = el("div", "ho-coach-row");
    var next = el("button", "ho-coach-btn", "نصيحة أخرى ↻"); next.type = "button";
    next.addEventListener("click", function(){ subjOffset = (subjOffset + 1) % r.n; renderSubjects(); });
    row.appendChild(next);
    row.appendChild(el("span", "ho-coach-count", (r.i + 1) + " / " + r.n));
    subjBox.appendChild(row);
  }
  function showPush(){
    var i = Math.floor(Math.random() * PUSH.length);
    if (PUSH.length > 1 && i === lastPush) i = (i + 1) % PUSH.length;
    lastPush = i;
    bubble.textContent = PUSH[i];
    bubble.classList.remove("pop"); void bubble.offsetWidth; bubble.classList.add("pop");
  }

  function autoGrow(){ inputEl.style.height = "auto"; inputEl.style.height = Math.min(110, inputEl.scrollHeight) + "px"; }
  function bubbleEl(role, text){ var m = el("div", "ho-coach-msg " + role); m.textContent = text; return m; }
  function renderChat(typing){
    msgsEl.textContent = "";
    if (!chat.length){
      var intro = bubbleEl("assistant intro", "أهلًا! أنا مساعد الدراسة. اسألني عن طريقة دراسة مادة، أو خطة مراجعة، أو كيف تركّز أكثر، أو اطلب حافزًا.");
      var q = el("div", "ho-coach-quick");
      QUICK.forEach(function(t){
        var b = el("button", "ho-coach-q", t); b.type = "button";
        b.addEventListener("click", function(){ send(t); });
        q.appendChild(b);
      });
      intro.appendChild(q); msgsEl.appendChild(intro);
    }
    chat.forEach(function(m){ msgsEl.appendChild(bubbleEl(m.role, m.text)); });
    if (typing){ var t = el("div", "ho-coach-msg assistant"); var d = el("span", "ho-coach-typing"); d.appendChild(el("i")); d.appendChild(el("i")); d.appendChild(el("i")); t.appendChild(d); msgsEl.appendChild(t); }
    if (noteText) msgsEl.appendChild(bubbleEl("note", noteText));
    msgsEl.scrollTop = msgsEl.scrollHeight;
    renderMeta();
  }
  function renderMeta(){
    metaEl.textContent = "";
    var left = el("span", "", remaining == null ? "" : (remaining > 0 ? "متبقي " + remaining + (remaining === 1 ? " رسالة" : " رسائل") + " اليوم" : "انتهت رسائل اليوم"));
    metaEl.appendChild(left);
    if (chat.length){
      var c = el("button", "ho-coach-clear", "مسح المحادثة"); c.type = "button";
      c.addEventListener("click", function(){ if (sending) return; chat = []; noteText = ""; saveChat(); renderChat(); });
      metaEl.appendChild(c);
    }
    sendBtn.disabled = sending || remaining === 0;
    inputEl.disabled = sending;
  }
  function send(text){
    text = String(text == null ? "" : text).trim().slice(0, MAX_IN);
    if (!text || sending) return;
    if (remaining === 0) return;
    if (typeof window.callWorker !== "function"){ noteText = "المحادثة غير متاحة في هذه الصفحة."; renderChat(); return; }
    sending = true; noteText = "";
    chat.push({ role: "user", text: text });
    inputEl.value = ""; autoGrow();
    renderChat(true);
    var ctx = chat.slice(-SEND_CTX).map(function(m){ return { role: m.role, text: m.text }; });
    window.callWorker("/coach/chat", { messages: ctx }).then(function(r){
      var reply = String((r && r.reply) || "").trim();
      if (!reply) throw { code: "empty" };
      chat.push({ role: "assistant", text: reply });
      if (r && typeof r.remaining === "number") remaining = r.remaining;
      saveChat();
    }).catch(function(e){
      chat.pop();                                   /* الرسالة لم تُجَب: نرجعها لمربع الكتابة ليعيد المحاولة */
      inputEl.value = text; autoGrow();
      var code = e && e.code;
      if (code === "daily-limit") remaining = 0;
      if (code === "disabled"){ chatEnabled = false; updateTabs(); }
      noteText = ERR[code] || "تعذّر الرد الآن، حاول بعد قليل.";
    }).then(function(){ sending = false; renderChat(); });
  }
  function setTab(name){
    if (name === "chat" && !chatEnabled) name = "today";
    tab = name;
    tabToday.classList.toggle("on", name === "today"); tabChat.classList.toggle("on", name === "chat");
    paneToday.style.display = name === "today" ? "" : "none";
    paneChat.classList.toggle("show", name === "chat");
    if (name === "chat") renderChat();
  }
  function updateTabs(){
    tabsEl.classList.toggle("show", !!chatEnabled);
    if (!chatEnabled && tab === "chat") setTab("today");
  }
  /* هل فعّل الأدمن المحادثة؟ قراءة خفيفة من فايربيس (تُعاد كل 5 دقائق كحد أقصى) */
  function checkEnabled(force){
    var now = Date.now();
    if (!force && now - lastEnabledCheck < 300000) return;
    try{
      if (typeof firebase !== "undefined" && firebase.apps && firebase.apps.length && typeof firebase.database === "function"){
        lastEnabledCheck = now;
        firebase.database().ref("coachSettings/enabled").once("value").then(function(s){ chatEnabled = s.val() === true; updateTabs(); }).catch(function(){});
      }
    }catch(e){}
  }

  function build(){
    styleEl = el("style"); styleEl.textContent = CSS; document.head.appendChild(styleEl);

    fab = el("button", "ho-coach-fab"); fab.type = "button";
    fab.setAttribute("aria-label", "مساعد الدراسة"); fab.title = "مساعد الدراسة";
    fab.innerHTML = ICON;
    dotEl = el("span", "ho-coach-dot"); fab.appendChild(dotEl);
    document.body.appendChild(fab);

    ov = el("div", "ho-coach-ov");
    ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", "مساعد الدراسة");
    sheet = el("div", "ho-coach-sheet");
    var grip = el("div", "ho-coach-grip"); grip.appendChild(el("i"));
    sheet.appendChild(grip);
    var head = el("div", "ho-coach-head");
    var av = el("div", "av"); av.innerHTML = ICON_BULB;
    var tx = el("div"); tx.appendChild(el("h2", "", "مساعد الدراسة")); tx.appendChild(el("small", "", "أفكار ونصائح وحافز لك كل يوم"));
    var x = el("button", "ho-coach-x", "✕"); x.type = "button"; x.setAttribute("aria-label", "إغلاق");
    x.addEventListener("click", close);
    head.appendChild(av); head.appendChild(tx); head.appendChild(x);
    sheet.appendChild(head);

    /* تبويبان: اليوم (الأفكار والنصائح) + اسأل المساعد (يظهر فقط إذا فعّله الأدمن) */
    tabsEl = el("div", "ho-coach-tabs");
    tabToday = el("button", "ho-coach-tab on", "اليوم"); tabToday.type = "button";
    tabChat = el("button", "ho-coach-tab", "اسأل المساعد"); tabChat.type = "button";
    tabToday.addEventListener("click", function(){ setTab("today"); });
    tabChat.addEventListener("click", function(){ setTab("chat"); });
    tabsEl.appendChild(tabToday); tabsEl.appendChild(tabChat);
    sheet.appendChild(tabsEl);

    bodyEl = el("div", "ho-coach-body");
    paneToday = el("div", "ho-coach-pane");
    todayBox = el("div", "ho-coach-today");
    paneToday.appendChild(todayBox);
    paneToday.appendChild(el("p", "ho-coach-sec", "نصائح حسب المادة"));
    subjBox = el("div"); paneToday.appendChild(subjBox);
    var pushWrap = el("div", "ho-coach-push");
    var pb = el("button", "ho-coach-btn pri", "حفّزني الآن"); pb.type = "button";
    pb.addEventListener("click", showPush);
    bubble = el("div", "ho-coach-bubble"); bubble.setAttribute("aria-live", "polite");
    pushWrap.appendChild(pb); pushWrap.appendChild(bubble);
    paneToday.appendChild(pushWrap);
    paneToday.appendChild(el("p", "ho-coach-foot", "النصائح مبنية على أبحاث علم النفس التعليمي وتوصيات صحية، ومصدر كل نصيحة تحتها. أثرها يختلف من طالب لآخر، فجرّب ما يناسبك."));
    bodyEl.appendChild(paneToday);

    paneChat = el("div", "ho-coach-chat");
    msgsEl = el("div", "ho-coach-msgs"); msgsEl.setAttribute("aria-live", "polite");
    paneChat.appendChild(msgsEl);
    var bar = el("div", "ho-coach-bar");
    inputEl = el("textarea", "ho-coach-in"); inputEl.rows = 1; inputEl.maxLength = MAX_IN; inputEl.placeholder = "اكتب سؤالك عن الدراسة...";
    inputEl.setAttribute("aria-label", "رسالتك");
    sendBtn = el("button", "ho-coach-send", "➤"); sendBtn.type = "button"; sendBtn.setAttribute("aria-label", "إرسال");
    bar.appendChild(inputEl); bar.appendChild(sendBtn);
    paneChat.appendChild(bar);
    metaEl = el("div", "ho-coach-meta");
    paneChat.appendChild(metaEl);
    bodyEl.appendChild(paneChat);
    inputEl.addEventListener("input", autoGrow);
    inputEl.addEventListener("keydown", function(e){
      var touch = false; try{ touch = window.matchMedia("(pointer:coarse)").matches; }catch(err){}
      if (e.key === "Enter" && !e.shiftKey && !touch){ e.preventDefault(); send(inputEl.value); }
    });
    sendBtn.addEventListener("click", function(){ send(inputEl.value); });
    sheet.appendChild(bodyEl);
    ov.appendChild(sheet); document.body.appendChild(ov);

    /* إغلاق: ضغط على الخلفية، Esc، أو سحب المقبض للأسفل */
    ov.addEventListener("click", function(e){ if (e.target === ov) close(); });
    document.addEventListener("keydown", function(e){ if (e.key === "Escape" && ov.classList.contains("show")) close(); });
    var gy = null;
    grip.addEventListener("pointerdown", function(e){ gy = { y: e.clientY, dy: 0 }; try{ grip.setPointerCapture(e.pointerId); }catch(err){} });
    grip.addEventListener("pointermove", function(e){
      if (!gy) return; gy.dy = Math.max(0, e.clientY - gy.y);
      sheet.style.transition = "none"; sheet.style.transform = "translateY(" + gy.dy + "px)";
    });
    function gripEnd(){
      if (!gy) return; var far = gy.dy > 90; gy = null;
      sheet.style.transition = "transform .2s ease"; sheet.style.transform = "";
      setTimeout(function(){ sheet.style.transition = ""; }, 220);
      if (far) close();
    }
    grip.addEventListener("pointerup", gripEnd); grip.addEventListener("pointercancel", gripEnd);

    fab.addEventListener("pointerdown", onDown);
    fab.addEventListener("pointermove", onMove);
    fab.addEventListener("pointerup", onUp);
    fab.addEventListener("pointercancel", onUp);
    fab.addEventListener("click", function(e){ if (justDragged){ e.preventDefault(); return; } open(); });
    fab.addEventListener("pointerenter", wake);
    fab.addEventListener("focus", wake);
    window.addEventListener("resize", function(){ place(false); });
    window.addEventListener("orientationchange", function(){ setTimeout(function(){ place(false); }, 250); });
  }

  function open(){
    lastFocus = document.activeElement;
    renderToday(); renderSubjects(); bubble.textContent = "";
    updateTabs(); setTab("today"); checkEnabled(false);
    ov.classList.add("show"); setPeek(false); clearTimeout(idleTimer);
    document.documentElement.style.overflow = "hidden";
    lsSet(LS_SEEN, String(dayIdx())); fab.classList.remove("has-new");
    try{ ov.querySelector(".ho-coach-x").focus(); }catch(e){}
  }
  function close(){
    ov.classList.remove("show");
    document.documentElement.style.overflow = "";
    try{ if (lastFocus && lastFocus.focus) lastFocus.focus(); else fab.focus(); }catch(e){}
    wake();
  }

  /* حارس البقاء: لو حذفت صفحة أو سكربت آخر الزر أو الأنماط من الصفحة (أو عادت الصفحة من الكاش) نعيدهما */
  function keepAlive(){
    try{
      if (!fab || !document.body) return;
      if (styleEl && !document.contains(styleEl)) document.head.appendChild(styleEl);
      if (!document.body.contains(fab)){ document.body.appendChild(fab); place(false); }
      if (ov && !document.body.contains(ov)) document.body.appendChild(ov);
    }catch(e){}
  }

  function init(){
    if (inited || !document.body) return; inited = true;
    try{ loadPos(); loadChat(); build(); place(false); }
    catch(e){ try{ console.error("HOCoach: فشل التهيئة", e); }catch(e2){} }
    if (!fab) return;
    window.addEventListener("pageshow", keepAlive);
    document.addEventListener("visibilitychange", function(){ if (!document.hidden) keepAlive(); });
    setInterval(keepAlive, 4000);
    setTimeout(function(){ checkEnabled(true); }, 2500);
    if (lsGet(LS_SEEN) !== String(dayIdx())) fab.classList.add("has-new");
    wake();
    /* لو بقيت الصفحة مفتوحة حتى اليوم التالي تظهر نقطة الفكرة الجديدة */
    setInterval(function(){ if (lsGet(LS_SEEN) !== String(dayIdx())) fab.classList.add("has-new"); }, 60000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();

  window.HOCoach = { open: open, close: close, _chat: function(){ return chat; }, getToday: getToday, getSubjectTip: getSubjectTip, SUBJECTS: SUBJECTS, DAILY: DAILY, PUSH: PUSH };
})();

/* ================================================================
   coach.js — «مساعد الدراسة»: زر عائم يحرّكه الطالب + لوحة فيها فكرة اليوم
   ونصائح لكل مادة وحافز. ملف مستقل: يُضاف بسطر <script src="coach.js"></script>.

   • الزر: يُسحب بحرية، وعند الإفلات يلتصق بأقرب جانب (يمين/يسار) ويحفظ ارتفاعه.
     بعد ثوانٍ بلا لمس ينسحب نصفه خلف الحافة. نقطة صغيرة تنبّه بفكرة اليوم الجديدة.
   • يختفي تلقائيًا أثناء تشغيل مؤقت الطالب (#runningView / #pomoRunningView).
   • المحتوى: بنك نصائح مكتوب ومراجَع يدويًا (لا يحتاج إنترنت ولا مفتاح ذكاء اصطناعي).
     فكرة اليوم تتبدّل كل يوم (بتوقيت بغداد) ولا تتكرر قبل أن تنتهي الدورة كاملة.
     المحادثة الحية (تبويب «اسأل المساعد»): تمر عبر الـ Worker (/coach/chat) بتوكن فايربيس، وتظهر فقط حين
     يفعّلها الأدمن (coachSettings/enabled). السجل يُحفظ في جهاز الطالب فقط (آخر 30 رسالة).
   ================================================================ */
(function(){
  "use strict";
  if (window.HOCoach) return;

  var LS_POS = "ho_coach_pos", LS_SEEN = "ho_coach_seen";
  var SIZE = 54, MARGIN = 8, IDLE_MS = 4000, DRAG_PX = 8;

  /* ============================ المحتوى ============================ */
  /* k: idea = فكرة دراسة، push = حافز، habit = عادة. a = «جرّب الآن». */
  var DAILY = [
    { k:"idea",  t:"اختبر نفسك قبل أن تراجع", b:"أغلق الكتاب واكتب كل ما تتذكره عن الدرس، ثم افتحه وصحّح. الاسترجاع من الذاكرة يثبّت المعلومة أكثر من إعادة القراءة.", a:"اكتب 5 أشياء تتذكرها من آخر درس درسته." },
    { k:"idea",  t:"قاعدة الـ 25 دقيقة", b:"ادرس 25 دقيقة بتركيز كامل ثم استرح 5 دقائق. التقسيم يسهّل البدء ويحمي تركيزك من التعب.", a:"شغّل جلسة بومودورو الآن وابدأ بأصعب مادة." },
    { k:"push",  t:"الخطوة الأولى هي الأصعب", b:"لا تنتظر الحماس ليبدأ. ابدأ بدقيقتين فقط، وغالبًا سيأتي الحماس بعد أن تبدأ.", a:"افتح كتاب مادة وأنجز دقيقتين فقط." },
    { k:"idea",  t:"علّم غيرك", b:"اشرح الدرس بصوت مسموع كأنك تعلّم صديقًا. المكان الذي تتلعثم فيه هو ما تحتاج إلى مراجعته.", a:"اشرح فكرة واحدة في دقيقة لمن حولك أو أمام المرآة." },
    { k:"habit", t:"نوم كافٍ = حفظ أفضل", b:"الدماغ يرسّخ ما درسته أثناء النوم. السهر الطويل قبل الامتحان يضرّك أكثر مما يفيدك.", a:"حدّد موعد نومك الليلة وأطفئ الشاشة قبله بنصف ساعة." },
    { k:"idea",  t:"دفتر الأخطاء", b:"دوّن كل خطأ وقعت فيه مع سببه والحل الصحيح، وراجع الدفتر قبل الامتحان. أخطاؤك أفضل معلّم لك.", a:"أضف خطأً واحدًا من آخر واجب إلى دفترك." },
    { k:"push",  t:"التقدم الصغير يتراكم", b:"ساعة واحدة كل يوم تصبح أكثر من 300 ساعة في السنة. المهم الاستمرار لا الكمال.", a:"اجعل هدفك اليوم أقل بقليل مما تتوقع، وأنجزه كاملًا." },
    { k:"idea",  t:"التكرار المتباعد", b:"راجع الدرس بعد يوم، ثم بعد 3 أيام، ثم بعد أسبوع. المراجعات المتباعدة تبقي المعلومة أطول من مراجعة مكثفة في ليلة واحدة.", a:"اختر درسًا من الأسبوع الماضي وراجعه 10 دقائق." },
    { k:"habit", t:"رتّب مكان دراستك", b:"طاولة مرتبة وإشعارات مغلقة تعني تركيزًا أطول. حتى إشعار صغير يقطع تفكيرك ويحتاج دقائق ليعود.", a:"فعّل وضع «عدم الإزعاج» في جلسة اليوم." },
    { k:"idea",  t:"ابدأ بالأصعب", b:"طاقتك أعلى في بداية الجلسة، فاستغلها في المادة التي تخاف منها وأبقِ الأسهل للنهاية.", a:"اكتب أصعب مادة عندك وابدأ بها اليوم." },
    { k:"push",  t:"نافس نفسك أمس", b:"لا تقارن نفسك بالآخرين، قارن نفسك بما كنت عليه الأسبوع الماضي. إن تحسّنت قليلًا فأنت رابح.", a:"قارن ساعات دراستك هذا الأسبوع بالأسبوع الماضي." },
    { k:"idea",  t:"حوّل العنوان إلى سؤال", b:"قبل قراءة الفقرة حوّل عنوانها إلى سؤال ثم ابحث عن جوابه. القراءة بهدف تجعلك أكثر انتباهًا.", a:"خذ عنوان درس اليوم واكتبه على شكل سؤال." },
    { k:"habit", t:"اشرب ماءً وتحرّك", b:"قم كل ساعة وحرّك جسمك دقيقتين واشرب ماءً. الجسم المرتاح يفكّر أسرع.", a:"قم الآن وتمدّد قليلًا قبل الجلسة القادمة." },
    { k:"idea",  t:"ملخص في نصف صفحة", b:"لخّص الدرس بأسلوبك في نصف صفحة فقط. إجبارك على الاختصار يكشف ما فهمته فعلًا وما لم تفهمه.", a:"لخّص درس اليوم في 5 أسطر." },
    { k:"push",  t:"الراحة ليست ضعفًا", b:"الراحة القصيرة جزء من الدراسة الذكية وليست ضياعًا للوقت. ارتح بعيدًا عن الهاتف لتعود أنشط.", a:"خذ استراحة 5 دقائق بعد هذه الجلسة دون شاشة." },
    { k:"idea",  t:"بدّل بين المواد", b:"بدل ثلاث ساعات في مادة واحدة، بدّل بين مادتين أو ثلاث. التنويع يقوّي الفهم ويقلل الملل.", a:"قسّم دراسة اليوم إلى مادتين على الأقل." },
    { k:"habit", t:"خطة الغد قبل النوم", b:"اكتب 3 مهام للغد قبل أن تنام، فتستيقظ وأنت تعرف من أين تبدأ دون تفكير طويل.", a:"اكتب الآن مهام الغد الثلاث." },
    { k:"push",  t:"الخطأ ليس نهاية الطريق", b:"كل من نجح أخطأ مرات كثيرة قبلك. الخطأ علامة أنك تحاول، وهو أقصر طريق لتفهم.", a:"اختر سؤالًا أخطأت فيه وأعد حلّه بهدوء." },
    { k:"idea",  t:"حلّ أسئلة السنوات السابقة", b:"حل أسئلة الأعوام السابقة بوقت محدد يعوّدك على جو الامتحان ويكشف نقاط ضعفك مبكرًا.", a:"حل 3 أسئلة بوقت محدد ثم صحّحها." },
    { k:"habit", t:"ثبّت وقتًا يوميًا", b:"الدراسة في نفس الساعة كل يوم تصير عادة، فلا تحتاج قوة إرادة كبيرة لتبدأ.", a:"اختر وقتًا ثابتًا للدراسة غدًا والتزم به." },
    { k:"idea",  t:"الرسم والمخططات", b:"حوّل المعلومات إلى خريطة ذهنية أو جدول. الدماغ يتذكر الأشكال والألوان أسرع من الأسطر الطويلة.", a:"ارسم خريطة ذهنية صغيرة لدرس اليوم." },
    { k:"push",  t:"لا تؤجل إلى «بعد قليل»", b:"كلمة «بعد قليل» من أكبر لصوص الوقت. اختر مهمة صغيرة وابدأها الآن قبل أن تقنع نفسك بالتأجيل.", a:"ابدأ أي مهمة لمدة 5 دقائق الآن." },
    { k:"idea",  t:"اسأل نفسك: لماذا؟", b:"بعد كل معلومة اسأل: لماذا؟ وكيف؟ الفهم العميق يغنيك عن كثير من الحفظ.", a:"اختر قاعدة واحدة واشرح سبب صحتها." },
    { k:"habit", t:"وقود للدماغ", b:"وجبة خفيفة كالفواكه والمكسرات أفضل من الحلويات الثقيلة وقت الدراسة، لأنها تعطيك طاقة أهدأ وأطول.", a:"جهّز وجبة خفيفة صحية قبل جلسة اليوم." },
    { k:"push",  t:"أنت أقدر مما تظن", b:"الصعوبة التي تشعر بها الآن علامة أن عقلك يتعلم شيئًا جديدًا. استمر، فالفهم يأتي بعد المحاولة.", a:"أعد قراءة نقطة صعبة مرة ثانية ببطء." },
    { k:"idea",  t:"سجّل صوتك", b:"سجّل صوتك وأنت تلخّص الدرس واسمعه في الطريق أو قبل النوم. هكذا تراجع بلا جهد إضافي.", a:"سجّل دقيقة تلخّص فيها درس اليوم." },
    { k:"idea",  t:"الهدف المحدد", b:"بدل «سأدرس الرياضيات» قل «سأحل 10 مسائل من الفصل الثالث». الهدف الواضح يعرّفك متى تنتهي.", a:"اكتب هدف جلسة اليوم بأرقام واضحة." },
    { k:"habit", t:"راجع قبل أن تبدأ", b:"ابدأ كل جلسة بمراجعة دقيقتين لما درسته آخر مرة، فتربط القديم بالجديد.", a:"قبل جلسة اليوم، راجع عناوين الدرس السابق." },
    { k:"push",  t:"كل جلسة تنهيها فوز", b:"أنهيت جلسة اليوم؟ هذا إنجاز حتى لو كانت قصيرة. الاستمرار هو الفرق بين من ينجح ومن يتوقف.", a:"استلم نجومك من مهام اليوم إن أنجزت شيئًا." },
    { k:"idea",  t:"راجع أسبوعك", b:"في نهاية الأسبوع اسأل نفسك: ما الذي نجح؟ وما الذي أغيّره؟ تعديل بسيط كل أسبوع يصنع فرقًا كبيرًا.", a:"اكتب شيئًا واحدًا ستغيّره في أسبوعك القادم." }
  ];
  var KIND = { idea:{ n:"فكرة اليوم", c:"#48cae4" }, push:{ n:"حافز اليوم", c:"#ff6b3d" }, habit:{ n:"عادة اليوم", c:"#2ecc71" } };

  var PUSH = [
    "كل مسألة تحلّها اليوم تبني ثقتك غدًا.",
    "لا يهم أن تكون بطيئًا، المهم ألّا تتوقف.",
    "عقلك مثل العضلة: يقوى بالتمرين المنتظم.",
    "الدقيقة التي تدرسها الآن لا تضيع، فهي تُحسب في رصيدك.",
    "ابدأ صغيرًا، وسترى أنك تنجز أكثر مما توقعت.",
    "تعب اليوم هو فرحة نجاحك غدًا.",
    "لا تنتظر أن تشعر بالرغبة، ابدأ وستأتي الرغبة.",
    "أنت لا تدرس للامتحان فقط، بل لتصنع نسخة أقوى منك.",
    "تذكّر لماذا بدأت، وضع هدفك أمام عينيك.",
    "خطوة اليوم أفضل من خطة مؤجلة.",
    "من صبر على التعب ذاق لذة الإنجاز.",
    "إن أخطأت في سؤال فقد تعلّمت طريقة لا تنفع، فجرّب غيرها.",
    "كل يوم دراسة وعدٌ وفيتَ به لنفسك.",
    "المنافسة الحقيقية مع نفسك، فتفوّق عليها اليوم.",
    "نجومك وسلسلتك تكبر مع كل جلسة، فأكمل الطريق.",
    "الاستمرار الهادئ أقوى من الحماس المؤقت."
  ];

  var SUBJECTS = [
    { id:"math", n:"الرياضيات", c:"#ffb400", tips:[
      { t:"افهم القاعدة قبل حفظها", b:"اسأل من أين جاء القانون وجرّب حل مثال بسيط بيدك. القاعدة المفهومة تُنسى أقل بكثير." },
      { t:"حلّ ثم حلّ ثم حلّ", b:"الرياضيات مهارة تُكتسب بالتمرين لا بالقراءة. حل مسائل متنوعة كل يوم أفضل من مشاهدة الحل جاهزًا." },
      { t:"لا تنظر إلى الحل مبكرًا", b:"حاول 10 دقائق قبل أن تفتح الجواب. المحاولة نفسها تدرّب عقلك حتى لو أخطأت." },
      { t:"راجع خطواتك", b:"اكتب الحل خطوة خطوة بخط مرتب وتأكد من الإشارات والأقواس. معظم الأخطاء سببها الإهمال لا الجهل." },
      { t:"ورقة القوانين", b:"اجمع قوانين كل فصل في صفحة واحدة مع مثال لكل قانون، وراجعها قبل الامتحان." },
      { t:"اعرف نوع خطئك", b:"صنّف أخطاءك: هل هي فهم، أم حساب، أم تسرّع؟ علاج كل نوع يختلف عن الآخر." }
    ]},
    { id:"arabic", n:"اللغة العربية", c:"#2ecc71", tips:[
      { t:"اقرأ نصًّا كل يوم", b:"قراءة صفحة من كتاب أو مقال يوميًا تقوّي مفرداتك وأسلوبك وتحسّن إملاءك دون جهد كبير." },
      { t:"تعلّم الإعراب بالتطبيق", b:"حلّل جملة واحدة يوميًا: حدّد الفعل والفاعل والمفعول وعلّل الحركة. القواعد تثبت بالتدريب لا بالحفظ فقط." },
      { t:"الإملاء ببطاقات", b:"اكتب الكلمات التي تخطئ فيها في بطاقات وراجعها، وانتبه للهمزات والتاء المربوطة والمفتوحة." },
      { t:"احفظ الشعر بالمعنى", b:"افهم معنى الأبيات أولًا ثم احفظ بيتين في كل مرة وكرّرهما بصوت مسموع." },
      { t:"التعبير بخطة", b:"قبل الكتابة ضع 3 أفكار رئيسية، ثم اكتب لكل فكرة فقرة. الموضوع المرتب بمقدمة وخاتمة ينال درجة أفضل." },
      { t:"لخّص النص في 3 جمل", b:"بعد كل نص اكتب: الفكرة العامة، وأهم فكرة جزئية، والعبرة. هذا يدرّبك على الفهم والاختصار." }
    ]},
    { id:"physics", n:"الفيزياء", c:"#48cae4", tips:[
      { t:"ارسم المسألة", b:"ارسم شكلًا واكتب عليه المعطيات والمطلوب قبل أي قانون. الرسم يوضح الطريق ويقلل الأخطاء." },
      { t:"انتبه للوحدات", b:"اكتب الوحدة مع كل رقم وحوّلها قبل التعويض. كثير من الأخطاء سببها وحدات مختلطة." },
      { t:"افهم القانون قبل التعويض", b:"اسأل: ماذا يعني كل رمز؟ وماذا يحدث للنتيجة لو زادت قيمته؟ هذا يغنيك عن الحفظ الأعمى." },
      { t:"اربطها بالحياة", b:"اربط الدرس بمثال تعرفه: سيارة تتحرك، كرة تسقط، مصباح يضيء. الفهم يصبح أسهل." },
      { t:"جدول القوانين", b:"اجمع قوانين الفصل مع معنى رموزها ووحداتها في ورقة واحدة وراجعها دوريًا." },
      { t:"اسأل: هل الجواب منطقي؟", b:"بعد الحل فكّر في حجم النتيجة. لو خرجت سرعة سيارة عادية ملايين الأمتار في الثانية فاعلم أن هناك خطأ." }
    ]},
    { id:"chem", n:"الكيمياء", c:"#a78bfa", tips:[
      { t:"أتقن الأساسيات أولًا", b:"الجدول الدوري والرموز والتكافؤ أساس كل فصل. أتقنها قبل الانتقال إلى المعادلات." },
      { t:"وازن المعادلات بالتدريب", b:"حل 5 معادلات موازنة يوميًا. عُدّ الذرات في الطرفين وتأكد أنها متساوية." },
      { t:"بطاقات للمفاهيم", b:"اكتب المصطلح على وجه والتعريف على الوجه الآخر واختبر نفسك بها، خاصة في الأحماض والقواعد والكيمياء العضوية." },
      { t:"افهم التفاعل لا تحفظه", b:"اسأل: ماذا يحدث للذرات وللإلكترونات؟ فهم السبب يجعل التفاعلات أسهل في التذكر." },
      { t:"مسائل المول خطوة خطوة", b:"حوّل المعطيات إلى مولات أولًا، ثم استخدم نسب المعادلة الموزونة، ثم ارجع إلى الوحدة المطلوبة." },
      { t:"تخيّل التجربة", b:"تخيّل ما تراه في التجربة: لون، غاز، راسب. المشاهد تُحفظ أسهل من الجمل." }
    ]},
    { id:"bio", n:"الأحياء", c:"#2ecc71", tips:[
      { t:"ارسم وسمِّ", b:"ارسم الخلية أو الجهاز أو العضو وضع الأسماء من ذاكرتك، ثم قارن بالكتاب وصحّح." },
      { t:"العمليات كسلسلة", b:"اكتب خطوات العملية (كالهضم أو التنفس الخلوي) كأسهم متتابعة، ثم حاول إعادتها من الذاكرة." },
      { t:"عرّف بكلماتك", b:"اكتب كل مصطلح مع تعريفه بجملة من عندك، لا نسخًا من الكتاب. إن عجزت فأنت لم تفهمه بعد." },
      { t:"قارن بجداول", b:"رتّب المقارنات (نبات وحيوان، انقسام متساوٍ ومنصّف) في جدول. الأسئلة كثيرًا ما تدور حولها." },
      { t:"اربطها بجسمك", b:"اربط الجهاز بجسمك: حين تدرس القلب تحسّس نبضك. الربط بالواقع يثبّت المعلومة." },
      { t:"عناوين إلى أسئلة", b:"حوّل كل عنوان إلى سؤال واكتب جوابه من الذاكرة قبل أن تفتح الكتاب." }
    ]},
    { id:"english", n:"اللغة الإنجليزية", c:"#ff6b3d", tips:[
      { t:"5 كلمات كل يوم", b:"تعلّم 5 كلمات يوميًا واستعملها في جملة من عندك. الكلمة المستعملة لا تُنسى بسهولة." },
      { t:"استمع كثيرًا", b:"استمع إلى بضع دقائق من فيديو أو بودكاست بسيط كل يوم. الأذن المعتادة تحسّن نطقك وفهمك." },
      { t:"اقرأ بصوت عالٍ", b:"قراءة نص قصير بصوت عالٍ تدرّب النطق والطلاقة معًا." },
      { t:"القاعدة بالأمثلة", b:"لكل قاعدة اكتب 3 جمل من عندك. المثال الشخصي يثبّت القاعدة أكثر من حفظ نصها." },
      { t:"يوميات قصيرة", b:"اكتب 3 جمل عن يومك بالإنجليزية. لا تهتم بالكمال، المهم أن تكتب كل يوم." },
      { t:"الكلمة داخل جملة", b:"احفظ الكلمة مع الجملة التي وردت فيها لا وحدها، لتعرف كيف تستعملها." }
    ]},
    { id:"social", n:"الاجتماعيات", c:"#ffb400", tips:[
      { t:"شريط زمني", b:"ارسم خطًا زمنيًا للأحداث وضع عليه التواريخ المهمة. ترتيب الأحداث يجعل تذكّرها أسهل." },
      { t:"احكِ الحدث كقصة", b:"أجب: من؟ ومتى؟ ولماذا؟ وماذا نتج؟ سؤال «لماذا» هو الأهم في الامتحان." },
      { t:"ارسم الخرائط", b:"في الجغرافية ارسم الخريطة بيدك وضع عليها الأسماء. اليد تساعد الذاكرة." },
      { t:"سبب ونتيجة", b:"اكتب لكل حدث سببه ونتيجته. أسئلة «علّل» تأتي كثيرًا بهذه الصيغة." },
      { t:"بطاقات للأسماء والتواريخ", b:"اكتب الأسماء والتواريخ الصعبة في بطاقات وكرّرها على أيام متباعدة." },
      { t:"قارن في جدول", b:"قارن بين حضارتين أو إقليمين في جدول بنقاط محددة، فتتضح الفروق بسرعة." }
    ]},
    { id:"islamic", n:"التربية الإسلامية", c:"#a78bfa", tips:[
      { t:"افهم قبل الحفظ", b:"اقرأ المعنى أولًا ثم احفظ الآية أو الحديث. المعنى يعين على التذكر." },
      { t:"حفظ تدريجي", b:"احفظ آية أو سطرين في كل مرة وكرّرهما، ثم أضف الجديد وراجع القديم كل يوم." },
      { t:"اربط بالتطبيق", b:"اسأل: كيف أطبّق هذا في حياتي اليوم؟ العمل بالدرس يثبّته." },
      { t:"جدول للأحكام", b:"رتّب أحكام التجويد أو الفقه في جدول: الحكم، تعريفه، مثال." },
      { t:"اكتب ما حفظت", b:"اكتب ما حفظته من الذاكرة ثم صحّح. الكتابة تكشف الأخطاء الخفية." },
      { t:"وقت هادئ", b:"الحفظ في وقت هادئ، كبعد الفجر أو قبل النوم، يناسب كثيرًا من الطلاب. جرّب ما يناسبك." }
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
    var st = el("style"); st.textContent = CSS; document.head.appendChild(st);

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
    paneToday.appendChild(el("p", "ho-coach-foot", "نصائح مبنية على أساليب دراسة معروفة، جرّب ما يناسبك منها."));
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

  function init(){
    if (inited || !document.body) return; inited = true;
    loadPos(); loadChat(); build(); place(false);
    setTimeout(function(){ checkEnabled(true); }, 2500);
    if (lsGet(LS_SEEN) !== String(dayIdx())) fab.classList.add("has-new");
    wake();
    /* لو بقيت الصفحة مفتوحة حتى اليوم التالي تظهر نقطة الفكرة الجديدة */
    setInterval(function(){ if (lsGet(LS_SEEN) !== String(dayIdx())) fab.classList.add("has-new"); }, 60000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();

  window.HOCoach = { open: open, close: close, _chat: function(){ return chat; }, getToday: getToday, getSubjectTip: getSubjectTip, SUBJECTS: SUBJECTS, DAILY: DAILY, PUSH: PUSH };
})();

/**
 * i18n.js — العربي والإنجليزي.
 *
 * الحتة الصعبة مش نصوص الواجهة — دي تعليلات الخوارزمية نفسها.
 * عشان كده الخوارزميات مبقتش بترجّع جُمل جاهزة، بترجّع {key, params}
 * والترجمة بتحصل وقت العرض بس. يعني تبديل اللغة بيغيّر كل حاجة فوراً
 * من غير ما نعيد الحساب.
 */

const STRINGS = {
  ar: {
    dir: 'rtl', langName: 'العربية', switchTo: 'English',

    appName: 'مرتّب المساحة',
    lead: 'مكتب، تسريحة، درج، شنطة، تلاجة... صوّرها والتطبيق يعرف هي إيه ويرتّبها.',
    surfaces: 'حاجات بترتب عليها', containers: 'حاجات بترص جواها',


    step1: 'المقاس', step2: 'المساحة', step2Bag: 'الشنطة', step3: 'الصورة',
    sizeStepQ: 'نعرف السنتيمترات منين؟',
    methodAuto: 'لاقيها إنت',
    methodRef: 'في الصورة حاجة أنا عارف مقاسها',
    methodKnown: 'أنا هكتب مقاس المساحة نفسها',
    methodAutoHint: 'الموديل يدوّر بنفسه في الصورة على حاجة مقاسها الحقيقي معروف ويقولنا هي إيه — والقياس بيتحسب من المقاس الموثّق عندنا، مش من كلامه. لو مالقاش حاجة هيقولك.',
    methodRefHint: 'التطبيق يلاقي الحاجة دي في الصورة ويقيس عليها كل حاجة تانية.',
    methodKnownHint: 'اكتب مقاس المساحة تقريبي براحتك — التطبيق يعاير الصورة عليه ويقيس اللي فيها.',
    refGroupExact: 'مقاسات قياسية (دقيقة)',
    refGroupCommon: 'حاجات يومية (تقريبية)',
    approxNote: 'المقاس ده تقريبي — النتيجة هتقرب من الحقيقة لكن مش مضمونة بالمليمتر.',
    refExact: 'مقاس قياسي موثّق',
    refApprox: 'حاجة يومية — مقاسها تقريبي',
    customRefName: 'الحاجة دي إيه؟',
    sizeW: 'العرض', sizeD: 'العمق', sizeH: 'الارتفاع',
    unitCm: 'بالسنتيمتر', unitSpan: 'بالشبر', unitInch: 'بالبوصة',
    spanIs: 'شبري بيطلع كام سنتيمتر؟',
    spanHint: 'شبر الكبير حوالي 20–23 سم. قيسه مرة بالمسطرة واكتبه هنا.',
    knownHint: 'تقريبي كفاية. تقدر تعدّل الأرقام في الخطوة اللي بعدها.',
    sizeSummary: 'المقاس اللي كتبته: {w}×{d} سم',
    sizeSummary3: 'المقاس اللي كتبته: {w}×{d}×{h} سم',
    spaceSize: 'مقاس المساحة',
    containerSizeHint: 'العرض × العمق × الارتفاع من جوه.',
    airlinePreset: 'مقاس جاهز من شركة طيران',
    scaleHintSurface: 'حط كارت بنك أو ورقة جنب الحاجات — من غيره المقاسات هتبقى تخمين.',
    scaleHintBag: 'حط كارت بنك جنب الحاجات، وافردهم وصوّرهم من فوق.',
    customRefCm: 'العرض الحقيقي بالسنتيمتر',
    spaceTypeQ: 'المساحة دي إيه؟',
    autoDetect: 'اكتشف تلقائياً من الصورة',
    autoHint: 'الموديل هيبص على الصورة ويعرف هي إيه ويكتب قواعد ترتيبها بنفسه.',
    pickedHint: 'اخترت النوع بنفسك — هيستخدم قواعد جاهزة ومجرّبة.',
    intentPlaceholder: 'عايز إيه من المساحة دي؟ (اختياري)',
    intentExample: 'مثال: «أجهّز نفسي بسرعة الصبح» أو «أحوّلها ركن مذاكرة»',
    handRight: 'بستخدم إيدي اليمين', handLeft: 'بستخدم إيدي الشمال',
    bagW: 'العرض سم', bagD: 'العمق سم', bagH: 'الارتفاع سم',
    airlineWarn: '⚠️ مقاسات شركات الطيران بتتغيّر — راجع شركتك قبل السفر.',
    takePhoto: 'صوّر أو اختار صورة',
    photoHint: 'أي مساحة — سطح أو حاجة بترص جواها',
    analyze: 'حلّل الصورة',
    manual: 'أو أدخل الحاجات بنفسك',
    privacy: 'الصورة بتتبعت لـClaude عشان يحللها بس، ومش بتتخزن في أي مكان.',

    reviewTitle: 'راجع المقاسات',
    reviewHint: 'الأرقام محسوبة من مرجع القياس. لو حاجة غلط عدّلها — الترتيب هيتحسب على اللي تأكده.',
    spaceIs: 'المساحة دي:', changeIt: 'غيّرها',
    handDetected: '🤖 الموديل استنتج من الصورة إنك بتستخدم إيدك ال{hand} وغيّرنا الاختيار. لو ده غلط رجّعه من شاشة التصوير.',
    adaptPlaceholder: 'اكتب عايز إيه: «خليها ركن مذاكرة»',
    adaptBtn: 'اعمل القواعد من تاني',
    surfaceSize: 'مقاس السطح',
    surfaceSizeHint: 'التقدير من الصورة بيقل عن الحقيقة. لو تعرف المقاس اكتبه — ده أهم رقم في الحسبة.',
    width: 'عرض', depth: 'عمق', height: 'ارتفاع', weight: 'وزن كجم',
    weightHint: 'الوزن تقدير — عدّله لو تعرف الرقم الحقيقي. الحد بيتحسب منه.',
    addItem: '+ ضيف حاجة', calc: 'احسب الترتيب',
    itemName: 'اسم الحاجة', kind: 'النوع', usage: 'الاستخدام', del: 'امسح',
    newItem: 'حاجة جديدة',
    freqHigh: 'بستخدمها كتير', freqMedium: 'أحياناً', freqLow: 'نادراً',

    resultTitle: 'الترتيب المقترح', arrangeOf: 'ترتيب',
    autoAccepted: '✅ الثقة في القياس كانت عالية، فقبلنا الأرقام على طول ومروّحناش على المراجعة.',
    openReview: 'راجع الأرقام', dismissBar: 'اقفل',
    bagResult: 'رص الشنطة',
    back: 'رجوع', backToSizes: 'رجوع للمقاسات',
    statOnSurface: 'على السطح', statFree: 'فاضي', statRemoved: 'اتشالت',
    statFits: 'هتدخل', statNoFit: 'مش هتدخل', statFill: 'امتلاء', statKg: 'كجم',
    whyHere: 'كل حاجة وليه اتحطت هنا',
    packOrder: 'رصّها بالترتيب ده',
    removeThese: 'شيل دول من على السطح',
    wontFit: 'دول مش هيدخلوا',
    askTitle: 'اسأل عن مساحتك',
    askPlaceholder: 'ليه رقبتي بتوجعني؟ / إزاي أخليها أهدى؟',
    askBtn: 'اسأل', thinking: 'بفكر...',
    afterImage: 'ورّيني صورة «بعد الترتيب»',
    save: 'احفظ', saved: 'محفوظات', open: 'افتح', erase: 'مسح',
    aiImageWarn: '⚠️ دي صورة تخيلية من الـAI — المخطط اللي فوق هو الدقيق.',
    rotate: '(لفّها)',

    about: 'عن التطبيق',
    aboutBody: '<b>الذكاء بيشوف بس.</b> الموديل بيتعرّف على الحاجات ونوع المساحة ويكتب قواعدها ويشرح — لكن <b>المقاسات بتتحسب بالرياضة</b> من مرجع القياس، و<b>الترتيب بتقرره خوارزمية</b>، والمخطط مرسوم من الأرقام دي. عشان كده المخطط مستحيل يهلوس.',
    aboutAccuracy: 'المقاسات تقديرية: حط مرجع قياس، صوّر من فوق، وراجع الأرقام قبل الحساب. الارتفاع تقدير مش قياس.',
    aboutPrivacy: 'محفوظاتك وإعداداتك بتتخزن في متصفحك انت بس.',
    optAutoSkip: 'تخطّي المراجعة لما الثقة تبقى عالية',
    optAutoSkipHint: 'لما يبقى مرجع القياس قياسي وظاهر كويس والموديل واثق في كل حاجة شافها، بنروح على النتيجة على طول — وتقدر ترجع تراجع من شاشة النتيجة.',
    ok: 'تمام', install: 'ثبّته على موبايلك',
    installIOS: '📲 للتثبيت: زرار المشاركة ← «إضافة إلى الشاشة الرئيسية»',

    // مخطط
    youAreHere: 'انت هنا', reachRings: 'الدواير = مدى وصول إيدك',
    cm: 'سم', layer: 'طبقة', atHeight: 'على ارتفاع', sideView: 'منظر جانبي — التستيف',
    nothingPacked: 'مفيش حاجة اترصت.',

    // مناطق
    zone_front: 'قدامك مباشرة',
    zone_primary: 'في متناول إيدك من غير ما تتحرك',
    zone_secondary: 'على بُعد مد دراع',
    zone_back: 'في العمق ناحية الحيطة',
    zone_far: 'بعيد عن منطقة الشغل',

    // تعليلات الترتيب
    r_anchorBack: 'قدامك مباشرة وفي أبعد نقطة — دي الحاجة اللي بتبص لها',
    r_anchorFront: 'في المنتصف قدامك، وسايب مساحة تشتغل فيها',
    r_anchorSide: 'على ناحية إيدك ال{hand} وقريب من إيدك',
    r_sideDominant: ' على ناحية إيدك ال{hand}',
    r_sideOff: ' على الناحية ال{hand} بعيد عن إيد الشغل',
    r_keepDry: ' وبعيد عن الحاجات اللي بتتلف لو اتكب',
    r_avoidLight: ' وبعيد عن الشمس',
    r_wantsLight: ' وقريب من الضو',
    r_hot: ' وحواليه خلوص عشان بيسخن',
    r_distance: ' — على بُعد {n} سم منك',
    right: 'يمين', left: 'شمال',

    // اتشالت
    off_bulky: 'بتاخد {n} سم² من المساحة وانت نادراً بتستخدمها — مكانها رف أو درج',
    off_rare: 'مش بتستخدمها كتير والمساحة مزحومة — مكانها الدرج أو رف',
    off_noRoom: 'مفيش مساحة مناسبة ليها على السطح',

    // ملاحظات
    n_viewDistance: 'مسافة النظر للشاشة حوالي {n} سم — الموصى بيه 50 لـ 70 سم. السطح ضيق في العمق، فارجع بالكرسي شوية أو ركّب الشاشة على ذراع حائط.',
    n_laptop: 'اللابتوب شاشته واطية فبتخلّيك تحني رقبتك. ارفعه على ستاند (أو رزمة كتب) لحد ما تبقى أعلى نقطة في الشاشة على مستوى عينك، واستخدم كيبورد وماوس خارجيين.',
    n_windowBack: 'الشباك ورا ضهرك — الضو هيتعكس على الشاشة وهيتعبك. لف السطح بحيث يبقى الشباك على جنبك، أو استخدم ستارة.',
    n_windowFront: 'الشباك قدامك ورا الشاشة — هتبص في الضو طول اليوم وعينك هتوجعك. لف السطح ٩٠ درجة عشان الشباك يبقى على جنبك.',
    n_windowSide: 'الشباك على جنبك — ده أحسن وضع للإضاءة الطبيعية. ✅',
    n_lamp: 'الإضاءة على ناحية إيدك ال{hand} — عشان إيدك متعملش ضل على اللي بتعمله. ✅',
    n_liquids: 'السوايل اتحطت بعيد — لو اتكبت مش هتوصل للحاجات اللي بتتلف.',
    n_hot: 'الحاجات اللي بتسخن سيبنا حواليها خلوص عشان متقربش من حاجة تتأثر بالحرارة.',
    n_removed: 'شيلنا {n} حاجة من على السطح. المساحة الفاضية بتقلل التشتت، ومكانها الأنسب درج أو رف.',
    n_overweight: 'وزن اللي عايز تشيله {total} كجم والحد المسموح {limit} كجم — اللي زوّد الوزن مدخلش.',

    // رص الشنطة
    p_atBottom: 'في القاع', p_atHeight: 'على ارتفاع {n} سم',
    p_back: 'ناحية الضهر', p_front: 'قدام',
    p_stuff: 'احشرها في الفراغات اللي فضلت بين الحاجات',
    p_overweight: 'هيعدّي حد الوزن المسموح',
    p_noRoom: 'مفيش مساحة فاضية كفاية',
    p_tooBig: 'أكبر من الشنطة نفسها (أطول ضلع {n} سم)',
    p_noRoomSoft: 'مفيش فاضي كفاية حتى بعد الكبس',

    // رسائل
    t_pickPhoto: 'اختار صورة الأول',
    t_needSize: 'اكتب مقاس السطح الأول',
    t_needBagSize: 'اكتب مقاس الشنطة',
    t_needItems: 'محتاجين حاجة واحدة على الأقل بمقاسات صحيحة',
    t_needRefCm: 'اكتب عرض مرجع القياس بالسنتيمتر',
    t_needKnownSize: 'اكتب عرض وعمق المساحة الأول',
    t_spaceNotFound: 'مالقيناش المساحة نفسها في الصورة. صوّرها كاملة في الكادر وحاول تاني.',
    t_noAI: 'الميزة دي محتاجة Claude — مش متاحة في العرض ده',
    t_noAIphoto: 'تحليل الصور مش متاح هنا — استخدم «أدخل الحاجات بنفسك»',
    t_noImages: 'العرض ده مش بيسمح ببعت صور — استخدم «أدخل الحاجات بنفسك»',
    t_writeIntent: 'اكتب عايز إيه من المساحة',
    t_needSpace: 'محتاجين نعرف المساحة الأول',
    t_writeQuestion: 'اكتب سؤالك',
    t_calcFirst: 'احسب الترتيب الأول',
    t_rulesChanged: 'القواعد اتغيرت ✅ اضغط «احسب الترتيب»',
    t_savedOk: 'اتحفظ في متصفحك ✅',
    t_savedFull: 'مساحة المتصفح مليانة — امسح محفوظات قديمة',
    t_noOriginal: 'مفيش صورة أصلية',
    t_noRules: 'الموديل مرجعش قواعد صالحة — جرب صياغة تانية',
    t_noAnswer: 'مالقيتش إجابة — جرب صياغة تانية',
    t_refNotFound: 'مالقيناش {what} في الصورة. حطه في مكان واضح وصوّر تاني.',
    t_autoRefNone: 'الموديل مالقاش في الصورة أي حاجة مقاسها معروف يعاير عليها. اختار مرجع قياس من الليستة، أو اكتب مقاس المساحة بنفسك.',
    t_autoRefUnknown: 'الموديل شاف «{what}» بس مقاسه الحقيقي مش موثّق عندنا، ومش هنصدّق رقم من عنده. اختار مرجع من الليستة أو اكتب المقاس بنفسك.',
    t_noObjects: 'مالقيناش حاجات في الصورة. جرب صورة أوضح أو ضيف الحاجات بنفسك.',
    t_analyzing: 'الموديل بيبص على الصورة...',
    t_rewriting: 'بكتب القواعد من تاني...',
    t_drawing: 'برسم صورة «بعد الترتيب»...',
    b_scaleOk: '✅ لقينا مرجع القياس ({what}). دقة القياس: <b>{level}</b>',
    b_scaleAuto: '🤖 الموديل اختار مرجع القياس بنفسه: <b>{what}</b> — {kind}. القياس اتحسب من المقاس الموثّق عندنا. دقة القياس: <b>{level}</b>',
    b_scaleWarn: '⚠️ دقة القياس <b>{level}</b> — المرجع صغير أو متصوّر بزاوية مايلة. راجع الأرقام أو صوّر تاني من فوق.',
    b_known: 'المقاس من عندك: {w}×{d} سم — كل حاجة في الصورة اتقاست عليه.',
    b_manual: '✍️ إدخال يدوي — اكتب المقاسات بالمسطرة. الحساب والترتيب هيشتغلوا من غير أي AI.',
    conf_high: 'عالية', conf_mid: 'متوسطة', conf_low: 'منخفضة',
    scaleRef: 'مرجع القياس',
    sep: '، ',
  },

  en: {
    dir: 'ltr', langName: 'English', switchTo: 'العربية',

    appName: 'Space Planner',
    lead: 'Desk, dresser, drawer, bag, fridge — photograph it and the app works out what it is and arranges it.',
    surfaces: 'Things you arrange on', containers: 'Things you pack into',


    step1: 'Size', step2: 'The space', step2Bag: 'The bag', step3: 'Photo',
    sizeStepQ: 'Where do the centimetres come from?',
    methodAuto: 'Find it yourself',
    methodRef: 'Something in the photo whose size I know',
    methodKnown: "I'll type the size of the space itself",
    methodAutoHint: 'The model hunts the photo for an object whose real size is reliably known and tells us which one — the measurement then comes from our documented size for it, not from anything it says. If it finds nothing, it says so.',
    methodRefHint: 'The app finds that object in the photo and measures everything else against it.',
    methodKnownHint: 'Type the size of the space, roughly is fine — the app calibrates the photo from it.',
    refGroupExact: 'Standard sizes (exact)',
    refGroupCommon: 'Everyday objects (approximate)',
    approxNote: 'This size is approximate — the result will be close, but not millimetre-accurate.',
    refExact: 'a documented standard size',
    refApprox: 'an everyday object — its size is approximate',
    customRefName: 'What is it?',
    sizeW: 'Width', sizeD: 'Depth', sizeH: 'Height',
    unitCm: 'in centimetres', unitSpan: 'in hand spans', unitInch: 'in inches',
    spanIs: 'How many centimetres is your hand span?',
    spanHint: 'An adult span is about 20–23 cm. Measure it once with a ruler and type it here.',
    knownHint: 'Roughly is enough. You can correct the numbers in the next step.',
    sizeSummary: 'Size you typed: {w}×{d} cm',
    sizeSummary3: 'Size you typed: {w}×{d}×{h} cm',
    spaceSize: 'Space size',
    containerSizeHint: 'Width × depth × height, measured inside.',
    airlinePreset: 'Ready-made airline size',
    scaleHintSurface: 'Put a bank card or sheet of paper next to your things — without one, every measurement is a guess.',
    scaleHintBag: 'Put a bank card next to the items, lay them out, and shoot from above.',
    customRefCm: 'Real width in centimetres',
    spaceTypeQ: 'What is this space?',
    autoDetect: 'Detect from the photo',
    autoHint: 'The model looks at the photo, works out what the space is, and writes its arrangement rules.',
    pickedHint: 'You picked the type — it will use ready-made, tested rules.',
    intentPlaceholder: 'What do you want from this space? (optional)',
    intentExample: 'e.g. "get ready fast in the morning" or "turn it into a study corner"',
    handRight: 'I am right-handed', handLeft: 'I am left-handed',
    bagW: 'Width cm', bagD: 'Depth cm', bagH: 'Height cm',
    airlineWarn: '⚠️ Airline limits change — check your airline before flying.',
    takePhoto: 'Take or choose a photo',
    photoHint: 'Any space — a surface, or something you pack into',
    analyze: 'Analyse photo',
    manual: 'Or enter items yourself',
    privacy: 'The photo goes to Claude for analysis only and is never stored.',

    reviewTitle: 'Check the measurements',
    reviewHint: 'These come from the scale reference. Fix anything wrong — the layout uses what you confirm.',
    spaceIs: 'This space is:', changeIt: 'Change',
    handDetected: '🤖 From the photo the model worked out you are {hand}-handed, and we changed the setting. If that is wrong, set it back on the photo screen.',
    adaptPlaceholder: 'Say what you want: "make it a study corner"',
    adaptBtn: 'Rewrite the rules',
    surfaceSize: 'Surface size',
    surfaceSizeHint: 'A photo taken at an angle under-reads depth. If you know the real size, type it — this is the most important number here.',
    width: 'Width', depth: 'Depth', height: 'Height', weight: 'Weight kg',
    weightHint: 'Weight is an estimate — correct it if you know the real number. The limit is computed from it.',
    addItem: '+ Add item', calc: 'Compute layout',
    itemName: 'Item name', kind: 'Type', usage: 'Usage', del: 'Delete',
    newItem: 'New item',
    freqHigh: 'Constantly', freqMedium: 'Sometimes', freqLow: 'Rarely',

    resultTitle: 'Suggested layout', arrangeOf: '',
    autoAccepted: '✅ Measurement confidence was high, so we accepted the numbers and skipped the review step.',
    openReview: 'Check the numbers', dismissBar: 'Dismiss',
    bagResult: 'Bag packing',
    back: 'Back', backToSizes: 'Back to measurements',
    statOnSurface: 'on the surface', statFree: 'free space', statRemoved: 'removed',
    statFits: 'fit', statNoFit: 'do not fit', statFill: 'filled', statKg: 'kg',
    whyHere: 'Every item, and why it sits there',
    packOrder: 'Pack in this order',
    removeThese: 'Take these off the surface',
    wontFit: 'These will not fit',
    askTitle: 'Ask about your space',
    askPlaceholder: 'Why does my neck hurt? / How do I make it calmer?',
    askBtn: 'Ask', thinking: 'Thinking...',
    afterImage: 'Show me an after image',
    save: 'Save', saved: 'Saved', open: 'Open', erase: 'Delete',
    aiImageWarn: '⚠️ This is an AI impression — the plan above is the accurate one.',
    rotate: '(turn it)',

    about: 'About',
    aboutBody: '<b>The AI only looks.</b> It recognises the items, identifies the space, writes its rules and explains — but <b>the measurements are arithmetic</b> from the scale reference, <b>the layout is decided by an algorithm</b>, and the plan is drawn from those numbers. That is why the plan cannot hallucinate.',
    aboutAccuracy: 'Measurements are estimates: include a scale reference, shoot from above, and check the numbers before computing. Height is estimated, not measured.',
    aboutPrivacy: 'Your saved layouts and settings stay in your own browser.',
    optAutoSkip: 'Skip the review step when confidence is high',
    optAutoSkipHint: 'When the scale reference is a documented standard, clearly visible, and the model is confident about everything it saw, we go straight to the result — you can still open the review from there.',
    ok: 'Got it', install: 'Install on your phone',
    installIOS: '📲 To install: Share button → "Add to Home Screen"',

    youAreHere: 'you are here', reachRings: 'rings = your reach',
    cm: 'cm', layer: 'Layer', atHeight: 'at height', sideView: 'Side view — stacking',
    nothingPacked: 'Nothing was packed.',

    zone_front: 'directly in front of you',
    zone_primary: 'within reach without moving',
    zone_secondary: 'an arm-stretch away',
    zone_back: 'at the back, toward the wall',
    zone_far: 'away from the working area',

    r_anchorBack: 'directly in front of you at the furthest point — this is what you look at',
    r_anchorFront: 'centred in front of you, leaving room to work',
    r_anchorSide: 'on your {hand} side, close to your hand',
    r_sideDominant: ' on your {hand} side',
    r_sideOff: ' on the {hand} side, away from your working hand',
    r_keepDry: ' and away from anything a spill would ruin',
    r_avoidLight: ' and out of the sunlight',
    r_wantsLight: ' and near the light',
    r_hot: ' with clearance around it because it gets hot',
    r_distance: ' — {n} cm from you',
    right: 'right', left: 'left',

    off_bulky: 'takes {n} cm² of the surface and you rarely use it — it belongs on a shelf or in a drawer',
    off_rare: 'you rarely use it and the surface is crowded — it belongs in a drawer or on a shelf',
    off_noRoom: 'no suitable space for it on the surface',

    n_viewDistance: 'Viewing distance is about {n} cm — 50 to 70 cm is recommended. The surface is shallow, so sit back a little or mount the screen on an arm.',
    n_laptop: 'A laptop screen sits low and bends your neck. Raise it on a stand (or a stack of books) until the top of the screen is at eye level, and use an external keyboard and mouse.',
    n_windowBack: 'The window is behind you — light reflects off the screen and tires your eyes. Turn the surface so the window is to your side, or draw a curtain.',
    n_windowFront: 'The window faces you behind the screen — you stare into the light all day. Turn the surface 90° so the window is to your side.',
    n_windowSide: 'The window is to your side — the best position for natural light. ✅',
    n_lamp: 'The light is on your {hand} side — so your hand does not cast a shadow on your work. ✅',
    n_liquids: 'Liquids are placed clear of everything a spill would ruin.',
    n_hot: 'Items that heat up have clearance around them, away from anything heat affects.',
    n_removed: 'We took {n} item(s) off the surface. Clear space cuts distraction — a drawer or shelf suits them better.',
    n_overweight: 'What you want to carry weighs {total} kg and the limit is {limit} kg — whatever pushed it over was left out.',

    p_atBottom: 'at the bottom', p_atHeight: 'at {n} cm height',
    p_back: 'toward the back', p_front: 'at the front',
    p_stuff: 'stuff these into the gaps left between things',
    p_overweight: 'would exceed the weight limit',
    p_noRoom: 'not enough free space',
    p_tooBig: 'bigger than the bag itself (longest side {n} cm)',
    p_noRoomSoft: 'not enough room even compressed',

    t_pickPhoto: 'Choose a photo first',
    t_needSize: 'Enter the surface size first',
    t_needBagSize: 'Enter the bag size',
    t_needItems: 'Need at least one item with valid measurements',
    t_needRefCm: 'Enter the reference width in centimetres',
    t_needKnownSize: 'Type the width and depth of the space first',
    t_spaceNotFound: 'We could not find the space itself in the photo. Fit all of it in frame and try again.',
    t_noAI: 'This feature needs Claude — not available in this view',
    t_noAIphoto: 'Photo analysis is not available here — use "Enter items yourself"',
    t_noImages: 'This view cannot send images — use "Enter items yourself"',
    t_writeIntent: 'Say what you want from the space',
    t_needSpace: 'We need to know the space first',
    t_writeQuestion: 'Type your question',
    t_calcFirst: 'Compute the layout first',
    t_rulesChanged: 'Rules updated ✅ press "Compute layout"',
    t_savedOk: 'Saved in your browser ✅',
    t_savedFull: 'Browser storage is full — delete old saves',
    t_noOriginal: 'No original photo',
    t_noRules: 'The model returned no valid rules — try rephrasing',
    t_noAnswer: 'No answer — try rephrasing',
    t_refNotFound: 'We could not find {what} in the photo. Put it somewhere clear and shoot again.',
    t_autoRefNone: 'The model found nothing in the photo whose real size is reliably known. Pick a scale reference from the list, or type the size of the space yourself.',
    t_autoRefUnknown: 'The model spotted "{what}", but we have no documented size for it — and we will not take a number from the model. Pick a reference from the list, or type the size yourself.',
    t_noObjects: 'We found no items in the photo. Try a clearer shot, or add items yourself.',
    t_analyzing: 'The model is looking at the photo...',
    t_rewriting: 'Rewriting the rules...',
    t_drawing: 'Drawing the "after" image...',
    b_scaleOk: '✅ Scale reference found ({what}). Measurement confidence: <b>{level}</b>',
    b_scaleAuto: '🤖 The model picked the scale reference itself: <b>{what}</b> — {kind}. The measurement came from our documented size for it. Measurement confidence: <b>{level}</b>',
    b_scaleWarn: '⚠️ Measurement confidence <b>{level}</b> — the reference is small or shot at an angle. Check the numbers, or reshoot from above.',
    b_known: 'Your own measurement: {w}×{d} cm — everything in the photo was measured against it.',
    b_manual: '✍️ Manual entry — measure with a ruler. Layout and plans work with no AI at all.',
    conf_high: 'high', conf_mid: 'medium', conf_low: 'low',
    scaleRef: 'the scale reference',
    sep: ', ',
  },
};

let lang = 'ar';

export function getLang() { return lang; }

export function setLang(next) {
  lang = STRINGS[next] ? next : 'ar';
  try { localStorage.setItem('sp.lang', lang); } catch { /* وضع خاص */ }
  document.documentElement.dir = STRINGS[lang].dir;
  document.documentElement.lang = lang;
  return lang;
}

export function initLang() {
  let saved = null;
  try { saved = localStorage.getItem('sp.lang'); } catch { /* وضع خاص */ }
  const guess = (navigator.language || '').startsWith('ar') ? 'ar' : 'en';
  return setLang(saved || guess);
}

/** t('key', {n: 5}) — والمفتاح المفقود بيرجع نفسه بدل ما يختفي النص. */
export function t(key, params) {
  let s = STRINGS[lang]?.[key] ?? STRINGS.ar[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, v);
  return s;
}

/** بيترجم {ar, en} أو نص عادي — البروفايلات بتستخدمه. */
export function tx(value) {
  if (value && typeof value === 'object') return value[lang] ?? value.ar ?? value.en ?? '';
  return value ?? '';
}

/** تعليل جاي من الخوارزمية: {key, params} أو ليستة منهم. */
export function tr(reason) {
  if (!reason) return '';
  if (typeof reason === 'string') return reason;
  if (Array.isArray(reason)) return reason.map(tr).join('');
  return t(reason.key, resolveParams(reason.params));
}

/**
 * البارامتر نفسه ممكن يكون كلمة محتاجة ترجمة، مش رقم — زي «يمين/شمال».
 * الخوارزمية بتبعتها كـ {key} وإحنا بنترجمها وقت العرض، عشان تبديل اللغة
 * يغيّرها هي كمان بدل ما تفضل بالإنجليزي جوه جملة عربي.
 */
function resolveParams(params) {
  if (!params) return params;
  const out = {};
  for (const [k, v] of Object.entries(params)) {
    out[k] = v && typeof v === 'object' && v.key ? t(v.key) : v;
  }
  return out;
}

export const LANGS = Object.keys(STRINGS);

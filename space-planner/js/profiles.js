/**
 * profiles.js — بروفايل المساحة.
 *
 * البروفايل ده هو "دستور" أي مساحة: بيقول كل نوع حاجة يروح فين وليه.
 * قبل كده كان مكتوب بإيدي للمكتب بس. دلوقتي:
 *   - فيه بروفايلات جاهزة لأشهر المساحات (شغالة من غير أي AI)
 *   - والموديل يقدر يولّد بروفايل لأي مساحة تانية
 *
 * الخوارزمية مبتفرقش — بتنفّذ البروفايل مهما كان مصدره.
 */

/** المناطق المسموحة — مسافة تقريبية بالسنتيمتر من مكان وقوفك/قعدتك. */
export const ZONES = {
  front:     { targetCm: 18, labelAr: { ar: 'قدامك مباشرة', en: 'قدامك مباشرة' } },
  primary:   { targetCm: 32, labelAr: { ar: 'في متناول إيدك من غير ما تتحرك', en: 'في متناول إيدك من غير ما تتحرك' } },
  secondary: { targetCm: 52, labelAr: { ar: 'على بُعد مد دراع', en: 'على بُعد مد دراع' } },
  back:      { targetCm: 70, labelAr: { ar: 'في العمق ناحية الحيطة', en: 'في العمق ناحية الحيطة' } },
  far:       { targetCm: 85, labelAr: { ar: 'بعيد عن منطقة الشغل', en: 'بعيد عن منطقة الشغل' } },
};

/** نواحي الوضع بالنسبة لإيدك المسيطرة. */
export const SIDES = ['dominant', 'off', 'center', 'any'];

/** خانات الإرساء: الحاجات اللي بتتحدد الأول وباقي المساحة بتتبني حواليها. */
export const ANCHOR_SLOTS = ['back-center', 'front-center', 'front-dominant'];

/**
 * البروفايلات الجاهزة. دي بتشتغل فوراً من غير نت ومن غير مفتاح AI.
 * الموديل بيولّد زيها بالظبط لأي مساحة مش موجودة هنا.
 */
export const BUILT_IN_PROFILES = {
  desk: {
    id: 'desk',
    spaceTypeAr: { ar: 'مكتب شغل', en: 'Work desk' },
    spaceKind: 'surface',
    defaultSizeCm: { width: 140, depth: 70 },
    categories: {
      monitor:    { labelAr: { ar: 'شاشة', en: 'Monitor' },        zone: 'back',      side: 'center',   anchor: 'back-center', tall: true, screen: true },
      laptop:     { labelAr: { ar: 'لابتوب', en: 'Laptop' },      zone: 'back',      side: 'center',   anchor: 'back-center', tall: true, screen: true },
      keyboard:   { labelAr: { ar: 'كيبورد', en: 'Keyboard' },      zone: 'front',     side: 'center',   anchor: 'front-center' },
      mouse:      { labelAr: { ar: 'ماوس', en: 'Mouse' },        zone: 'front',     side: 'dominant', anchor: 'front-dominant' },
      drink:      { labelAr: { ar: 'مشروب', en: 'Drink' },       zone: 'secondary', side: 'off',      keepDry: true },
      phone:      { labelAr: { ar: 'موبايل', en: 'Phone' },      zone: 'primary',   side: 'off' },
      notebook:   { labelAr: { ar: 'نوتة / ورق', en: 'Notebook / paper' },  zone: 'primary',   side: 'dominant' },
      pens:       { labelAr: { ar: 'أقلام', en: 'Pens' },       zone: 'primary',   side: 'dominant' },
      lamp:       { labelAr: { ar: 'أباجورة', en: 'Lamp' },     zone: 'back',      side: 'off',      tall: true },
      speaker:    { labelAr: { ar: 'سماعة', en: 'Speaker' },       zone: 'back',      side: 'any',      tall: true },
      headphones: { labelAr: { ar: 'سماعة راس', en: 'Headphones' },   zone: 'secondary', side: 'off' },
      plant:      { labelAr: { ar: 'نبتة', en: 'Plant' },        zone: 'far',       side: 'any',      tall: true, wantsLight: true },
      books:      { labelAr: { ar: 'كتب', en: 'Books' },         zone: 'far',       side: 'any',      tall: true },
      storage:    { labelAr: { ar: 'تخزين', en: 'Storage' },       zone: 'far',       side: 'any' },
      decor:      { labelAr: { ar: 'ديكور', en: 'Decor' },       zone: 'far',       side: 'any' },
      other:      { labelAr: { ar: 'حاجة تانية', en: 'Something else' },  zone: 'secondary', side: 'any' },
    },
    tipsAr: [],
  },

  dresser: {
    id: 'dresser',
    spaceTypeAr: { ar: 'تسريحة', en: 'Dressing table' },
    spaceKind: 'surface',
    defaultSizeCm: { width: 110, depth: 45 },
    categories: {
      mirror:     { labelAr: { ar: 'مراية', en: 'Mirror' },        zone: 'back',      side: 'center',   anchor: 'back-center', tall: true },
      lamp:       { labelAr: { ar: 'إضاءة', en: 'Light' },        zone: 'back',      side: 'off',      tall: true },
      dailyMakeup:{ labelAr: { ar: 'مكياج يومي', en: 'Daily make-up' },   zone: 'primary',   side: 'dominant' },
      makeup:     { labelAr: { ar: 'مكياج', en: 'Make-up' },        zone: 'secondary', side: 'dominant' },
      brushes:    { labelAr: { ar: 'فرش', en: 'Brushes' },          zone: 'primary',   side: 'dominant', tall: true },
      skincare:   { labelAr: { ar: 'عناية بالبشرة', en: 'Skincare' },zone: 'secondary', side: 'off',      avoidLight: true },
      perfume:    { labelAr: { ar: 'برفان', en: 'Perfume' },        zone: 'secondary', side: 'any',      tall: true, avoidLight: true },
      jewelry:    { labelAr: { ar: 'إكسسوار', en: 'Jewellery' },      zone: 'secondary', side: 'off' },
      hairTools:  { labelAr: { ar: 'أدوات شعر', en: 'Hair tools' },    zone: 'secondary', side: 'dominant', hot: true },
      tissues:    { labelAr: { ar: 'مناديل', en: 'Tissues' },       zone: 'secondary', side: 'off' },
      storage:    { labelAr: { ar: 'علب تخزين', en: 'Storage boxes' },    zone: 'far',       side: 'any' },
      decor:      { labelAr: { ar: 'ديكور', en: 'Decor' },        zone: 'far',       side: 'any' },
      other:      { labelAr: { ar: 'حاجة تانية', en: 'Something else' },   zone: 'secondary', side: 'any' },
    },
    tipsAr: [
      { ar: 'الإضاءة الأحسن للمكياج بتيجي من قدامك على مستوى الوش — مش من فوق، عشان متعملش ضل تحت العين.',
        en: 'The best make-up light comes from in front at face level, not from above, so it casts no shadow under the eyes.' },
      { ar: 'البرفانات والسيرومات بتبوظ بسرعة في الشمس والحرارة — خليها في ركن مظلل أو في درج.',
        en: 'Perfumes and serums spoil fast in sun and heat — keep them in a shaded corner or a drawer.' },
    ],
  },

  kitchen: {
    id: 'kitchen',
    spaceTypeAr: { ar: 'رف / تختة مطبخ', en: 'Kitchen counter' },
    spaceKind: 'surface',
    defaultSizeCm: { width: 180, depth: 60 },
    categories: {
      board:      { labelAr: { ar: 'تختة تقطيع', en: 'Chopping board' },   zone: 'front',     side: 'center',   anchor: 'front-center' },
      knives:     { labelAr: { ar: 'سكاكين', en: 'Knives' },       zone: 'primary',   side: 'dominant', tall: true },
      spices:     { labelAr: { ar: 'بهارات', en: 'Spices' },       zone: 'primary',   side: 'off',      tall: true, avoidLight: true },
      oils:       { labelAr: { ar: 'زيوت', en: 'Oils' },         zone: 'secondary', side: 'off',      tall: true, avoidLight: true },
      appliance:  { labelAr: { ar: 'جهاز كهربا', en: 'Appliance' },   zone: 'back',      side: 'any',      tall: true, keepDry: true },
      pots:       { labelAr: { ar: 'حلل وطاسات', en: 'Pots and pans' },   zone: 'secondary', side: 'any',      tall: true },
      utensils:   { labelAr: { ar: 'أدوات', en: 'Utensils' },        zone: 'primary',   side: 'dominant', tall: true },
      dishes:     { labelAr: { ar: 'أطباق', en: 'Dishes' },        zone: 'secondary', side: 'any' },
      produce:    { labelAr: { ar: 'خضار وفاكهة', en: 'Produce' },  zone: 'far',       side: 'any' },
      storage:    { labelAr: { ar: 'برطمانات', en: 'Jars' },     zone: 'far',       side: 'any',      tall: true },
      other:      { labelAr: { ar: 'حاجة تانية', en: 'Something else' },   zone: 'secondary', side: 'any' },
    },
    tipsAr: [
      { ar: 'سيب مساحة فاضية قدام تختة التقطيع — دي أهم مساحة في المطبخ وأكتر حاجة بتضيع.',
        en: 'Keep clear space in front of the chopping board — the most valuable and most often lost space in a kitchen.' },
      { ar: 'البهارات والزيوت بتبوظ جنب البوتاجاز من الحرارة، حتى لو ده أقرب مكان.',
        en: 'Spices and oils degrade next to the hob from the heat, even though it is the closest spot.' },
    ],
  },

  workbench: {
    id: 'workbench',
    spaceTypeAr: { ar: 'ترابيزة عدة / ورشة', en: 'Workbench' },
    spaceKind: 'surface',
    defaultSizeCm: { width: 150, depth: 70 },
    categories: {
      vise:       { labelAr: { ar: 'منجلة', en: 'Vice' },        zone: 'front',     side: 'dominant', anchor: 'front-dominant' },
      workArea:   { labelAr: { ar: 'منطقة الشغل', en: 'Work area' },  zone: 'front',     side: 'center',   anchor: 'front-center' },
      handTools:  { labelAr: { ar: 'عدة يدوي', en: 'Hand tools' },     zone: 'primary',   side: 'dominant' },
      powerTools: { labelAr: { ar: 'عدة كهربا', en: 'Power tools' },    zone: 'secondary', side: 'dominant' },
      fasteners:  { labelAr: { ar: 'مسامير وصواميل', en: 'Fasteners' },zone: 'secondary', side: 'off' },
      measuring:  { labelAr: { ar: 'أدوات قياس', en: 'Measuring tools' },   zone: 'primary',   side: 'off' },
      lamp:       { labelAr: { ar: 'إضاءة', en: 'Light' },        zone: 'back',      side: 'off',      tall: true },
      chemicals:  { labelAr: { ar: 'مواد كيماوية', en: 'Chemicals' }, zone: 'far',       side: 'any',      avoidLight: true, keepDry: true },
      storage:    { labelAr: { ar: 'صناديق', en: 'Boxes' },       zone: 'far',       side: 'any' },
      other:      { labelAr: { ar: 'حاجة تانية', en: 'Something else' },   zone: 'secondary', side: 'any' },
    },
    tipsAr: [
      { ar: 'العدة اللي بتستخدمها كل شوية لازم تتمسك من غير ما تبص — ثبّت مكانها ومتغيرهوش.',
        en: 'Tools you reach for constantly should be findable without looking — fix their place and keep it.' },
      { ar: 'سيب نص المساحة على الأقل فاضية: الترابيزة المليانة بتوقّف الشغل.',
        en: 'Keep at least half the bench clear: a full bench stops the work.' },
    ],
  },

  bedside: {
    id: 'bedside',
    spaceTypeAr: { ar: 'كومودينو', en: 'Bedside table' },
    spaceKind: 'surface',
    defaultSizeCm: { width: 45, depth: 40 },
    categories: {
      lamp:       { labelAr: { ar: 'أباجورة', en: 'Lamp' },      zone: 'back',      side: 'off',      tall: true, anchor: 'back-center' },
      phone:      { labelAr: { ar: 'موبايل', en: 'Phone' },       zone: 'primary',   side: 'dominant' },
      water:      { labelAr: { ar: 'مية', en: 'Water' },          zone: 'primary',   side: 'off',      keepDry: true },
      book:       { labelAr: { ar: 'كتاب', en: 'Book' },         zone: 'secondary', side: 'dominant' },
      glasses:    { labelAr: { ar: 'نضارة', en: 'Glasses' },        zone: 'primary',   side: 'dominant' },
      meds:       { labelAr: { ar: 'دوا', en: 'Medicine' },          zone: 'secondary', side: 'off',      avoidLight: true },
      decor:      { labelAr: { ar: 'ديكور', en: 'Decor' },        zone: 'far',       side: 'any' },
      other:      { labelAr: { ar: 'حاجة تانية', en: 'Something else' },   zone: 'secondary', side: 'any' },
    },
    tipsAr: [
      { ar: 'المية والدوا لازم توصلهم في الضلمة من غير ما تقوم — خليهم في نفس المكان دايماً.',
        en: 'You must reach water and medicine in the dark without getting up — keep them in the same place always.' },
      { ar: 'الكومودينو الصغير بيمتلي بسرعة: أي حاجة مش بتستخدمها قبل النوم أو بعد الصحيان مكانها مش هنا.',
        en: 'A small bedside table fills fast: anything you do not use before sleeping or after waking does not belong here.' },
    ],
  },

  study: {
    id: 'study',
    spaceTypeAr: { ar: 'مكتب مذاكرة', en: 'Study desk' },
    spaceKind: 'surface',
    defaultSizeCm: { width: 120, depth: 60 },
    categories: {
      books:      { labelAr: { ar: 'كتب', en: 'Books' },          zone: 'back',      side: 'center',   anchor: 'back-center', tall: true },
      notebook:   { labelAr: { ar: 'كشكول', en: 'Notebook' },        zone: 'front',     side: 'center',   anchor: 'front-center' },
      pens:       { labelAr: { ar: 'أقلام', en: 'Pens' },        zone: 'primary',   side: 'dominant', tall: true },
      lamp:       { labelAr: { ar: 'أباجورة', en: 'Lamp' },      zone: 'back',      side: 'off',      tall: true },
      laptop:     { labelAr: { ar: 'لابتوب', en: 'Laptop' },       zone: 'secondary', side: 'any',      tall: true, screen: true },
      water:      { labelAr: { ar: 'مية', en: 'Water' },          zone: 'secondary', side: 'off',      keepDry: true },
      phone:      { labelAr: { ar: 'موبايل', en: 'Phone' },       zone: 'far',       side: 'off' },
      storage:    { labelAr: { ar: 'تخزين', en: 'Storage' },        zone: 'far',       side: 'any' },
      other:      { labelAr: { ar: 'حاجة تانية', en: 'Something else' },   zone: 'secondary', side: 'any' },
    },
    tipsAr: [
      { ar: 'الموبايل مكانه بعيد عن متناول إيدك عن قصد — لو في متناولك هتمسكه.',
        en: 'The phone sits out of reach deliberately — within reach, you will pick it up.' },
      { ar: 'الأباجورة على عكس إيد الكتابة عشان إيدك متعملش ضل على الورقة.',
        en: 'The lamp goes opposite your writing hand so your hand casts no shadow on the page.' },
    ],
  },
};


/**
 * الحاويات: أي حاجة بترص جواها بدل ما ترتب عليها.
 * نفس البروفايل بالظبط، بس spaceKind = 'container' فبتروح لخوارزمية
 * الرص ثلاثي الأبعاد بدل مرتّب الأسطح. الفئات هنا بتحمل أعلام الرص.
 */
export const CONTAINER_PROFILES = {
  cabinBag: {
    id: 'cabinBag',
    spaceTypeAr: { ar: 'شنطة سفر', en: 'Travel bag' },
    spaceKind: 'container',
    defaultSizeCm: { width: 50, depth: 37, height: 25 },
    usesAirlinePresets: true,
    categories: {
      laptop:     { labelAr: { ar: 'لابتوب / تابلت', en: 'Laptop / tablet' }, keepUpright: true, fragile: true },
      electronics:{ labelAr: { ar: 'إلكترونيات', en: 'Electronics' }, fragile: true },
      camera:     { labelAr: { ar: 'كاميرا / عدسة', en: 'Camera / lens' }, keepUpright: true, fragile: true },
      glass:      { labelAr: { ar: 'حاجة قابلة للكسر', en: 'Fragile item' }, keepUpright: true, fragile: true },
      shoes:      { labelAr: { ar: 'جزم', en: 'Shoes' } },
      clothes:    { labelAr: { ar: 'هدوم', en: 'Clothes' }, compressible: true },
      toiletries: { labelAr: { ar: 'أدوات نظافة', en: 'Toiletries' }, keepUpright: true },
      book:       { labelAr: { ar: 'كتاب / ورق', en: 'Book / papers' } },
      food:       { labelAr: { ar: 'أكل', en: 'Food' }, keepUpright: true },
      other:      { labelAr: { ar: 'حاجة تانية', en: 'Something else' } },
    },
    tipsAr: [
      { ar: 'الحاجات التقيلة في القاع ناحية العجل — الشنطة بتبقى أثبت وانت بتجرها.',
        en: 'Heavy things at the bottom near the wheels — the bag rolls steadier.' },
    ],
  },

  drawer: {
    id: 'drawer',
    spaceTypeAr: { ar: 'درج', en: 'Drawer' },
    spaceKind: 'container',
    defaultSizeCm: { width: 45, depth: 40, height: 12 },
    categories: {
      flat:      { labelAr: { ar: 'حاجة مسطحة', en: 'Flat item' } },
      box:       { labelAr: { ar: 'علبة', en: 'Box' }, keepUpright: true },
      tools:     { labelAr: { ar: 'أدوات', en: 'Tools' } },
      cables:    { labelAr: { ar: 'كابلات', en: 'Cables' }, compressible: true },
      fragile:   { labelAr: { ar: 'حاجة قابلة للكسر', en: 'Fragile item' }, keepUpright: true, fragile: true },
      papers:    { labelAr: { ar: 'ورق', en: 'Papers' } },
      other:     { labelAr: { ar: 'حاجة تانية', en: 'Something else' } },
    },
    tipsAr: [
      { ar: 'الدرج الواطي بيضيع فيه الوقت لو الحاجات فوق بعض — خليها كلها ظاهرة من فوق.',
        en: 'A shallow drawer wastes your time when things stack — keep everything visible from above.' },
    ],
  },

  shelf: {
    id: 'shelf',
    spaceTypeAr: { ar: 'رف / دولاب', en: 'Shelf / cupboard' },
    spaceKind: 'container',
    defaultSizeCm: { width: 80, depth: 35, height: 40 },
    categories: {
      boxes:     { labelAr: { ar: 'علب وصناديق', en: 'Boxes' }, keepUpright: true },
      books:     { labelAr: { ar: 'كتب', en: 'Books' } },
      clothes:   { labelAr: { ar: 'هدوم مطوية', en: 'Folded clothes' }, compressible: true },
      appliance: { labelAr: { ar: 'جهاز', en: 'Appliance' }, keepUpright: true, fragile: true },
      dishes:    { labelAr: { ar: 'أطباق', en: 'Dishes' }, keepUpright: true, fragile: true },
      bags:      { labelAr: { ar: 'شنط', en: 'Bags' }, compressible: true },
      other:     { labelAr: { ar: 'حاجة تانية', en: 'Something else' } },
    },
    tipsAr: [
      { ar: 'اللي بتستخدمه كل يوم في مستوى العين، والتقيل تحت، والنادر فوق.',
        en: 'Daily things at eye level, heavy things low, rarely used things high.' },
    ],
  },

  movingBox: {
    id: 'movingBox',
    spaceTypeAr: { ar: 'كرتونة نقل', en: 'Moving box' },
    spaceKind: 'container',
    defaultSizeCm: { width: 45, depth: 35, height: 35 },
    categories: {
      heavy:     { labelAr: { ar: 'حاجة تقيلة', en: 'Heavy item' } },
      fragile:   { labelAr: { ar: 'قابل للكسر', en: 'Fragile' }, keepUpright: true, fragile: true },
      books:     { labelAr: { ar: 'كتب', en: 'Books' } },
      clothes:   { labelAr: { ar: 'هدوم', en: 'Clothes' }, compressible: true },
      kitchen:   { labelAr: { ar: 'أدوات مطبخ', en: 'Kitchenware' }, keepUpright: true, fragile: true },
      other:     { labelAr: { ar: 'حاجة تانية', en: 'Something else' } },
    },
    tipsAr: [
      { ar: 'التقيل تحت والخفيف فوق، ومتملاش الكرتونة لدرجة إنك متشيلهاش.',
        en: 'Heavy at the bottom, light on top — and do not fill it past what you can lift.' },
    ],
  },

  fridge: {
    id: 'fridge',
    spaceTypeAr: { ar: 'رف تلاجة', en: 'Fridge shelf' },
    spaceKind: 'container',
    defaultSizeCm: { width: 50, depth: 35, height: 25 },
    categories: {
      bottles:   { labelAr: { ar: 'زجاجات', en: 'Bottles' }, keepUpright: true },
      jars:      { labelAr: { ar: 'برطمانات', en: 'Jars' }, keepUpright: true, fragile: true },
      leftovers: { labelAr: { ar: 'علب أكل', en: 'Food containers' }, keepUpright: true },
      produce:   { labelAr: { ar: 'خضار وفاكهة', en: 'Produce' } },
      eggs:      { labelAr: { ar: 'بيض', en: 'Eggs' }, keepUpright: true, fragile: true },
      other:     { labelAr: { ar: 'حاجة تانية', en: 'Something else' } },
    },
    tipsAr: [
      { ar: 'اللي قرب يخلص قدام — ده أكتر سبب إن الأكل بيترمي.',
        en: 'What expires soonest goes at the front — the main reason food gets thrown out.' },
    ],
  },

  carBoot: {
    id: 'carBoot',
    spaceTypeAr: { ar: 'شنطة عربية', en: 'Car boot' },
    spaceKind: 'container',
    defaultSizeCm: { width: 100, depth: 60, height: 45 },
    categories: {
      luggage:   { labelAr: { ar: 'شنط', en: 'Luggage' } },
      bags:      { labelAr: { ar: 'أكياس', en: 'Bags' }, compressible: true },
      fragile:   { labelAr: { ar: 'قابل للكسر', en: 'Fragile' }, keepUpright: true, fragile: true },
      tools:     { labelAr: { ar: 'عدة', en: 'Tools' } },
      sports:    { labelAr: { ar: 'أدوات رياضة', en: 'Sports gear' } },
      other:     { labelAr: { ar: 'حاجة تانية', en: 'Something else' } },
    },
    tipsAr: [
      { ar: 'اللي هتحتاجه الأول قدام عند الباب — مش تحت كل حاجة.',
        en: 'What you need first goes by the tailgate, not under everything else.' },
    ],
  },
};

/** حاوية احتياطية عامة لأي حاجة بترص جواها ومش معروفة. */
export const GENERIC_CONTAINER = {
  id: 'genericContainer',
  spaceTypeAr: { ar: 'حاوية', en: 'Container' },
  spaceKind: 'container',
  defaultSizeCm: { width: 50, depth: 40, height: 30 },
  categories: {
    rigid:       { labelAr: { ar: 'حاجة جامدة', en: 'Rigid item' } },
    fragile:     { labelAr: { ar: 'قابل للكسر', en: 'Fragile' }, keepUpright: true, fragile: true },
    soft:        { labelAr: { ar: 'حاجة لينة', en: 'Soft item' }, compressible: true },
    keepUpright: { labelAr: { ar: 'لازم واقفة', en: 'Must stay upright' }, keepUpright: true },
    other:       { labelAr: { ar: 'حاجة تانية', en: 'Something else' } },
  },
  tipsAr: [],
};

/** بروفايل احتياطي عام — لأي مساحة مش متعرف عليها ومفيش AI. */
export const GENERIC_PROFILE = {
  id: 'generic',
  spaceTypeAr: { ar: 'مساحة', en: 'Space' },
  spaceKind: 'surface',
  defaultSizeCm: { width: 120, depth: 60 },
  categories: {
    main:    { labelAr: { ar: 'الحاجة الأساسية', en: 'The main thing' }, zone: 'back',      side: 'center', anchor: 'back-center', tall: true },
    daily:   { labelAr: { ar: 'بستخدمها يومياً', en: 'Daily use' }, zone: 'primary',   side: 'dominant' },
    liquid:  { labelAr: { ar: 'سوايل', en: 'Liquids' },           zone: 'secondary', side: 'off', keepDry: true },
    tall:    { labelAr: { ar: 'حاجة عالية', en: 'Something tall' },      zone: 'back',      side: 'any', tall: true },
    rare:    { labelAr: { ar: 'نادراً', en: 'Rarely used' },          zone: 'far',       side: 'any' },
    decor:   { labelAr: { ar: 'ديكور', en: 'Decor' },           zone: 'far',       side: 'any' },
    other:   { labelAr: { ar: 'حاجة تانية', en: 'Something else' },      zone: 'secondary', side: 'any' },
  },
  tipsAr: [],
};

const VALID_FLAGS = ['tall', 'keepDry', 'avoidLight', 'wantsLight', 'hot', 'fragile', 'screen'];

/**
 * بيتحقق من بروفايل جاي من الموديل ويصلّحه.
 *
 * الموديل بيقترح قواعد — بس ممنوع يخترع مناطق أو نواحي مش موجودة،
 * ولا يسيب المساحة من غير فئة "حاجة تانية". أي حاجة غلط بترجع لقيمة آمنة.
 */
export function normalizeProfile(raw, fallback = GENERIC_PROFILE) {
  if (!raw || typeof raw !== 'object') return { ...fallback, source: 'fallback' };

  const categories = {};
  const rawCats = raw.categories && typeof raw.categories === 'object' ? raw.categories : {};
  const anchorsUsed = new Set();

  for (const [key, def] of Object.entries(rawCats)) {
    if (!def || typeof def !== 'object') continue;
    const safeKey = String(key).replace(/[^a-zA-Z0-9_]/g, '').slice(0, 32);
    if (!safeKey) continue;

    const cat = {
      labelAr: String(def.labelAr || safeKey).slice(0, 40),
      zone: ZONES[def.zone] ? def.zone : 'secondary',
      side: SIDES.includes(def.side) ? def.side : 'any',
    };

    for (const flag of VALID_FLAGS) if (def[flag] === true) cat[flag] = true;
    // أعلام الرص للحاويات
    for (const flag of ['keepUpright', 'compressible']) if (def[flag] === true) cat[flag] = true;

    // خانة الإرساء الواحدة متتاخدش مرتين
    if (ANCHOR_SLOTS.includes(def.anchor) && !anchorsUsed.has(def.anchor)) {
      cat.anchor = def.anchor;
      anchorsUsed.add(def.anchor);
    }

    categories[safeKey] = cat;
  }

  // لازم يفضل فيه مخرج لأي حاجة الموديل مصنّفهاش
  if (!categories.other) {
    categories.other = { labelAr: { ar: 'حاجة تانية', en: 'Something else' }, zone: 'secondary', side: 'any' };
  }

  if (Object.keys(categories).length < 2) return { ...fallback, source: 'fallback' };

  const size = raw.defaultSizeCm || {};
  return {
    id: 'ai',
    spaceTypeAr: String(raw.spaceTypeAr || 'مساحة').slice(0, 40),
    spaceKind: raw.spaceKind === 'container' ? 'container' : 'surface',
    defaultSizeCm: {
      width: clampNum(size.width, 10, 400, fallback.defaultSizeCm.width),
      depth: clampNum(size.depth, 10, 200, fallback.defaultSizeCm.depth),
      height: clampNum(size.height, 3, 200, fallback.defaultSizeCm.height || 30),
    },
    categories,
    tipsAr: Array.isArray(raw.tipsAr)
      ? raw.tipsAr.filter((t) => typeof t === 'string' && t.trim()).slice(0, 4).map((t) => t.slice(0, 300))
      : [],
    source: 'ai',
  };
}

function clampNum(v, lo, hi, fallback) {
  const n = Number(v);
  return Number.isFinite(n) && n >= lo && n <= hi ? n : fallback;
}

/** كل البروفايلات — أسطح وحاويات في مكان واحد. */
export const ALL_PROFILES = { ...BUILT_IN_PROFILES, ...CONTAINER_PROFILES };

/** ليستة الاختيار اليدوي، متقسمة لمجموعتين. */
export function profileOptions() {
  return [
    { group: 'surfaces', items: Object.values(BUILT_IN_PROFILES).map((p) => ({ id: p.id, labelAr: p.spaceTypeAr })) },
    { group: 'containers', items: Object.values(CONTAINER_PROFILES).map((p) => ({ id: p.id, labelAr: p.spaceTypeAr })) },
  ];
}

export function getProfile(id) {
  return ALL_PROFILES[id] || GENERIC_PROFILE;
}

export const isContainer = (profile) => profile?.spaceKind === 'container';

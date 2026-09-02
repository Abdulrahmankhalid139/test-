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
      { ar: '      ', en: '      ' },
      { ar: '      ', en: '      ' },
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
      { ar: '      ', en: '      ' },
      { ar: '      ', en: '      ' },
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
      { ar: '      ', en: '      ' },
      { ar: '      ', en: '      ' },
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
      { ar: '      ', en: '      ' },
      { ar: '      ', en: '      ' },
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
      { ar: '      ', en: '      ' },
      { ar: '      ', en: '      ' },
    ],
  },
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
      width: clampNum(size.width, 20, 400, fallback.defaultSizeCm.width),
      depth: clampNum(size.depth, 15, 200, fallback.defaultSizeCm.depth),
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

/** ليستة المساحات الجاهزة للاختيار اليدوي. */
export function profileOptions() {
  return Object.values(BUILT_IN_PROFILES).map((p) => ({ id: p.id, labelAr: p.spaceTypeAr }));
}

export function getProfile(id) {
  return BUILT_IN_PROFILES[id] || GENERIC_PROFILE;
}

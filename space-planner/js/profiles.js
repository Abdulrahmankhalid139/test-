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
  front:     { targetCm: 18, labelAr: 'قدامك مباشرة' },
  primary:   { targetCm: 32, labelAr: 'في متناول إيدك من غير ما تتحرك' },
  secondary: { targetCm: 52, labelAr: 'على بُعد مد دراع' },
  back:      { targetCm: 70, labelAr: 'في العمق ناحية الحيطة' },
  far:       { targetCm: 85, labelAr: 'بعيد عن منطقة الشغل' },
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
    spaceTypeAr: 'مكتب شغل',
    spaceKind: 'surface',
    defaultSizeCm: { width: 140, depth: 70 },
    categories: {
      monitor:    { labelAr: 'شاشة',        zone: 'back',      side: 'center',   anchor: 'back-center', tall: true, screen: true },
      laptop:     { labelAr: 'لابتوب',      zone: 'back',      side: 'center',   anchor: 'back-center', tall: true, screen: true },
      keyboard:   { labelAr: 'كيبورد',      zone: 'front',     side: 'center',   anchor: 'front-center' },
      mouse:      { labelAr: 'ماوس',        zone: 'front',     side: 'dominant', anchor: 'front-dominant' },
      drink:      { labelAr: 'مشروب',       zone: 'secondary', side: 'off',      keepDry: true },
      phone:      { labelAr: 'موبايل',      zone: 'primary',   side: 'off' },
      notebook:   { labelAr: 'نوتة / ورق',  zone: 'primary',   side: 'dominant' },
      pens:       { labelAr: 'أقلام',       zone: 'primary',   side: 'dominant' },
      lamp:       { labelAr: 'أباجورة',     zone: 'back',      side: 'off',      tall: true },
      speaker:    { labelAr: 'سماعة',       zone: 'back',      side: 'any',      tall: true },
      headphones: { labelAr: 'سماعة راس',   zone: 'secondary', side: 'off' },
      plant:      { labelAr: 'نبتة',        zone: 'far',       side: 'any',      tall: true, wantsLight: true },
      books:      { labelAr: 'كتب',         zone: 'far',       side: 'any',      tall: true },
      storage:    { labelAr: 'تخزين',       zone: 'far',       side: 'any' },
      decor:      { labelAr: 'ديكور',       zone: 'far',       side: 'any' },
      other:      { labelAr: 'حاجة تانية',  zone: 'secondary', side: 'any' },
    },
    tipsAr: [],
  },

  dresser: {
    id: 'dresser',
    spaceTypeAr: 'تسريحة',
    spaceKind: 'surface',
    defaultSizeCm: { width: 110, depth: 45 },
    categories: {
      mirror:     { labelAr: 'مراية',        zone: 'back',      side: 'center',   anchor: 'back-center', tall: true },
      lamp:       { labelAr: 'إضاءة',        zone: 'back',      side: 'off',      tall: true },
      dailyMakeup:{ labelAr: 'مكياج يومي',   zone: 'primary',   side: 'dominant' },
      makeup:     { labelAr: 'مكياج',        zone: 'secondary', side: 'dominant' },
      brushes:    { labelAr: 'فرش',          zone: 'primary',   side: 'dominant', tall: true },
      skincare:   { labelAr: 'عناية بالبشرة',zone: 'secondary', side: 'off',      avoidLight: true },
      perfume:    { labelAr: 'برفان',        zone: 'secondary', side: 'any',      tall: true, avoidLight: true },
      jewelry:    { labelAr: 'إكسسوار',      zone: 'secondary', side: 'off' },
      hairTools:  { labelAr: 'أدوات شعر',    zone: 'secondary', side: 'dominant', hot: true },
      tissues:    { labelAr: 'مناديل',       zone: 'secondary', side: 'off' },
      storage:    { labelAr: 'علب تخزين',    zone: 'far',       side: 'any' },
      decor:      { labelAr: 'ديكور',        zone: 'far',       side: 'any' },
      other:      { labelAr: 'حاجة تانية',   zone: 'secondary', side: 'any' },
    },
    tipsAr: [
      'الإضاءة الأحسن للمكياج بتيجي من قدامك على مستوى الوش — مش من فوق، عشان متعملش ضل تحت العين.',
      'البرفانات والسيرومات بتبوظ بسرعة في الشمس والحرارة — خليها في ركن مظلل أو في درج.',
    ],
  },

  kitchen: {
    id: 'kitchen',
    spaceTypeAr: 'رف / تختة مطبخ',
    spaceKind: 'surface',
    defaultSizeCm: { width: 180, depth: 60 },
    categories: {
      board:      { labelAr: 'تختة تقطيع',   zone: 'front',     side: 'center',   anchor: 'front-center' },
      knives:     { labelAr: 'سكاكين',       zone: 'primary',   side: 'dominant', tall: true },
      spices:     { labelAr: 'بهارات',       zone: 'primary',   side: 'off',      tall: true, avoidLight: true },
      oils:       { labelAr: 'زيوت',         zone: 'secondary', side: 'off',      tall: true, avoidLight: true },
      appliance:  { labelAr: 'جهاز كهربا',   zone: 'back',      side: 'any',      tall: true, keepDry: true },
      pots:       { labelAr: 'حلل وطاسات',   zone: 'secondary', side: 'any',      tall: true },
      utensils:   { labelAr: 'أدوات',        zone: 'primary',   side: 'dominant', tall: true },
      dishes:     { labelAr: 'أطباق',        zone: 'secondary', side: 'any' },
      produce:    { labelAr: 'خضار وفاكهة',  zone: 'far',       side: 'any' },
      storage:    { labelAr: 'برطمانات',     zone: 'far',       side: 'any',      tall: true },
      other:      { labelAr: 'حاجة تانية',   zone: 'secondary', side: 'any' },
    },
    tipsAr: [
      'سيب مساحة فاضية قدام تختة التقطيع — دي أهم مساحة في المطبخ وأكتر حاجة بتضيع.',
      'البهارات والزيوت بتبوظ جنب البوتاجاز من الحرارة، حتى لو ده أقرب مكان.',
    ],
  },

  workbench: {
    id: 'workbench',
    spaceTypeAr: 'ترابيزة عدة / ورشة',
    spaceKind: 'surface',
    defaultSizeCm: { width: 150, depth: 70 },
    categories: {
      vise:       { labelAr: 'منجلة',        zone: 'front',     side: 'dominant', anchor: 'front-dominant' },
      workArea:   { labelAr: 'منطقة الشغل',  zone: 'front',     side: 'center',   anchor: 'front-center' },
      handTools:  { labelAr: 'عدة يدوي',     zone: 'primary',   side: 'dominant' },
      powerTools: { labelAr: 'عدة كهربا',    zone: 'secondary', side: 'dominant' },
      fasteners:  { labelAr: 'مسامير وصواميل',zone: 'secondary', side: 'off' },
      measuring:  { labelAr: 'أدوات قياس',   zone: 'primary',   side: 'off' },
      lamp:       { labelAr: 'إضاءة',        zone: 'back',      side: 'off',      tall: true },
      chemicals:  { labelAr: 'مواد كيماوية', zone: 'far',       side: 'any',      avoidLight: true, keepDry: true },
      storage:    { labelAr: 'صناديق',       zone: 'far',       side: 'any' },
      other:      { labelAr: 'حاجة تانية',   zone: 'secondary', side: 'any' },
    },
    tipsAr: [
      'العدة اللي بتستخدمها كل شوية لازم تتمسك من غير ما تبص — ثبّت مكانها ومتغيرهوش.',
      'سيب نص المساحة على الأقل فاضية: الترابيزة المليانة بتوقّف الشغل.',
    ],
  },

  bedside: {
    id: 'bedside',
    spaceTypeAr: 'كومودينو',
    spaceKind: 'surface',
    defaultSizeCm: { width: 45, depth: 40 },
    categories: {
      lamp:       { labelAr: 'أباجورة',      zone: 'back',      side: 'off',      tall: true, anchor: 'back-center' },
      phone:      { labelAr: 'موبايل',       zone: 'primary',   side: 'dominant' },
      water:      { labelAr: 'مية',          zone: 'primary',   side: 'off',      keepDry: true },
      book:       { labelAr: 'كتاب',         zone: 'secondary', side: 'dominant' },
      glasses:    { labelAr: 'نضارة',        zone: 'primary',   side: 'dominant' },
      meds:       { labelAr: 'دوا',          zone: 'secondary', side: 'off',      avoidLight: true },
      decor:      { labelAr: 'ديكور',        zone: 'far',       side: 'any' },
      other:      { labelAr: 'حاجة تانية',   zone: 'secondary', side: 'any' },
    },
    tipsAr: [
      'المية والدوا لازم توصلهم في الضلمة من غير ما تقوم — خليهم في نفس المكان دايماً.',
      'الكومودينو الصغير بيمتلي بسرعة: أي حاجة مش بتستخدمها قبل النوم أو بعد الصحيان مكانها مش هنا.',
    ],
  },

  study: {
    id: 'study',
    spaceTypeAr: 'مكتب مذاكرة',
    spaceKind: 'surface',
    defaultSizeCm: { width: 120, depth: 60 },
    categories: {
      books:      { labelAr: 'كتب',          zone: 'back',      side: 'center',   anchor: 'back-center', tall: true },
      notebook:   { labelAr: 'كشكول',        zone: 'front',     side: 'center',   anchor: 'front-center' },
      pens:       { labelAr: 'أقلام',        zone: 'primary',   side: 'dominant', tall: true },
      lamp:       { labelAr: 'أباجورة',      zone: 'back',      side: 'off',      tall: true },
      laptop:     { labelAr: 'لابتوب',       zone: 'secondary', side: 'any',      tall: true, screen: true },
      water:      { labelAr: 'مية',          zone: 'secondary', side: 'off',      keepDry: true },
      phone:      { labelAr: 'موبايل',       zone: 'far',       side: 'off' },
      storage:    { labelAr: 'تخزين',        zone: 'far',       side: 'any' },
      other:      { labelAr: 'حاجة تانية',   zone: 'secondary', side: 'any' },
    },
    tipsAr: [
      'الموبايل مكانه بعيد عن متناول إيدك عن قصد — لو في متناولك هتمسكه.',
      'الأباجورة على عكس إيد الكتابة عشان إيدك متعملش ضل على الورقة.',
    ],
  },
};

/** بروفايل احتياطي عام — لأي مساحة مش متعرف عليها ومفيش AI. */
export const GENERIC_PROFILE = {
  id: 'generic',
  spaceTypeAr: 'مساحة',
  spaceKind: 'surface',
  defaultSizeCm: { width: 120, depth: 60 },
  categories: {
    main:    { labelAr: 'الحاجة الأساسية', zone: 'back',      side: 'center', anchor: 'back-center', tall: true },
    daily:   { labelAr: 'بستخدمها يومياً', zone: 'primary',   side: 'dominant' },
    liquid:  { labelAr: 'سوايل',           zone: 'secondary', side: 'off', keepDry: true },
    tall:    { labelAr: 'حاجة عالية',      zone: 'back',      side: 'any', tall: true },
    rare:    { labelAr: 'نادراً',          zone: 'far',       side: 'any' },
    decor:   { labelAr: 'ديكور',           zone: 'far',       side: 'any' },
    other:   { labelAr: 'حاجة تانية',      zone: 'secondary', side: 'any' },
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
    categories.other = { labelAr: 'حاجة تانية', zone: 'secondary', side: 'any' };
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

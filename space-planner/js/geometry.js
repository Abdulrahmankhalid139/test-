/**
 * geometry.js — تحويل الصورة لسنتيمترات حقيقية.
 *
 * المبدأ: الموديل بيشوف ويحدد المربعات، والرياضة هنا بتحسب المقاسات.
 * من غير مرجع قياس، أي رقم بيطلع من الموديل مجرد تخمين.
 */

/**
 * مراجع القياس المتاحة.
 *
 * `exact` = مقاس قياسي موثّق (مواصفة عالمية) — الحساب عليه دقيق.
 * `approx` = مقاس شائع بيقرب من الحقيقة لكنه بيختلف من حاجة للتانية،
 *            فبنقول للمستخدم إن النتيجة تقريبية بدل ما ندّعي دقة مش موجودة.
 */
export const SCALE_REFERENCES = {
  card: {
    id: 'card', group: 'exact',
    labelAr: { ar: 'كارت بنك / بطاقة هوية', en: 'Bank or ID card' },
    hintAr: { ar: 'أي كارت بمقاس البطاقة البنكية (ISO ID-1)', en: 'Any card in ISO ID-1 format' },
    widthCm: 8.56, heightCm: 5.398,
  },
  a4: {
    id: 'a4', group: 'exact',
    labelAr: { ar: 'ورقة A4', en: 'A4 sheet' },
    hintAr: { ar: 'ورقة الطباعة العادية', en: 'Standard printer paper' },
    widthCm: 21.0, heightCm: 29.7,
  },
  a5: {
    id: 'a5', group: 'exact',
    labelAr: { ar: 'ورقة A5', en: 'A5 sheet' },
    hintAr: { ar: 'نص ورقة A4', en: 'Half an A4' },
    widthCm: 14.8, heightCm: 21.0,
  },
  letter: {
    id: 'letter', group: 'exact',
    labelAr: { ar: 'ورقة Letter (أمريكية)', en: 'US Letter sheet' },
    hintAr: { ar: '8.5×11 بوصة', en: '8.5×11 inches' },
    widthCm: 21.6, heightCm: 27.9,
  },
  ruler30: {
    id: 'ruler30', group: 'exact',
    labelAr: { ar: 'مسطرة 30 سم', en: '30 cm ruler' },
    hintAr: { ar: 'المسطرة المدرسية', en: 'The school ruler' },
    widthCm: 30.0, heightCm: 3.5,
  },
  cd: {
    id: 'cd', group: 'exact',
    labelAr: { ar: 'اسطوانة CD / DVD', en: 'CD or DVD disc' },
    hintAr: { ar: 'قطرها 12 سم بالظبط', en: 'Exactly 12 cm across' },
    widthCm: 12.0, heightCm: 12.0,
  },
  can330: {
    id: 'can330', group: 'exact',
    labelAr: { ar: 'علبة مشروب 330 مل', en: '330 ml drink can' },
    hintAr: { ar: 'العلبة المعدنية العادية', en: 'The standard aluminium can' },
    widthCm: 6.6, heightCm: 11.5,
  },
  phone: {
    id: 'phone', group: 'common', approx: true,
    labelAr: { ar: 'موبايل عادي', en: 'A typical phone' },
    hintAr: { ar: 'حوالي 7 سم عرض — بيختلف من موديل للتاني', en: 'About 7 cm wide — varies by model' },
    widthCm: 7.2, heightCm: 14.8,
  },
  pen: {
    id: 'pen', group: 'common', approx: true,
    labelAr: { ar: 'قلم جاف', en: 'A ballpoint pen' },
    hintAr: { ar: 'حوالي 14.5 سم طول', en: 'About 14.5 cm long' },
    widthCm: 1.1, heightCm: 14.5,
  },
  penHolder: {
    id: 'penHolder', group: 'common', approx: true,
    labelAr: { ar: 'علبة أقلام مكتب', en: 'A desk pen holder' },
    hintAr: { ar: 'الكوباية اللي بتتحط فيها الأقلام والهايلايتر', en: 'The cup that holds pens and highlighters' },
    widthCm: 8.5, heightCm: 10.0,
  },
  mug: {
    id: 'mug', group: 'common', approx: true,
    labelAr: { ar: 'مج قهوة', en: 'A coffee mug' },
    hintAr: { ar: 'حوالي 8 سم قطر', en: 'About 8 cm across' },
    widthCm: 8.2, heightCm: 9.5,
  },
  bottle500: {
    id: 'bottle500', group: 'common', approx: true,
    labelAr: { ar: 'ازازة مية نص لتر', en: 'A 500 ml water bottle' },
    hintAr: { ar: 'حوالي 21 سم طول', en: 'About 21 cm tall' },
    widthCm: 6.5, heightCm: 21.0,
  },
  tissueBox: {
    id: 'tissueBox', group: 'common', approx: true,
    labelAr: { ar: 'علبة مناديل مكعبة', en: 'A cube tissue box' },
    hintAr: { ar: 'حوالي 11 سم ضلع', en: 'About 11 cm a side' },
    widthCm: 11.0, heightCm: 11.0,
  },
  mouse: {
    id: 'mouse', group: 'common', approx: true,
    labelAr: { ar: 'ماوس كمبيوتر', en: 'A computer mouse' },
    hintAr: { ar: 'حوالي 6×11.5 سم', en: 'About 6×11.5 cm' },
    widthCm: 6.2, heightCm: 11.5,
  },
  keyboard: {
    id: 'keyboard', group: 'common', approx: true,
    labelAr: { ar: 'كيبورد عادي', en: 'A full-size keyboard' },
    hintAr: { ar: 'حوالي 44 سم عرض', en: 'About 44 cm wide' },
    widthCm: 44.0, heightCm: 13.0,
  },
  laptop14: {
    id: 'laptop14', group: 'common', approx: true,
    labelAr: { ar: 'لابتوب 14 بوصة', en: 'A 14-inch laptop' },
    hintAr: { ar: 'حوالي 32 سم عرض وهو مقفول', en: 'About 32 cm wide when closed' },
    widthCm: 32.3, heightCm: 22.6,
  },
  hand: {
    id: 'hand', group: 'common', approx: true,
    labelAr: { ar: 'كف إيدك (شبر)', en: 'Your hand span' },
    hintAr: { ar: 'افرد إيدك جنب الحاجات — الشبر حوالي 22 سم', en: 'Spread your hand next to the things — a span is about 22 cm' },
    widthCm: 22.0, heightCm: 9.0,
  },
  custom: {
    id: 'custom', group: 'common',
    labelAr: { ar: 'حاجة تانية — أكتب مقاسها', en: 'Something else — I will type its size' },
    hintAr: { ar: 'اكتب اسمها وعرضها بالسنتيمتر', en: 'Type what it is and how wide it is' },
    widthCm: null, heightCm: null,
  },
};

/** بيرجع المراجع في مجموعتين: مقاسات قياسية، وحاجات يومية تقريبية. */
export function scaleRefGroups() {
  const all = Object.values(SCALE_REFERENCES);
  return [
    { group: 'refGroupExact', items: all.filter((r) => r.group === 'exact') },
    { group: 'refGroupCommon', items: all.filter((r) => r.group === 'common') },
  ];
}

/** الوحدات اللي المستخدم ممكن يقيس بيها — الشبر عشان مش كل حد معاه متر. */
export const LENGTH_UNITS = {
  cm: { id: 'cm', cm: 1 },
  span: { id: 'span', cm: 22 },
  inch: { id: 'inch', cm: 2.54 },
};

/** بيحوّل رقم كتبه المستخدم بأي وحدة لسنتيمترات. */
export function toCm(value, unit, spanCm = 22) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (unit === 'span') return round1(n * (Number(spanCm) > 0 ? Number(spanCm) : 22));
  return round1(n * (LENGTH_UNITS[unit]?.cm || 1));
}

/**
 * Gemini بيرجع المربعات بصيغة [ymin, xmin, ymax, xmax] مقياسها 0..1000.
 * بنحولها لكائن مفهوم.
 */
export function normalizeBox(box) {
  if (!Array.isArray(box) || box.length !== 4) return null;
  const [ymin, xmin, ymax, xmax] = box.map(Number);
  if ([ymin, xmin, ymax, xmax].some((n) => !Number.isFinite(n))) return null;
  return {
    x: Math.min(xmin, xmax) / 1000,
    y: Math.min(ymin, ymax) / 1000,
    w: Math.abs(xmax - xmin) / 1000,
    h: Math.abs(ymax - ymin) / 1000,
  };
}

/**
 * بيحسب "كام سنتيمتر في الوحدة الواحدة" من مرجع القياس.
 *
 * المرجع ممكن يكون متصوّر بالطول أو بالعرض، فبنجرب الاتجاهين
 * وناخد اللي نسبة أبعاده أقرب للمقاس الحقيقي — ده بيمنع خطأ
 * إن المسطرة تتحسب مقلوبة فتضاعف كل المقاسات.
 *
 * @returns {{cmPerUnitX:number, cmPerUnitY:number, rotated:boolean, aspectError:number}}
 */
export function computeScale(refBox, refRealWidthCm, refRealHeightCm) {
  if (!refBox || !refBox.w || !refBox.h) {
    throw new Error('مرجع القياس مش موجود في الصورة');
  }
  if (!refRealWidthCm || !refRealHeightCm) {
    throw new Error('مقاس مرجع القياس ناقص');
  }

  const boxAspect = refBox.w / refBox.h;
  const uprightAspect = refRealWidthCm / refRealHeightCm;
  const rotatedAspect = refRealHeightCm / refRealWidthCm;

  const uprightError = Math.abs(Math.log(boxAspect / uprightAspect));
  const rotatedError = Math.abs(Math.log(boxAspect / rotatedAspect));
  const rotated = rotatedError < uprightError;

  const realW = rotated ? refRealHeightCm : refRealWidthCm;
  const realH = rotated ? refRealWidthCm : refRealHeightCm;

  return {
    cmPerUnitX: realW / refBox.w,
    cmPerUnitY: realH / refBox.h,
    rotated,
    aspectError: Math.min(uprightError, rotatedError),
  };
}

/** بيحول مربع في الصورة لمقاس بالسنتيمتر. */
export function boxToCm(box, scale) {
  return {
    widthCm: round1(box.w * scale.cmPerUnitX),
    depthCm: round1(box.h * scale.cmPerUnitY),
  };
}

/**
 * الصورة مأخوذة بزاوية، فالحاجات البعيدة بتبان أصغر.
 * بنصحح تصحيح تقريبي خطي حسب بُعد الحاجة عن مرجع القياس رأسياً.
 * تصحيح متواضع عن قصد — أحسن من غير تصحيح، وأأمن من ادعاء دقة مش موجودة.
 */
export function perspectiveCorrect(objBox, refBox, strength = 0.35) {
  const objCenterY = objBox.y + objBox.h / 2;
  const refCenterY = refBox.y + refBox.h / 2;
  const delta = refCenterY - objCenterY; // موجب = الحاجة أبعد (أعلى في الصورة)
  const factor = 1 + delta * strength;
  return Math.min(1.6, Math.max(0.65, factor));
}

export function round1(n) {
  return Math.round(n * 10) / 10;
}

export function cm(n) {
  return `${round1(n)} سم`;
}

/** ثقة القياس — بنعرضها للمستخدم بدل ما ندّعي دقة مطلقة. */
export function scaleConfidence(scale, refBox) {
  const areaFraction = refBox.w * refBox.h;
  let score = 1;
  // مرجع صغير جداً في الصورة = خطأ أكبر
  if (areaFraction < 0.004) score -= 0.45;
  else if (areaFraction < 0.012) score -= 0.2;
  // نسبة أبعاد بعيدة عن الحقيقية = الكارت متصوّر بزاوية مايلة
  if (scale.aspectError > 0.35) score -= 0.4;
  else if (scale.aspectError > 0.18) score -= 0.2;
  score = Math.max(0.1, Math.min(1, score));
  const labelAr = score > 0.75 ? 'عالية' : score > 0.45 ? 'متوسطة' : 'منخفضة';
  return { score, labelAr };
}

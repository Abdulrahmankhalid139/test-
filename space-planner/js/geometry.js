/**
 * geometry.js — تحويل الصورة لسنتيمترات حقيقية.
 *
 * المبدأ: الموديل بيشوف ويحدد المربعات، والرياضة هنا بتحسب المقاسات.
 * من غير مرجع قياس، أي رقم بيطلع من الموديل مجرد تخمين.
 */

/** مراجع القياس المتاحة — مقاسات حقيقية موثقة بالمليمتر. */
export const SCALE_REFERENCES = {
  card: {
    id: 'card',
    labelAr: 'كارت بنك / بطاقة هوية',
    hintAr: 'أي كارت بمقاس البطاقة البنكية (ISO ID-1)',
    widthCm: 8.56,
    heightCm: 5.398,
  },
  a4: {
    id: 'a4',
    labelAr: 'ورقة A4',
    hintAr: 'ورقة الطباعة العادية',
    widthCm: 21.0,
    heightCm: 29.7,
  },
  a5: {
    id: 'a5',
    labelAr: 'ورقة A5',
    hintAr: 'نص ورقة A4',
    widthCm: 14.8,
    heightCm: 21.0,
  },
  ruler30: {
    id: 'ruler30',
    labelAr: 'مسطرة 30 سم',
    hintAr: 'المسطرة المدرسية',
    widthCm: 30.0,
    heightCm: 3.5,
  },
  custom: {
    id: 'custom',
    labelAr: 'حاجة تانية (أدخل المقاس)',
    hintAr: 'اكتب العرض بالسنتيمتر',
    widthCm: null,
    heightCm: null,
  },
};

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

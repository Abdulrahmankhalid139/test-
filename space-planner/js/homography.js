/**
 * homography.js — بيحط المخطط على الصورة نفسها.
 *
 * المخطط بيتحسب من فوق (سنتيمترات على مستوى مسطح). الصورة متصورة بزاوية.
 * عشان نرسم المخطط جوه الصورة محتاجين التحويل اللي بيربط المستويين:
 * تحويل إسقاطي بثمن معاملات، بيتحسب من أربع نقط معروفة في الاتنين.
 *
 * ده مش تقريب: أربع نقط كفاية تحدد التحويل بالظبط لأي مستوى مسطح.
 * السطح مستوى مسطح، فالرياضة هنا مضبوطة — بس بقد دقة الأركان الأربعة.
 *
 * مفيش AI هنا خالص. الموديل بيقول الأركان فين، والباقي حساب.
 */

/**
 * بيحل نظام معادلات خطية بطريقة جاوس مع اختيار المحور الأكبر.
 * @returns {number[]|null} null لو النظام متفرد (النقط على خط واحد مثلاً)
 */
function solve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    // بندور على أكبر معامل عشان القسمة تفضل مستقرة عددياً
    let piv = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    }
    if (Math.abs(M[piv][col]) < 1e-10) return null;
    [M[col], M[piv]] = [M[piv], M[col]];

    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / M[col][col];
      if (!f) continue;
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }

  return M.map((row, i) => row[n] / row[i][i] ?? 0).map((v, i) => M[i][n] / M[i][i]);
}

/**
 * بيحسب التحويل من أربع نقط في المخطط لأربع نقط في الصورة.
 *
 * الترتيب لازم يبقى واحد في الاتنين. إحنا ماشيين:
 * قدام-شمال، قدام-يمين، ورا-يمين، ورا-شمال.
 *
 * @param {Array<{x:number,y:number}>} src نقط المصدر (المخطط)
 * @param {Array<{x:number,y:number}>} dst نقط الهدف (الصورة، 0..1)
 * @returns {number[]|null} تسع معاملات [h0..h8]، أو null لو مش قابل للحل
 */
export function solveHomography(src, dst) {
  if (!Array.isArray(src) || !Array.isArray(dst) || src.length !== 4 || dst.length !== 4) return null;
  if ([...src, ...dst].some((p) => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y))) return null;

  const A = [];
  const b = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }

  const h = solve(A, b);
  if (!h || h.some((n) => !Number.isFinite(n))) return null;
  return [...h, 1];
}

/** بيمرر نقطة من المخطط للصورة. */
export function applyH(H, x, y) {
  const w = H[6] * x + H[7] * y + H[8];
  if (Math.abs(w) < 1e-9) return null;
  return {
    x: (H[0] * x + H[1] * y + H[2]) / w,
    y: (H[3] * x + H[4] * y + H[5]) / w,
  };
}

/** بيحوّل مستطيل من المخطط لرباعي في الصورة (الزوايا القايمة بتبقى مايلة). */
export function projectRect(H, x, y, w, d) {
  const pts = [
    applyH(H, x, y),
    applyH(H, x + w, y),
    applyH(H, x + w, y + d),
    applyH(H, x, y + d),
  ];
  return pts.every(Boolean) ? pts : null;
}

/**
 * الأركان اللي الموديل رجّعها — بنتأكد منها قبل ما نبني عليها.
 *
 * الموديل ممكن يرجّع أركان متعكوسة أو منهارة على خط واحد، وساعتها
 * التحويل بيطلع مسخرة. بنرفض ده ونرجع للطريقة التقريبية بدل ما نرسم غلط.
 *
 * @param {Array} raw أربع نقط بمقياس 0..1000 بصيغة [x, y]
 */
export function validCorners(raw) {
  if (!Array.isArray(raw) || raw.length !== 4) return null;
  const pts = raw.map((p) => (Array.isArray(p) && p.length === 2
    ? { x: Number(p[0]) / 1000, y: Number(p[1]) / 1000 }
    : null));
  if (pts.some((p) => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y))) return null;
  if (pts.some((p) => p.x < -0.1 || p.x > 1.1 || p.y < -0.1 || p.y > 1.1)) return null;

  // مساحة الرباعي بصيغة الحذاء — صغيرة أوي يبقى النقط منهارة
  let area = 0;
  for (let i = 0; i < 4; i++) {
    const a = pts[i], b = pts[(i + 1) % 4];
    area += a.x * b.y - b.x * a.y;
  }
  if (Math.abs(area) / 2 < 0.02) return null;

  // لازم يكون محدّب: أي ركن مقعّر معناه إن الترتيب اتلخبط
  const cross = [];
  for (let i = 0; i < 4; i++) {
    const a = pts[i], b = pts[(i + 1) % 4], c = pts[(i + 2) % 4];
    cross.push((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x));
  }
  if (!(cross.every((v) => v > 0) || cross.every((v) => v < 0))) return null;

  return pts;
}

/**
 * لو الموديل مارجّعش أركان صالحة، بنقرّب من المربع المحيط.
 *
 * الافتراض: الصورة متصورة من قدام وبزاوية لتحت، فالحرف البعيد بيبان
 * أضيق من القريب. النسبة دي تخمين — عشان كده بنعلّم النتيجة إنها تقريبية.
 */
export function cornersFromBox(box, narrowing = 0.82) {
  if (!box || !(box.w > 0) || !(box.h > 0)) return null;
  const inset = (box.w * (1 - narrowing)) / 2;
  return {
    corners: [
      { x: box.x, y: box.y + box.h },                 // قدام-شمال
      { x: box.x + box.w, y: box.y + box.h },         // قدام-يمين
      { x: box.x + box.w - inset, y: box.y },         // ورا-يمين
      { x: box.x + inset, y: box.y },                 // ورا-شمال
    ],
    approx: true,
  };
}

/**
 * بيبني التحويل من مقاس السطح بالسنتيمتر لأركانه في الصورة.
 *
 * إحداثيات المخطط: x من الشمال لليمين، y من قدام (0) لورا (D).
 * وده بيطابق ترتيب الأركان فوق.
 */
export function surfaceHomography(surface, corners) {
  const W = Number(surface.widthCm);
  const D = Number(surface.depthCm);
  if (!(W > 0) || !(D > 0)) return null;
  const plan = [
    { x: 0, y: 0 },
    { x: W, y: 0 },
    { x: W, y: D },
    { x: 0, y: D },
  ];
  return solveHomography(plan, corners);
}

/**
 * icons.js — أشكال الحاجات، مش مستطيلات.
 *
 * المستطيل الملون بيقول «هنا حاجة عرضها ٥ سم». ده صح، وبرضه مش بيخلّي
 * حد يتخيّل حاجة. الشكل بيخلّيك تبص وتعرف على طول إن دي دباسة ودي مقص،
 * فتقدر تحكم على الترتيب بعينك مش بقراية الأسامي.
 *
 * كل شكل مرسوم جوه مربع الوحدة (0..1) عشان يتمطّط على مساحة الحاجة
 * الحقيقية في الصورة أياً كان مقاسها. البروفايل بيقول الفئة، والاسم
 * بيدقّق أكتر — «دباسة» أدق من «حاجة تانية».
 *
 * دي رسمة توضيحية مش صورة: الشكل تقريبي، لكن **المكان والمقاس محسوبين**.
 */

/**
 * الأشكال. كل واحد `d` لمسار SVG جوه مربع 0..1، و`fill` يقول
 * إذا كان المسار مصمت ولا خطوط.
 */
const SHAPES = {
  stapler: {
    d: 'M.06.62h.88a.05.05 0 0 1 .05.05v.12a.05.05 0 0 1-.05.05H.06a.05.05 0 0 1-.05-.05V.67a.05.05 0 0 1 .05-.05z'
     + 'M.1.36h.66c.05 0 .09.04.09.09v.13H.1a.05.05 0 0 1-.05-.05V.41c0-.03.02-.05.05-.05z'
     + 'M.14.24h.5v.12h-.5z',
    stroke: true,
  },
  pen: {
    d: 'M.4.06h.2v.62H.4z M.4.68h.2L.5.94z M.42.1h.16v.08H.42z',
    stroke: true,
  },
  pens: {
    d: 'M.16.2h.14v.74H.16z M.36.1h.14v.84H.36z M.56.26h.14v.68H.56z M.76.16h.12v.78H.76z',
    stroke: true,
  },
  scissors: {
    d: 'M.3.06 .62.62 M.7.06 .38.62',
    circles: [[0.3, 0.8, 0.13], [0.7, 0.8, 0.13]],
    strokeOnly: true,
  },
  ruler: {
    d: 'M.02.38h.96v.24H.02z M.14.38v.1 M.26.38v.14 M.38.38v.1 M.5.38v.16 M.62.38v.1 M.74.38v.14 M.86.38v.1',
    strokeOnly: true,
  },
  glue: {
    d: 'M.34.3h.32v.64H.34z M.4.14h.2v.16H.4z M.44.04h.12v.1H.44z',
    stroke: true,
  },
  bottle: {
    d: 'M.34.34c0-.1.08-.1.08-.18V.16h.16v.16c0 .08.08.08.08.18v.6H.34z M.44.04h.12v.12H.44z',
    stroke: true,
  },
  mug: {
    d: 'M.18.28h.5v.62c0 .03-.02.04-.04.04H.22c-.02 0-.04-.01-.04-.04z',
    circles: [[0.79, 0.5, 0.13]],
    stroke: true,
  },
  book: {
    d: 'M.08.1h.84v.8H.08z M.22.1v.8 M.3.26h.5 M.3.4h.5 M.3.54h.36',
    strokeOnly: true,
  },
  books: {
    d: 'M.08.1h.2v.8h-.2z M.3.1h.18v.8H.3z M.5.16h.2v.74H.5z M.72.1h.2v.8h-.2z',
    strokeOnly: true,
  },
  phone: {
    d: 'M.28.06h.44a.06.06 0 0 1 .06.06v.76a.06.06 0 0 1-.06.06H.28a.06.06 0 0 1-.06-.06V.12a.06.06 0 0 1 .06-.06z M.42.12h.16',
    strokeOnly: true,
  },
  laptop: {
    d: 'M.16.14h.68v.5H.16z M.06.7h.88l-.06.16H.12z',
    strokeOnly: true,
  },
  monitor: {
    d: 'M.06.1h.88v.56H.06z M.44.66h.12v.16H.44z M.3.86h.4',
    strokeOnly: true,
  },
  keyboard: {
    d: 'M.03.34h.94v.32H.03z M.12.42h.06 M.24.42h.06 M.36.42h.06 M.48.42h.06 M.6.42h.06 M.72.42h.06 M.84.42h.06 M.3.56h.4',
    strokeOnly: true,
  },
  mouse: {
    d: 'M.5.06c.22 0 .32.16.32.4S.72.94.5.94.18.7.18.46.28.06.5.06z M.5.06v.3',
    strokeOnly: true,
  },
  plant: {
    d: 'M.3.6h.4l-.06.34H.36z M.5.6C.5.4.36.3.24.28.28.44.36.56.5.6z M.5.6C.5.38.64.28.76.26.72.44.64.56.5.6z M.5.6V.34',
    strokeOnly: true,
  },
  clothes: {
    d: 'M.34.12 .5.2.66.12l.2.14-.1.16-.1-.06v.5H.34v-.5l-.1.06-.1-.16z',
    stroke: true,
  },
  shoes: {
    d: 'M.08.5h.34c.1 0 .16.1.28.14.14.05.28.06.28.16v.1H.08z',
    stroke: true,
  },
  box: {
    d: 'M.1.28h.8v.62H.1z M.1.28 .5.1.9.28 M.5.1v.8',
    strokeOnly: true,
  },
  headphones: {
    d: 'M.2.6V.5a.3.3 0 0 1 .6 0v.1 M.12.6h.16v.3H.12z M.72.6h.16v.3H.72z',
    strokeOnly: true,
  },
  charger: {
    d: 'M.3.16h.4v.34H.3z M.4.06v.1 M.6.06v.1 M.5.5v.2 M.5.7c-.2 0-.2.24 0 .24',
    strokeOnly: true,
  },
  generic: {
    d: 'M.14.14h.72v.72H.14z',
    strokeOnly: true,
  },
};

/**
 * كلمات بندوّر عليها في اسم الحاجة. الاسم أدق من الفئة:
 * «دباسة» فئتها «حاجة تانية»، لكن اسمها بيقول شكلها بالظبط.
 */
const BY_NAME = [
  [/دباس|stapl/i, 'stapler'],
  [/مقص|scissor/i, 'scissors'],
  [/مسطر|ruler/i, 'ruler'],
  [/صمغ|غرا|glue/i, 'glue'],
  [/أقلام|اقلام|قلم|هايلا|ماركر|pen|pencil|highlight|marker/i, 'pens'],
  [/ازاز|زجاج|مي(ه|ة)|bottle|water/i, 'bottle'],
  [/كوب|مج|فنجان|قهو|شاي|mug|cup|coffee/i, 'mug'],
  [/كتاب|كتب|نوت|دفتر|book|notebook/i, 'books'],
  [/موبايل|تليفون|هاتف|phone/i, 'phone'],
  [/لابتوب|laptop/i, 'laptop'],
  [/شاش|مونيتور|monitor|screen/i, 'monitor'],
  [/كيبورد|لوحة مفاتيح|keyboard/i, 'keyboard'],
  [/ماوس|فار|mouse/i, 'mouse'],
  [/نبت|زرع|plant/i, 'plant'],
  [/هدوم|ملابس|تيشيرت|قميص|cloth|shirt/i, 'clothes'],
  [/جزم|حذاء|شوز|shoe/i, 'shoes'],
  [/سماع|هيدفون|headphone/i, 'headphones'],
  [/شاحن|شاحنة|charger|cable/i, 'charger'],
  [/كرتون|علب|صندوق|box/i, 'box'],
];

/** لو الاسم مقالش، الفئة بتقول. */
const BY_CATEGORY = {
  pens: 'pens', stationery: 'pens', tools: 'scissors',
  drink: 'mug', bottle: 'bottle',
  books: 'books', book: 'books', notebook: 'books',
  phone: 'phone', laptop: 'laptop', monitor: 'monitor',
  keyboard: 'keyboard', mouse: 'mouse',
  plant: 'plant', clothes: 'clothes', shoes: 'shoes',
  headphones: 'headphones', electronics: 'charger',
  storage: 'box', decor: 'plant',
};

/** بيختار شكل الحاجة: الاسم الأول، وبعدين الفئة، وبعدين شكل عام. */
export function shapeFor(item) {
  const name = String(item?.nameAr ?? '');
  for (const [re, key] of BY_NAME) {
    if (re.test(name)) return SHAPES[key];
  }
  const byCat = BY_CATEGORY[item?.category];
  return SHAPES[byCat] || SHAPES.generic;
}

/**
 * بيرسم الشكل جوه رباعي في الصورة.
 *
 * الرباعي مايل بالمنظور، فبنستخدم تحويل خطي بيطابق تلات أركان منه —
 * تقريب كافي بصرياً لحاجة صغيرة على سطح، من غير ما نحتاج تحويل إسقاطي
 * تاني للرسمة نفسها.
 *
 * @param {Array<{x,y}>} quad بالترتيب: قدام-شمال، قدام-يمين، ورا-يمين، ورا-شمال
 */
export function iconSvg(item, quad, color, opts = {}) {
  if (!quad || quad.length !== 4) return '';
  const shape = shapeFor(item);

  // (0,0) للركن الخلفي الشمال، (1,0) للخلفي اليمين، (0,1) للقدامي الشمال
  const o = quad[3], px = quad[2], py = quad[0];
  const a = px.x - o.x, b = px.y - o.y;
  const c = py.x - o.x, d = py.y - o.y;
  if (!Number.isFinite(a + b + c + d)) return '';

  // سُمك الخط لازم يتقاوم التمطيط، وإلا يختفي في الحاجات الصغيرة
  const scale = Math.sqrt(Math.abs(a * d - b * c)) || 1;
  const sw = Math.max(0.012, 2.2 / scale);

  const parts = [];
  if (shape.d) {
    parts.push(`<path d="${shape.d}" fill="${shape.strokeOnly ? 'none' : color}"
      fill-opacity="${shape.strokeOnly ? 0 : 0.55}" stroke="${opts.ink || '#14181d'}"
      stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round" vector-effect="none"/>`);
  }
  for (const [cx, cy, r] of shape.circles || []) {
    parts.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
      stroke="${opts.ink || '#14181d'}" stroke-width="${sw}"/>`);
  }

  return `<g transform="matrix(${a.toFixed(4)} ${b.toFixed(4)} ${c.toFixed(4)} ${d.toFixed(4)} ${o.x.toFixed(2)} ${o.y.toFixed(2)})"
    pointer-events="none">${parts.join('')}</g>`;
}

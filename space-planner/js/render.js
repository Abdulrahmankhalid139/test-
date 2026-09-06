/**
 * render.js — يرسم النتيجة كـ SVG محسوب بالسنتيمتر.
 *
 * ده المخطط "الحقيقي": مرسوم من أرقام الخوارزمية، فمستحيل يهلوس.
 * صورة الـAI بتيجي بعده كتصور تقريبي بس.
 */

import { t } from './i18n.js';

const CATEGORY_COLORS = {
  monitor: '#3b82f6', laptop: '#3b82f6', keyboard: '#6366f1', mouse: '#8b5cf6',
  drink: '#f59e0b', phone: '#10b981', notebook: '#14b8a6', pens: '#14b8a6',
  lamp: '#eab308', speaker: '#a855f7', headphones: '#ec4899',
  plant: '#22c55e', books: '#0ea5e9', storage: '#94a3b8', decor: '#f472b6',
  camera: '#ef4444', electronics: '#3b82f6', glass: '#ef4444', shoes: '#a16207',
  clothes: '#06b6d4', toiletries: '#f97316', book: '#0ea5e9', food: '#84cc16',

  // التسريحة
  mirror: '#38bdf8', dailyMakeup: '#fb7185', makeup: '#f43f5e', brushes: '#f472b6',
  skincare: '#2dd4bf', perfume: '#c084fc', jewelry: '#fbbf24', hairTools: '#f97316',
  tissues: '#94a3b8',

  // المطبخ
  board: '#a16207', knives: '#64748b', spices: '#f59e0b', oils: '#eab308',
  appliance: '#3b82f6', pots: '#94a3b8', utensils: '#14b8a6', dishes: '#0ea5e9',
  produce: '#22c55e',

  // الورشة
  vise: '#475569', workArea: '#a16207', handTools: '#64748b', powerTools: '#8b5cf6',
  fasteners: '#94a3b8', measuring: '#14b8a6', chemicals: '#ef4444',

  // الكومودينو والمذاكرة
  water: '#38bdf8', glasses: '#a855f7', meds: '#ef4444',

  // البروفايل العام
  main: '#3b82f6', daily: '#14b8a6', liquid: '#38bdf8', tall: '#a855f7', rare: '#94a3b8',

  other: '#64748b',
};

export const colorFor = (c) => CATEGORY_COLORS[c] || CATEGORY_COLORS.other;

function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/** بيلاقي أكبر حجم خط يخلي النص يدخل جوه المستطيل. */
function fitLabel(text, boxW, boxD) {
  // الحروف العربية أعرض من اللاتينية، فالمعامل متحفظ عن قصد:
  // لو الاسم مش داخل، أحسن يتكتب فوق المربع من إنه يخرج بره.
  const maxByWidth = (boxW * 1.25) / Math.max(text.length, 1);
  const size = Math.min(4.2, maxByWidth, boxD * 0.5);
  return size < 1.6 ? null : size;
}

/** مخطط المكتب من فوق. الحافة القدامية (ناحيتك) تحت. */
export function renderDeskPlan(layout) {
  const { widthCm: W, depthCm: D, seatXCm } = layout.desk;
  const pad = 12;
  const vbW = W + pad * 2;
  const vbH = D + pad * 2 + 22;

  // بنقلب المحور y: y=0 (قدامك) يبقى تحت في الرسمة
  const ty = (y) => pad + (D - y);
  const parts = [];

  parts.push(`<rect x="${pad}" y="${pad}" width="${W}" height="${D}" rx="2"
    fill="var(--card)" stroke="var(--line)" stroke-width="0.6"/>`);

  // أقواس الوصول من مكان قعدتك
  const sx = pad + seatXCm;
  const sy = ty(-5);
  for (const r of [40, 65]) {
    parts.push(`<circle cx="${sx}" cy="${sy}" r="${r}" fill="none"
      stroke="var(--reach)" stroke-width="0.5" stroke-dasharray="2.5 2" opacity="0.75"/>`);
  }

  for (const it of layout.placed) {
    const c = colorFor(it.category);
    const x = pad + it.x;
    const y = ty(it.y + it.d);
    parts.push(`<rect x="${x}" y="${y}" width="${it.w}" height="${it.d}" rx="1.2"
      fill="${c}" fill-opacity="0.22" stroke="${c}" stroke-width="0.7"/>`);
    const size = fitLabel(it.nameAr, it.w, it.d);
    if (size) {
      parts.push(`<text x="${x + it.w / 2}" y="${y + it.d / 2 + size * 0.35}"
        font-size="${size}" fill="var(--ink)" text-anchor="middle" font-weight="600">${esc(it.nameAr)}</text>`);
    } else {
      // صغيرة أوي على الاسم — نحط الاسم فوقها بخط صغير
      parts.push(`<text x="${x + it.w / 2}" y="${y - 1.2}" font-size="2.8" fill="var(--dim)"
        text-anchor="middle">${esc(it.nameAr)}</text>`);
    }
  }

  // علامة مكان قعدتك
  parts.push(`<path d="M ${sx - 6} ${ty(-2)} a 6 6 0 0 1 12 0" fill="var(--accent)" opacity="0.5"/>`);
  parts.push(`<text x="${sx}" y="${ty(-8)}" font-size="3.6" fill="var(--dim)" text-anchor="middle">انت هنا</text>`);

  // مسطرة العرض
  parts.push(`<line x1="${pad}" y1="${pad - 5}" x2="${pad + W}" y2="${pad - 5}"
    stroke="var(--dim)" stroke-width="0.4"/>
    <text x="${pad + W / 2}" y="${pad - 7}" font-size="3.6" fill="var(--dim)" text-anchor="middle">${Math.round(W)} سم</text>`);

  // العنوان في المنتصف: مع النص العربي، text-anchor="end" بيطلّع النص برة الإطار
  parts.push(`<text x="${pad + W / 2}" y="${pad + D + 17}" font-size="3.2" fill="var(--dim)"
    text-anchor="middle">الدواير = مدى وصول إيدك</text>`);

  return `<svg viewBox="0 0 ${vbW} ${vbH}" xmlns="http://www.w3.org/2000/svg"
    role="img" aria-label="مخطط المكتب من فوق" class="plan-svg">${parts.join('')}</svg>`;
}

/**
 * مخطط الشنطة: طبقة طبقة من تحت لفوق + منظر جانبي.
 * كل طبقة بتتعرض من فوق عشان تعرف ترص إزاي بالظبط.
 */
export function renderBagPlan(bin, placed) {
  const boxed = placed.filter((p) => p.box);
  if (!boxed.length) return '<p class="muted">' + esc(t('nothingPacked')) + '</p>';

  /**
   * الرسم بيتعمل في مساحة موحّدة عرضها ١٠٠ وحدة، مش بالسنتيمتر.
   *
   * السبب: لو رسمنا بالسنتيمتر، حجم الخط بيبقى نسبة من مقاس الحاوية.
   * خط بحجم ٤ جوه شنطة ٥٠ سم صغير ومظبوط، ونفس الخط جوه سلة ١٢ سم
   * بيطلع تلت الصورة وبيخرج بره الإطار. التوحيد بيخلي كل الحاويات
   * تترسم بنفس النِسَب مهما كان مقاسها الحقيقي.
   */
  const K = 100 / Math.max(1, bin.widthCm);
  const u = (cm) => +(cm * K).toFixed(2);
  const W = 100;
  const D = u(bin.depthCm);
  const H = u(bin.heightCm);
  const pad = 5;
  const svgs = [];

  const levels = [...new Set(boxed.map((p) => Math.round(p.box.z)))].sort((a, b) => a - b);

  /** مستطيل حاجة واحدة + اسمها لو الشكل يشيله. */
  const piece = (p, x, y, w, h, faded) => {
    const c = colorFor(p.category);
    if (faded) {
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}"
        rx="1" fill="var(--line)" fill-opacity="0.35" stroke="none"/>`;
    }
    const out = [`<rect x="${x}" y="${y}" width="${w}" height="${h}"
      rx="1.5" fill="${c}" fill-opacity="0.28" stroke="${c}" stroke-width="0.8"/>`];
    const size = fitLabel(p.nameAr, w, h);
    out.push(size
      ? `<text x="${x + w / 2}" y="${y + h / 2 + size * 0.35}" font-size="${size}"
          fill="var(--ink)" text-anchor="middle" font-weight="600">${esc(p.nameAr)}</text>`
      : `<text x="${x + w / 2}" y="${y - 1.4}" font-size="3.4"
          fill="var(--dim)" text-anchor="middle">${esc(p.nameAr)}</text>`);
    if (p.fragile) {
      out.push(`<text x="${x + w - 1}" y="${y + 4.5}" font-size="4" text-anchor="end">⚠</text>`);
    }
    return out.join('');
  };

  levels.forEach((z, i) => {
    const parts = [`<rect x="${pad}" y="${pad}" width="${W}" height="${D}"
      rx="2" fill="var(--card)" stroke="var(--line)" stroke-width="0.7"/>`];

    // الطبقات اللي تحت بتبان باهتة كمرجع
    for (const p of boxed.filter((q) => Math.round(q.box.z) < z)) {
      parts.push(piece(p, pad + u(p.box.x), pad + u(p.box.y), u(p.box.w), u(p.box.d), true));
    }
    for (const p of boxed.filter((q) => Math.round(q.box.z) === z)) {
      parts.push(piece(p, pad + u(p.box.x), pad + u(p.box.y), u(p.box.w), u(p.box.d), false));
    }

    // العنوان بقى HTML مش SVG — النص مابيتمططش مع مقاس الحاوية،
    // وبيتترجم زي أي نص تاني في الصفحة.
    svgs.push(`<figure class="layer">
      <svg viewBox="0 0 ${W + pad * 2} ${D + pad * 2}" xmlns="http://www.w3.org/2000/svg"
        class="plan-svg" role="img" aria-label="${esc(t('layer'))} ${i + 1}">${parts.join('')}</svg>
      <figcaption>${esc(t('layer'))} ${i + 1} — ${esc(t('atHeight'))} ${z} ${esc(t('cm'))}</figcaption>
    </figure>`);
  });

  // منظر جانبي: بيوري التستيف من الجنب
  const sideParts = [`<rect x="${pad}" y="${pad}" width="${W}" height="${H}"
    rx="2" fill="var(--card)" stroke="var(--line)" stroke-width="0.7"/>`];
  for (const p of boxed) {
    // بنقلب المحور الرأسي: القاع في الصورة تحت
    const y = pad + H - u(p.box.z) - u(p.box.h);
    sideParts.push(piece(p, pad + u(p.box.x), y, u(p.box.w), u(p.box.h), false));
  }

  svgs.push(`<figure class="layer">
    <svg viewBox="0 0 ${W + pad * 2} ${H + pad * 2}" xmlns="http://www.w3.org/2000/svg"
      class="plan-svg" role="img" aria-label="${esc(t('sideView'))}">${sideParts.join('')}</svg>
    <figcaption>${esc(t('sideView'))}</figcaption>
  </figure>`);

  return `<div class="layers">${svgs.join('')}</div>`;
}

/** مفتاح الألوان */
export function renderLegend(items) {
  const seen = new Map();
  for (const it of items) if (!seen.has(it.category)) seen.set(it.category, it.nameAr);
  return `<ul class="legend">${[...seen.entries()].map(([cat, name]) =>
    `<li><span class="dot" style="background:${colorFor(cat)}"></span>${esc(name)}</li>`).join('')}</ul>`;
}

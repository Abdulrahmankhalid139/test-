/**
 * overlay.js — المخطط مرسوم على صورتك، مش جنبها.
 *
 * المخطط العادي بيوريك ترتيب من فوق. ده حلو للحساب، وحش للتنفيذ:
 * إنت شايف مكتبك بزاوية، مش من فوق. فبنرسم نفس الأرقام بالظبط
 * لكن بمنظور الصورة — كل حاجة على مكانها الحقيقي على السطح.
 *
 * الأرقام هي هي. اللي اتغير هو نقطة النظر بس.
 */

import { surfaceHomography, projectRect, applyH } from './homography.js';
import { colorFor } from './render.js';

const escSvg = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** مركز رباعي — عشان نحط عليه الاسم والرقم. */
function centroid(quad) {
  return {
    x: quad.reduce((s, p) => s + p.x, 0) / quad.length,
    y: quad.reduce((s, p) => s + p.y, 0) / quad.length,
  };
}

/** أصغر ضلع في الرباعي — بنقيس عليه حجم الخط عشان مايطلعش بره الشكل. */
function shortestSide(quad) {
  let min = Infinity;
  for (let i = 0; i < quad.length; i++) {
    const a = quad[i], b = quad[(i + 1) % quad.length];
    min = Math.min(min, Math.hypot(b.x - a.x, b.y - a.y));
  }
  return min;
}

/**
 * بيرسم الترتيب فوق الصورة.
 *
 * @param {{widthCm:number, depthCm:number}} surface
 * @param {Array} placed الحاجات وأماكنها بالسنتيمتر
 * @param {Array<{x:number,y:number}>} corners أركان السطح في الصورة (0..1)
 * @param {{approx?:boolean, imgW?:number, imgH?:number, selectedId?:string, movedIds?:Array}} opts
 * @returns {{svg:string, projected:Array}|null}
 */
export function renderPhotoOverlay(surface, placed, corners, opts = {}) {
  const H = surfaceHomography(surface, corners);
  if (!H) return null;

  const W = opts.imgW || 1000;
  const Hgt = opts.imgH || 750;
  const px = (p) => ({ x: p.x * W, y: p.y * Hgt });
  const selected = opts.selectedId;
  const moved = new Set(opts.movedIds || []);

  // حدود السطح نفسه — بيوري المستخدم إحنا فاهمين السطح فين
  const frame = [
    applyH(H, 0, 0), applyH(H, surface.widthCm, 0),
    applyH(H, surface.widthCm, surface.depthCm), applyH(H, 0, surface.depthCm),
  ];
  if (frame.some((p) => !p)) return null;
  const framePts = frame.map(px).map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  const projected = [];
  const shapes = [];

  // الحاجات البعيدة تترسم الأول عشان القريبة تغطيها — نفس ترتيب العين
  const order = [...placed].sort((a, b) => (b.y + b.d / 2) - (a.y + a.d / 2));

  for (const it of order) {
    const quad = projectRect(H, it.x, it.y, it.w ?? it.widthCm, it.d ?? it.depthCm);
    if (!quad) continue;

    const pts = quad.map(px);
    projected.push({ id: it.id, quad: pts });

    const poly = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const c = centroid(pts);
    const side = shortestSide(pts);
    const fill = colorFor(it.category);
    const isSel = it.id === selected;
    const isMoved = moved.has(it.id);

    shapes.push(`<polygon points="${poly}" fill="${fill}" fill-opacity="${isSel ? 0.72 : 0.5}"
      stroke="${isSel ? '#ffffff' : isMoved ? '#c2571a' : '#14181d'}"
      stroke-width="${isSel ? 4 : isMoved ? 3 : 1.5}"
      stroke-dasharray="${isMoved && !isSel ? '7 4' : ''}"
      data-id="${escSvg(it.id)}" class="ov-item${isSel ? ' sel' : ''}"/>`);

    // الاسم بيتكتب بس لو الشكل واسع كفاية يشيله
    if (side > 26) {
      const fs = Math.max(11, Math.min(18, side * 0.3));
      shapes.push(`<text x="${c.x.toFixed(1)}" y="${(c.y + fs * 0.35).toFixed(1)}"
        text-anchor="middle" font-size="${fs.toFixed(0)}" font-weight="700"
        fill="#ffffff" stroke="#14181d" stroke-width="3" paint-order="stroke"
        pointer-events="none">${escSvg(it.nameAr)}</text>`);
    }
  }

  const svg = `<svg viewBox="0 0 ${W} ${Hgt}" class="overlay-svg" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
  <polygon points="${framePts}" fill="none" stroke="#0d6e63" stroke-width="3" stroke-dasharray="10 6" opacity="${opts.approx ? 0.55 : 0.9}"/>
  ${shapes.join('\n  ')}
</svg>`;

  return { svg, projected, homography: H };
}

/**
 * بيرجّع نقطة من الصورة لإحداثيات السطح بالسنتيمتر — عكس التحويل.
 *
 * ده اللي بيخلي السحب بالصباع على الصورة يتحول لمكان حقيقي على المكتب،
 * فالمستخدم بيحرك الحاجة في الصورة والخوارزمية بتقيّم النقلة بالسنتيمتر.
 */
export function imageToPlan(H, u, v) {
  // بنحل نظام معادلتين: النقطة (x,y) اللي بتتصور على (u,v)
  const [a, b, c, d, e, f, g, h, i] = H;
  const A = [
    [a - u * g, b - u * h],
    [d - v * g, e - v * h],
  ];
  const B = [u * i - c, v * i - f];
  const det = A[0][0] * A[1][1] - A[0][1] * A[1][0];
  if (Math.abs(det) < 1e-9) return null;
  return {
    x: (B[0] * A[1][1] - A[0][1] * B[1]) / det,
    y: (A[0][0] * B[1] - B[0] * A[1][0]) / det,
  };
}

/** الحاجة اللي المستخدم دوس عليها في الصورة. */
export function hitTest(projected, x, y) {
  // من الآخر للأول: اللي اترسم فوق هو اللي المستخدم شايفه
  for (let i = projected.length - 1; i >= 0; i--) {
    if (pointInQuad(projected[i].quad, x, y)) return projected[i].id;
  }
  return null;
}

function pointInQuad(quad, x, y) {
  let inside = false;
  for (let i = 0, j = quad.length - 1; i < quad.length; j = i++) {
    const a = quad[i], b = quad[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

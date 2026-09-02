/**
 * edit.js — تعديل الترتيب بإيدك، والحكم عليه بنفس مسطرة الخوارزمية.
 *
 * الفكرة: الخوارزمية بتطلع أحسن ترتيب حسب قواعدها، بس القواعد مش عارفة
 * كل حاجة عنك. فالمستخدم لازم يقدر يقول «لأ، الكوباية دي مكانها هنا»
 * ويشوف بنفسه التعديل ده كلّفه إيه.
 *
 * اللي بيخلي ده مفيد مش إنك تقدر تحرك — ده إن كل حركة بتترد عليها
 * بـرقم من نفس دالة التكلفة اللي الخوارزمية اشتغلت بيها. يعني
 * «أحسن ولا أوحش» إجابة محسوبة، مش رأي.
 *
 * الحالة كلها هنا نقية: بتاخد ترتيب وترجّع ترتيب جديد. مفيش DOM.
 */

import { scoreLayout, layoutContext, isLegalSpot } from './surface.js';

/** حالة جديدة للتعديل — بنحتفظ بالأصل عشان «رجّع زي ما كان» يفضل ممكن. */
export function startEditing(layout, surface, profile, opts = {}) {
  const base = layout.placed.map((p) => ({ ...p }));
  return {
    surface, profile, opts,
    original: base.map((p) => ({ ...p })),
    placed: base,
    baseScore: scoreLayout(surface, base, profile, opts),
    selectedId: null,
    movedIds: new Set(),
    history: [],
  };
}

/** بيختار حاجة أو بيلغي الاختيار لو نفسها. */
export function select(st, id) {
  return { ...st, selectedId: st.selectedId === id ? null : id };
}

/**
 * بيحرك حاجة لمكان جديد بالسنتيمتر.
 * بيرجّع الحالة الجديدة مع حكم على النقلة — حتى لو المكان ممنوع،
 * عشان المستخدم يعرف ليه بدل ما الحاجة ترفض تتحرك من غير سبب.
 */
export function moveTo(st, id, xCm, yCm) {
  const item = st.placed.find((p) => p.id === id);
  if (!item) return { st, ok: false, reason: 'notFound' };

  const x = clampCm2(snapHalfCm(xCm), 0, st.surface.widthCm - item.w);
  const y = clampCm2(snapHalfCm(yCm), 0, st.surface.depthCm - item.d);
  if (x === item.x && y === item.y) return { st, ok: true, unchanged: true };

  const next = st.placed.map((p) => (p.id === id ? { ...p, x, y } : p));
  return commit(st, next, [id], { from: { x: item.x, y: item.y } });
}

/**
 * بيبدّل مكان حاجتين.
 *
 * التبديل مش مجرد تبديل إحداثيات: الحاجتين مقاسهم مختلف، فبنحط كل واحدة
 * في **مركز** مكان التانية، وبعدين نتأكد إن الاتنين لسه جوه السطح.
 * كده الكوباية الصغيرة مبتقعش على حرف مكان اللابتوب.
 */
export function swap(st, idA, idB) {
  const a = st.placed.find((p) => p.id === idA);
  const b = st.placed.find((p) => p.id === idB);
  if (!a || !b || idA === idB) return { st, ok: false, reason: 'notFound' };

  const centreA = { x: a.x + a.w / 2, y: a.y + a.d / 2 };
  const centreB = { x: b.x + b.w / 2, y: b.y + b.d / 2 };

  const newA = {
    x: clampCm2(snapHalfCm(centreB.x - a.w / 2), 0, st.surface.widthCm - a.w),
    y: clampCm2(snapHalfCm(centreB.y - a.d / 2), 0, st.surface.depthCm - a.d),
  };
  const newB = {
    x: clampCm2(snapHalfCm(centreA.x - b.w / 2), 0, st.surface.widthCm - b.w),
    y: clampCm2(snapHalfCm(centreA.y - b.d / 2), 0, st.surface.depthCm - b.d),
  };

  const next = st.placed.map((p) => {
    if (p.id === idA) return { ...p, ...newA };
    if (p.id === idB) return { ...p, ...newB };
    return p;
  });
  return commit(st, next, [idA, idB], { swapped: true });
}

/**
 * بيطبّق الترتيب الجديد ويحكم عليه.
 *
 * الحكم بيرجع بجزئين مختلفين عن قصد:
 *   - `legal`: هل ده ممكن فيزيائياً أصلاً (متداخل؟ حاجب الشاشة؟)
 *   - `delta`: أحسن ولا أوحش، بنفس دالة تكلفة الخوارزمية
 * حاجة ممكن تكون مسموحة وأوحش — وده قرارك إنت، مش قرارها.
 */
function commit(st, next, touched, meta = {}) {
  const score = scoreLayout(st.surface, next, st.profile, st.opts);
  const ctx = layoutContext(st.surface, st.profile, st.opts, next);
  const cats = st.profile.categories || {};

  const problems = [];
  for (const id of touched) {
    const p = next.find((x) => x.id === id);
    if (!p) continue;
    const rule = cats[p.category] || cats.other || { zone: 'secondary', side: 'any' };
    if (!isLegalSpot({ x: p.x, y: p.y, w: p.w, d: p.d }, p, rule, ctx, null, p.id)) {
      problems.push({ id, nameAr: p.nameAr, why: whyIllegal(p, next, ctx, cats) });
    }
  }

  const moved = new Set(st.movedIds);
  for (const id of touched) moved.add(id);

  const nextSt = {
    ...st,
    placed: next,
    movedIds: moved,
    history: [...st.history, { placed: st.placed, movedIds: new Set(st.movedIds) }].slice(-30),
  };

  return {
    st: nextSt,
    ok: true,
    legal: problems.length === 0,
    problems,
    score,
    delta: score.total - st.baseScore.total,
    reachDelta: score.reachTotalCm - st.baseScore.reachTotalCm,
    ...meta,
  };
}

/** ليه المكان ده ممنوع — بنقول السبب بالاسم بدل «مينفعش». */
function whyIllegal(p, placed, ctx, cats) {
  const box = { x: p.x, y: p.y, w: p.w, d: p.d };
  const hits = placed.filter((o) => o.id !== p.id && overlaps(box, o));
  if (hits.length) return { key: 'e_overlaps', params: { what: hits[0].nameAr } };
  if (p.y < 4) return { key: 'e_edge' };
  const back = placed.find((o) => cats[o.category]?.anchor === 'back-center' && o.id !== p.id);
  if (back && p.h > 12 && p.y + p.d > back.y - 12) return { key: 'e_blocks', params: { what: back.nameAr } };
  return { key: 'e_noRoom' };
}

function overlaps(a, b, pad = 1) {
  return a.x < b.x + b.w + pad && a.x + a.w + pad > b.x
      && a.y < b.y + b.d + pad && a.y + a.d + pad > b.y;
}

/** رجّع آخر خطوة. */
export function undo(st) {
  if (!st.history.length) return st;
  const last = st.history[st.history.length - 1];
  return { ...st, placed: last.placed, movedIds: last.movedIds, history: st.history.slice(0, -1) };
}

/** رجّع كل حاجة لترتيب الخوارزمية. */
export function reset(st) {
  return {
    ...st,
    placed: st.original.map((p) => ({ ...p })),
    movedIds: new Set(),
    history: [],
    selectedId: null,
  };
}

/**
 * الحكم النهائي على الترتيب الحالي كله مقارنة بالأصلي.
 *
 * العتبة ٣ نقط مش صفر: فروق أصغر من كده جاية من التقريب لأقرب سنتيمتر،
 * ومش هتفرق معاك في الواقع. أوعدك بفرق حقيقي بس.
 */
export function verdict(st) {
  const score = scoreLayout(st.surface, st.placed, st.profile, st.opts);
  const delta = score.total - st.baseScore.total;
  const reachDelta = score.reachTotalCm - st.baseScore.reachTotalCm;
  return {
    changed: st.movedIds.size > 0,
    illegal: score.illegal,
    delta: Math.round(delta),
    reachDelta: Math.round(reachDelta),
    direction: Math.abs(delta) < 3 ? 'same' : delta < 0 ? 'better' : 'worse',
    score,
  };
}

// أسماء مميزة عن surface.js — الباندل بيدمج كل الموديولات في نطاق واحد
const snapHalfCm = (n) => Math.round(n * 2) / 2;
const clampCm2 = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

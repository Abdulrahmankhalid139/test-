/**
 * multispace.js — مساحات بتعرف بعضها.
 *
 * المشكلة اللي بيحلها: لما حاجة تتشال من على المكتب، بتروح فين؟
 * لحد دلوقتي الإجابة كانت «برّه» — كلمة مالهاش معنى في الواقع.
 * الحاجة مش بتختفي، بتروح الدرج اللي تحت المكتب أو الرف اللي فوقه.
 *
 * فبدل السؤال «تتحط فين على السطح ده؟» بقى السؤال «تتحط على أنهي سطح؟».
 *
 * الترتيب: المساحة الأساسية بتترتب الأول، واللي بيفيض بيتوزّع على
 * المساحات التانية بالترتيب اللي المستخدم حاطهم بيه — الأقرب الأول.
 * كل مساحة بتشتغل بخوارزميتها هي: الأسطح بـlayoutSurface، والحاويات بـpack3D.
 */

import { layoutSurface } from './surface.js';
import { pack3D, packingOrder } from './packing.js';
import { isContainer } from './profiles.js';

/**
 * @param {Array<{id, name, profile, size, opts}>} spaces
 *        الأولى هي الأساسية. size = {widthCm, depthCm, heightCm}
 * @param {Array} items كل الحاجات
 * @returns {{plans:Array, homeless:Array, moves:Array}}
 */
export function planSpaces(spaces, items, globalOpts = {}) {
  if (!spaces.length) return { plans: [], homeless: items, moves: [] };

  const plans = [];
  const moves = [];
  let pending = items.filter((i) => i.widthCm > 0 && i.depthCm > 0 && i.heightCm > 0);

  for (let i = 0; i < spaces.length; i++) {
    const space = spaces[i];
    const isLast = i === spaces.length - 1;
    const container = isContainer(space.profile);

    // آخر مساحة بتاخد كل اللي فاضل — مفيش مكان تاني ترميه فيه
    const forThis = pending;
    if (!forThis.length) {
      plans.push({ space, kind: container ? 'container' : 'surface', plan: null, empty: true });
      continue;
    }

    if (container) {
      const prepared = forThis.map((it) => {
        const meta = space.profile.categories[it.category] || {};
        return {
          ...it,
          keepUpright: !!meta.keepUpright,
          fragile: it.fragile || !!meta.fragile,
          compressible: !!meta.compressible,
        };
      });
      const bin = {
        widthCm: space.size.widthCm,
        depthCm: space.size.depthCm,
        heightCm: space.size.heightCm,
        maxWeightKg: space.size.maxWeightKg || 0,
      };
      const res = pack3D(bin, prepared);
      plans.push({
        space, kind: 'container', bin,
        plan: { ...res, steps: packingOrder(res.placed) },
      });
      for (const p of res.placed) moves.push({ itemId: p.id, spaceId: space.id, spaceName: space.name });
      pending = (res.unplaced || []).map(stripPacking);
    } else {
      const res = layoutSurface(space.size, forThis, space.profile, { ...globalOpts, ...space.opts });
      plans.push({ space, kind: 'surface', plan: res });
      for (const p of res.placed) moves.push({ itemId: p.id, spaceId: space.id, spaceName: space.name });
      pending = res.offDesk.map(stripLayout);
    }

    // آخر مساحة وفيه لسه فاضل؟ منكدبش — بنقول مالقاش مكان
    if (isLast) break;
  }

  return { plans, homeless: pending, moves };
}

/** الحاجة اللي اترفضت من الرص بترجع لشكلها الأصلي عشان المساحة اللي بعدها. */
function stripPacking(r) {
  const it = r.item || r;
  return {
    id: it.id, nameAr: it.nameAr, category: it.category,
    widthCm: it.widthCm ?? it.w, depthCm: it.depthCm ?? it.d, heightCm: it.heightCm ?? it.h,
    frequency: it.frequency, fragile: it.fragile,
    rejectedFrom: r.reason || null,
  };
}

function stripLayout(o) {
  return {
    id: o.id, nameAr: o.nameAr, category: o.category,
    widthCm: o.widthCm ?? o.w, depthCm: o.depthCm ?? o.d, heightCm: o.heightCm ?? o.h,
    frequency: o.frequency, fragile: o.fragile,
    rejectedFrom: o.reason || null,
  };
}

/**
 * بيقترح المساحات المكمّلة للمساحة الأساسية.
 *
 * مش كل مساحة ينفع تبقى «تحت» أي مساحة: الدرج بيروح تحت المكتب،
 * والرف بيروح فوقه، والكرتونة مبتروحش تحت التسريحة.
 * الاقتراحات دي بتتعرض للمستخدم يختار منها، مش بتتفرض عليه.
 */
export const COMPANION_SUGGESTIONS = {
  desk:      ['drawer', 'shelf'],
  dresser:   ['drawer', 'shelf'],
  study:     ['drawer', 'shelf'],
  workbench: ['drawer', 'shelf', 'movingBox'],
  kitchen:   ['drawer', 'shelf', 'fridge'],
  bedside:   ['drawer'],
};

/**
 * بيحسب كام حاجة اتحركت من مساحة لمساحة — الرقم اللي بيقول
 * هل ضم المساحات التانية عمل فرق ولا لأ.
 */
export function moveSummary(result, primaryId) {
  const byspace = new Map();
  for (const m of result.moves) {
    if (m.spaceId === primaryId) continue;
    if (!byspace.has(m.spaceId)) byspace.set(m.spaceId, { name: m.spaceName, ids: [] });
    byspace.get(m.spaceId).ids.push(m.itemId);
  }
  return {
    relocated: [...byspace.values()],
    homelessCount: result.homeless.length,
  };
}

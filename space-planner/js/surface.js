/**
 * surface.js — بيرتّب أي سطح حسب بروفايله.
 *
 * الملف ده مبيعرفش إيه هو المكتب ولا التسريحة ولا المطبخ.
 * هو بس بيعرف يحط مستطيلات على سطح بحيث:
 *   - متتداخلش ومتقعش من على الحرف
 *   - كل حاجة تبقى في المنطقة اللي البروفايل حددها
 *   - القيود الفيزيائية تتحترم (سوايل، ضل، إضاءة، خط النظر)
 *
 * القواعد نفسها بتيجي من البروفايل — سواء مكتوب جاهز أو الموديل ولّده.
 */

import { ZONES } from './profiles.js';

const GRID = 2;                 // دقة البحث بالسنتيمتر
const FRONT_WORK_GAP = 10;      // مساحة الرسغين/الشغل قدام المرساة القدامية
const EDGE_MARGIN = 4;          // هامش أمان من حافة السطح
const BULKY_AREA_CM2 = 600;     // أكبر من كده ونادر الاستخدام = يتشال
const HOT_CLEARANCE = 5;        // خلوص حوالين الحاجات السخنة

/**
 * السياق اللي دالة التكلفة بتشتغل جواه — السطح، القواعد، مكان القاعد، الضو.
 * بيتبني مرة واحدة وبيتمرر لكل تقييم، عشان الترتيب المحسوب والترتيب اللي
 * المستخدم عدّله بإيده يتقاسوا بنفس المسطرة بالظبط.
 */
export function layoutContext(surface, profile, opts = {}, placed = []) {
  const W = surface.widthCm;
  const D = surface.depthCm;
  const dominant = opts.dominantHand === 'left' ? 'left' : 'right';
  const seatX = Number.isFinite(opts.seatXCm) ? opts.seatXCm : W / 2;
  return {
    W, D, dominant, seatX,
    placed,
    reachOrigin: { x: seatX, y: -5 },
    light: lightVector(opts.windowSide || 'none', W, D),
    cats: profile.categories || {},
  };
}

/** اتجاه الضو على السطح حسب مكان الشباك بالنسبة للشخص. */
function lightVector(windowSide, W, D) {
  switch (windowSide) {
    case 'left':  return { x: 0, y: D / 2 };
    case 'right': return { x: W, y: D / 2 };
    case 'front': return { x: W / 2, y: D };   // الشباك ورا السطح
    case 'back':  return { x: W / 2, y: 0 };   // الشباك ورا ضهرك
    default:      return null;
  }
}

function rectsOverlap(a, b, pad = 1) {
  return (
    a.x < b.x + b.w + pad && a.x + a.w + pad > b.x &&
    a.y < b.y + b.d + pad && a.y + a.d + pad > b.y
  );
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * @param {{widthCm:number, depthCm:number}} surface
 * @param {Array} items [{id,nameAr,category,widthCm,depthCm,heightCm,frequency}]
 * @param {Object} profile من profiles.js أو مولّد بالـAI
 * @param {{dominantHand, windowSide, seatXCm}} opts
 */
export function layoutSurface(surface, items, profile, opts = {}) {
  const W = surface.widthCm;
  const D = surface.depthCm;
  const dominant = opts.dominantHand === 'left' ? 'left' : 'right';
  const HAND = dominant;
  const windowSide = opts.windowSide || 'none';
  const seatX = Number.isFinite(opts.seatXCm) ? opts.seatXCm : W / 2;
  const reachOrigin = { x: seatX, y: -5 };
  const light = lightVector(windowSide, W, D);
  const cats = profile.categories || {};
  const ruleFor = (c) => cats[c] || cats.other || { zone: 'secondary', side: 'any' };

  const placed = [];
  const offDesk = [];
  const notes = [];

  const norm = items
    .map((it) => ({
      ...it,
      w: Number(it.widthCm) || 0,
      d: Number(it.depthCm) || 0,
      h: Number(it.heightCm) || 0,
      category: cats[it.category] ? it.category : 'other',
      frequency: it.frequency || 'medium',
    }))
    .filter((it) => it.w > 0 && it.d > 0);

  // ١) المراسي: البروفايل هو اللي بيقول مين المرساة، مش الكود
  const anchorOf = (slot) => norm.find((i) => cats[i.category]?.anchor === slot);
  const backCenter = anchorOf('back-center');
  const frontCenter = anchorOf('front-center');
  const frontDominant = anchorOf('front-dominant');

  if (backCenter) {
    const y = Math.max(0, D - backCenter.d - 2);
    const x = clamp(seatX - backCenter.w / 2, 0, W - backCenter.w);
    placed.push({ ...backCenter, x, y, rotated: false, reason: [{ key: 'r_anchorBack' }] });

    if (cats[backCenter.category]?.screen) {
      const viewDistance = y - reachOrigin.y;
      if (viewDistance < 50) {
        notes.push({
          level: 'warn',
          text: { key: 'n_viewDistance', params: { n: Math.round(viewDistance) } },
        });
      }
      if (backCenter.category === 'laptop') {
        notes.push({
          level: 'tip',
          text: { key: 'n_laptop' },
        });
      }
    }
  }

  if (frontCenter) {
    const x = clamp(seatX - frontCenter.w / 2, 0, W - frontCenter.w);
    placed.push({ ...frontCenter, x, y: FRONT_WORK_GAP, rotated: false, reason: [{ key: 'r_anchorFront' }] });
  }

  if (frontDominant) {
    const fc = placed.find((p) => p.id === frontCenter?.id);
    const y = fc ? fc.y : FRONT_WORK_GAP;
    const x = dominant === 'right'
      ? clamp((fc ? fc.x + fc.w : seatX + 10) + 3, 0, W - frontDominant.w)
      : clamp((fc ? fc.x : seatX - 10) - frontDominant.w - 3, 0, W - frontDominant.w);
    placed.push({ ...frontDominant, x, y, rotated: false, reason: [{ key: 'r_anchorSide', params: { hand: HAND } }] });
  }

  // ٢) الباقي: بحث على شبكة بدالة تكلفة
  const rest = norm.filter((i) => !placed.some((p) => p.id === i.id));
  const freqRank = { high: 0, medium: 1, low: 2 };
  rest.sort((a, b) => (freqRank[a.frequency] ?? 1) - (freqRank[b.frequency] ?? 1));

  for (const item of rest) {
    if (item.frequency === 'low' && item.w * item.d > BULKY_AREA_CM2) {
      offDesk.push({
        ...item,
        reason: [{ key: 'off_bulky', params: { n: Math.round(item.w * item.d) } }],
      });
      continue;
    }
    const rule = ruleFor(item.category);
    const spot = findSpot(item, rule, { W, D, placed, reachOrigin, dominant, light, cats, seatX });
    if (spot) {
      placed.push({ ...item, x: spot.x, y: spot.y, w: spot.w, d: spot.d, rotated: spot.rotated, reason: spot.reason });
    } else {
      offDesk.push({
        ...item,
        reason: [{ key: item.frequency === 'low' ? 'off_rare' : 'off_noRoom' }],
      });
    }
  }

  notes.push(...physicalNotes({ surface, windowSide, dominant, placed, offDesk, cats }));
  for (const tip of profile.tipsAr || []) notes.push({ level: 'tip', text: tip });

  const usedArea = placed.reduce((s, p) => s + p.w * p.d, 0);
  return {
    desk: { widthCm: W, depthCm: D, seatXCm: seatX },
    profileName: profile.spaceTypeAr,
    placed,
    offDesk,
    notes,
    stats: {
      surfaceAreaCm2: Math.round(W * D),
      usedAreaCm2: Math.round(usedArea),
      freePercent: Math.round(100 - (usedArea / (W * D)) * 100),
      onDesk: placed.length,
      removed: offDesk.length,
    },
  };
}

/**
 * هل المكان ده مسموح أصلاً؟ (متداخلش، مش على الحرف، مش حاجب المرساة)
 * منفصلة عن التكلفة عشان التعديل اليدوي يقدر يقول «ده مستحيل» بدل ما يديله رقم وحش.
 * `ignoreId` بيخلي الحاجة نفسها متزحمش نفسها وهي بتتحرك.
 */
export function isLegalSpot(cand, item, rule, ctx, selfPad = null, ignoreId = null) {
  const { D, placed, cats } = ctx;
  const pad = selfPad ?? (rule.hot ? HOT_CLEARANCE : 1);
  const frontAnchor = placed.find((p) => cats[p.category]?.anchor === 'front-center' && p.id !== ignoreId);
  const backAnchor = placed.find((p) => cats[p.category]?.anchor === 'back-center' && p.id !== ignoreId);

  if (cand.y < EDGE_MARGIN) return false;
  if (cand.x < 0 || cand.y < 0 || cand.x + cand.w > ctx.W || cand.y + cand.d > D) return false;

  const blocked = placed.some((p) => {
    if (p.id === ignoreId) return false;
    const other = Math.max(pad, cats[p.category]?.hot ? HOT_CLEARANCE : 1);
    return rectsOverlap(cand, { x: p.x, y: p.y, w: p.w, d: p.d }, other);
  });
  if (blocked) return false;

  // مساحة الشغل قدام المرساة القدامية تفضل فاضية
  if (frontAnchor && cand.y < frontAnchor.y &&
      rectsOverlap(cand, { x: frontAnchor.x - 4, y: 0, w: frontAnchor.w + 8, d: frontAnchor.y }, 0)) return false;

  // الحاجات العالية ممنوعة تحجب المرساة الخلفية (شاشة/مراية)
  if (backAnchor && item.h > 12 && cand.y + cand.d > backAnchor.y - 12 &&
      rectsOverlap(cand, { x: backAnchor.x - 5, y: 0, w: backAnchor.w + 10, d: backAnchor.y }, 0)) return false;

  return true;
}

/**
 * تكلفة مكان واحد. الرقم ده هو كل «الرأي» اللي عند الخوارزمية:
 * بُعد عن منطقة الوصول، ناحية الإيد، أمان السوايل، الضو، والعمق.
 * أقل = أحسن. مفيش وحدة — بس ثابت، فالمقارنة بين ترتيبين ليها معنى.
 */
export function spotCost(cand, rule, ctx, target = null) {
  const { D, placed, reachOrigin, dominant, light, cats } = ctx;
  const tgt = target ?? (ZONES[rule.zone]?.targetCm ?? ZONES.secondary.targetCm);
  const frontAnchor = placed.find((p) => cats[p.category]?.anchor === 'front-center');

  const cx = cand.x + cand.w / 2;
  const cy = cand.y + cand.d / 2;
  const dist = Math.hypot(cx - reachOrigin.x, cy - reachOrigin.y);

  let cost = Math.abs(dist - tgt);

  const isDominantSide = dominant === 'right' ? cx > reachOrigin.x : cx < reachOrigin.x;
  if (rule.side === 'dominant' && !isDominantSide) cost += 22;
  if (rule.side === 'off' && isDominantSide) cost += 22;
  if (rule.side === 'center') cost += Math.abs(cx - reachOrigin.x) * 0.8;

  // سوايل: بعيد عن أي حاجة تتلف لو اتكبت
  if (rule.keepDry) {
    if (frontAnchor && cand.y < frontAnchor.y + frontAnchor.d + 6) cost += 30;
    for (const e of placed) {
      if (!cats[e.category]?.screen && !cats[e.category]?.anchor) continue;
      const gap = Math.hypot(cx - (e.x + e.w / 2), cy - (e.y + e.d / 2));
      if (gap < 25) cost += (25 - gap) * 1.2;
    }
  }

  // الإضاءة: فيه حاجات بتبوظ في الشمس وفيه حاجات عايزاها
  if (light) {
    const toLight = Math.hypot(cx - light.x, cy - light.y);
    if (rule.avoidLight) cost += Math.max(0, 70 - toLight) * 0.6;
    if (rule.wantsLight) cost += toLight * 0.4;
  }

  if (rule.zone === 'far') cost += (D - (cand.y + cand.d)) * 0.5;

  return { cost, dist };
}

function findSpot(item, rule, ctx) {
  const { W, D, dominant } = ctx;
  const target = ZONES[rule.zone]?.targetCm ?? ZONES.secondary.targetCm;
  const selfPad = rule.hot ? HOT_CLEARANCE : 1;
  let best = null;

  // الحاجات العالية (شاشة، أباجورة، نبتة) مبتتقلبش على جنبها —
  // اللف في المخطط معناه إنها اتحطت بالعرض، وده مالوش معنى لحاجة واقفة.
  const variants = [{ w: item.w, d: item.d, rotated: false }];
  if (!rule.tall && item.h <= 15 && Math.abs(item.w - item.d) > 2) {
    variants.push({ w: item.d, d: item.w, rotated: true });
  }

  for (const v of variants) {
    for (let x = 0; x <= W - v.w; x += GRID) {
      for (let y = 0; y <= D - v.d; y += GRID) {
        const cand = { x, y, w: v.w, d: v.d };
        if (!isLegalSpot(cand, item, rule, ctx, selfPad)) continue;
        const ev = spotCost(cand, rule, ctx, target);
        if (!best || ev.cost < best.cost) best = { ...cand, rotated: v.rotated, cost: ev.cost, dist: ev.dist };
      }
    }
  }

  if (!best) return null;
  if (best.cost > 60 && item.frequency === 'low') return null;

  best.reason = describeReason(rule, best, dominant);
  return best;
}

/**
 * التعليل بيترجع كأجزاء {key, params} مش كجملة جاهزة —
 * عشان تبديل اللغة يترجم النتيجة من غير ما نعيد الحساب.
 */
function describeReason(rule, spot, dominant) {
  const parts = [{ key: 'zone_' + rule.zone }];
  const HAND = dominant === 'right' ? 'right' : 'left';
  const OFF = dominant === 'right' ? 'left' : 'right';
  if (rule.side === 'dominant') parts.push({ key: 'r_sideDominant', params: { hand: HAND } });
  else if (rule.side === 'off') parts.push({ key: 'r_sideOff', params: { hand: OFF } });
  if (rule.keepDry) parts.push({ key: 'r_keepDry' });
  if (rule.avoidLight) parts.push({ key: 'r_avoidLight' });
  if (rule.wantsLight) parts.push({ key: 'r_wantsLight' });
  if (rule.hot) parts.push({ key: 'r_hot' });
  parts.push({ key: 'r_distance', params: { n: Math.round(spot.dist) } });
  return parts;
}

/** ملاحظات فيزيائية عامة — بتنطبق على أي مساحة مهما كان نوعها. */
function physicalNotes({ surface, windowSide, dominant, placed, offDesk, cats }) {
  const out = [];
  const hasScreen = placed.some((p) => cats[p.category]?.screen);

  if (windowSide === 'back' && hasScreen) {
    out.push({ level: 'warn', text: { key: 'n_windowBack' } });
  } else if (windowSide === 'front' && hasScreen) {
    out.push({ level: 'warn', text: { key: 'n_windowFront' } });
  } else if (windowSide === 'left' || windowSide === 'right') {
    out.push({ level: 'ok', text: { key: 'n_windowSide' } });
  }

  const lamp = placed.find((p) => /lamp|إضاءة|أباجورة/i.test(p.category + p.nameAr));
  if (lamp) {
    const onDominant = dominant === 'right'
      ? lamp.x + lamp.w / 2 > surface.widthCm / 2
      : lamp.x + lamp.w / 2 < surface.widthCm / 2;
    if (!onDominant) {
      out.push({ level: 'ok', text: { key: 'n_lamp', params: { hand: dominant === 'right' ? 'left' : 'right' } } });
    }
  }

  if (placed.some((p) => cats[p.category]?.keepDry)) {
    out.push({ level: 'tip', text: { key: 'n_liquids' } });
  }

  if (placed.some((p) => cats[p.category]?.hot)) {
    out.push({ level: 'tip', text: { key: 'n_hot' } });
  }

  if (offDesk.length) {
    out.push({ level: 'tip', text: { key: 'n_removed', params: { n: offDesk.length } } });
  }

  return out;
}

/**
 * بيقيس ترتيب جاهز — سواء اللي الخوارزمية طلعته أو اللي المستخدم عدّله بإيده.
 *
 * ده مش تقييم تاني منفصل: بيستخدم نفس دالة التكلفة اللي البحث نفسه بيستخدمها.
 * عشان كده «أحسن ولا أوحش» بيبقى إجابة حقيقية مش إحساس — الرقم اللي طلع
 * الترتيب الأصلي هو نفس الرقم اللي بيتقاس بيه تعديلك.
 *
 * @returns {{total:number, perItem:Array, illegal:Array, reachTotalCm:number}}
 */
export function scoreLayout(surface, placed, profile, opts = {}) {
  const ctx = layoutContext(surface, profile, opts, placed);
  const cats = profile.categories || {};
  const ruleFor = (c) => cats[c] || cats.other || { zone: 'secondary', side: 'any' };

  const perItem = [];
  const illegal = [];
  let total = 0;
  let reachTotalCm = 0;

  for (const p of placed) {
    const rule = ruleFor(p.category);
    const box = { x: p.x, y: p.y, w: p.w, d: p.d };
    const ev = spotCost(box, rule, ctx);
    perItem.push({ id: p.id, cost: ev.cost, distCm: ev.dist });
    total += ev.cost;

    // الوصول المرجّح بالاستخدام: حاجة بتمد إيدك لها كتير وهي بعيدة أغلى من نادرة بعيدة
    const weight = p.frequency === 'high' ? 3 : p.frequency === 'low' ? 0.5 : 1;
    reachTotalCm += ev.dist * weight;

    if (!isLegalSpot(box, p, rule, ctx, null, p.id)) illegal.push(p.id);
  }

  return {
    total: Math.round(total),
    perItem,
    illegal,
    reachTotalCm: Math.round(reachTotalCm),
  };
}

/** مكان المرساة على السطح — نفس الحساب اللي layoutSurface بتعمله. */
function anchorSpot(item, slot, ctx) {
  const { W, D, seatX, dominant, placed, cats } = ctx;
  // مكان المرساة مالوش لازمة لو الحاجة أصلاً أكبر من السطح
  if (item.w > W || item.d > D) return null;
  if (slot === 'back-center') {
    return { x: clamp(seatX - item.w / 2, 0, W - item.w), y: Math.max(0, D - item.d - 2), w: item.w, d: item.d };
  }
  if (slot === 'front-center') {
    return { x: clamp(seatX - item.w / 2, 0, W - item.w), y: FRONT_WORK_GAP, w: item.w, d: item.d };
  }
  if (slot === 'front-dominant') {
    const fc = placed.find((p) => cats[p.category]?.anchor === 'front-center');
    const y = fc ? fc.y : FRONT_WORK_GAP;
    const x = dominant === 'right'
      ? clamp((fc ? fc.x + fc.w : seatX + 10) + 3, 0, W - item.w)
      : clamp((fc ? fc.x : seatX - 10) - item.w - 3, 0, W - item.w);
    return { x, y, w: item.w, d: item.d };
  }
  return null;
}

/**
 * بيجرب حاجة لسه متشترتش: هتدخل ولا لأ، وهتقع فين لو دخلت.
 * الترتيب الحالي مابيتغيرش — بنسأل بس.
 *
 * @returns {{fits:boolean, spot:Object|null, cost:number, blockedBy:Array}}
 */
export function tryFit(surface, placed, profile, candidate, opts = {}) {
  const cats = profile.categories || {};
  const item = {
    ...candidate,
    w: Number(candidate.widthCm) || 0,
    d: Number(candidate.depthCm) || 0,
    h: Number(candidate.heightCm) || 0,
    category: cats[candidate.category] ? candidate.category : 'other',
    frequency: candidate.frequency || 'medium',
  };
  if (!(item.w > 0 && item.d > 0)) return { fits: false, spot: null, cost: 0, blockedBy: [] };

  const ctx = layoutContext(surface, profile, opts, placed);
  const rule = cats[item.category] || cats.other || { zone: 'secondary', side: 'any' };

  // أكبر من السطح نفسه؟ يبقى المشكلة مش الزحمة، وده جواب مختلف تماماً.
  // بنجرب الاتجاهين اللي مسموح بيهم بس — الحاجة العالية مبتتقلبش على جنبها.
  const upright = item.w <= ctx.W && item.d <= ctx.D;
  const canRotate = !rule.tall && item.h <= 15;
  const sideways = canRotate && item.d <= ctx.W && item.w <= ctx.D;
  if (!upright && !sideways) {
    return {
      fits: false, spot: null, cost: 0, blockedBy: [], tooBig: true,
      shortBy: {
        widthCm: Math.round(Math.max(0, item.w - ctx.W) * 10) / 10,
        depthCm: Math.round(Math.max(0, item.d - ctx.D) * 10) / 10,
      },
    };
  }

  // حاجة ليها مرساة (شاشة، مراية، كيبورد) مكانها محدد سلفاً —
  // بنجرب مكان مرساتها الأول قبل ما ندوّر بالشبكة، زي ما layoutSurface بتعمل بالظبط.
  if (rule.anchor) {
    const anchored = anchorSpot(item, rule.anchor, ctx);
    if (anchored) {
      const clash = placed.filter((p) => rectsOverlap(anchored, { x: p.x, y: p.y, w: p.w, d: p.d }, 1));
      if (!clash.length) {
        return { fits: true, spot: { ...anchored, rotated: false, reason: [{ key: 'r_anchor' + (rule.anchor === 'back-center' ? 'Back' : 'Front') }] }, cost: 0, blockedBy: [] };
      }
      // مكانها محجوز — بنقول محجوز بإيه بدل ما نحطها في مكان غلط
      return { fits: false, spot: null, cost: 0, blockedBy: clash.map((p) => p.id), anchorTaken: true };
    }
  }

  const spot = findSpot(item, rule, ctx);
  if (spot) return { fits: true, spot, cost: Math.round(spot.cost), blockedBy: [] };

  // مادخلش — نشوف مين الواقف في الطريق: مين لو اتشال يخليها تدخل
  const blockedBy = [];
  for (const p of placed) {
    const without = placed.filter((x) => x.id !== p.id);
    const ctx2 = layoutContext(surface, profile, opts, without);
    if (findSpot(item, rule, ctx2)) blockedBy.push(p.id);
  }
  return { fits: false, spot: null, cost: 0, blockedBy };
}

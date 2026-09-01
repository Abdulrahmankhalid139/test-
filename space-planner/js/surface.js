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
    placed.push({ ...backCenter, x, y, rotated: false, reasonAr: 'قدامك مباشرة وفي أبعد نقطة — دي الحاجة اللي بتبص لها' });

    if (cats[backCenter.category]?.screen) {
      const viewDistance = y - reachOrigin.y;
      if (viewDistance < 50) {
        notes.push({
          level: 'warn',
          textAr: 'مسافة النظر للشاشة حوالي ' + Math.round(viewDistance) + ' سم — الموصى بيه 50 لـ 70 سم. السطح ضيق في العمق، فارجع بالكرسي شوية أو ركّب الشاشة على ذراع حائط.',
        });
      }
      if (backCenter.category === 'laptop') {
        notes.push({
          level: 'tip',
          textAr: 'اللابتوب شاشته واطية فبتخلّيك تحني رقبتك. ارفعه على ستاند (أو رزمة كتب) لحد ما تبقى أعلى نقطة في الشاشة على مستوى عينك، واستخدم كيبورد وماوس خارجيين.',
        });
      }
    }
  }

  if (frontCenter) {
    const x = clamp(seatX - frontCenter.w / 2, 0, W - frontCenter.w);
    placed.push({ ...frontCenter, x, y: FRONT_WORK_GAP, rotated: false, reasonAr: 'في المنتصف قدامك، وسايب مساحة تشتغل فيها' });
  }

  if (frontDominant) {
    const fc = placed.find((p) => p.id === frontCenter?.id);
    const y = fc ? fc.y : FRONT_WORK_GAP;
    const x = dominant === 'right'
      ? clamp((fc ? fc.x + fc.w : seatX + 10) + 3, 0, W - frontDominant.w)
      : clamp((fc ? fc.x : seatX - 10) - frontDominant.w - 3, 0, W - frontDominant.w);
    placed.push({ ...frontDominant, x, y, rotated: false, reasonAr: 'على ناحية إيدك ال' + (dominant === 'right' ? 'يمين' : 'شمال') + ' وقريب من إيدك' });
  }

  // ٢) الباقي: بحث على شبكة بدالة تكلفة
  const rest = norm.filter((i) => !placed.some((p) => p.id === i.id));
  const freqRank = { high: 0, medium: 1, low: 2 };
  rest.sort((a, b) => (freqRank[a.frequency] ?? 1) - (freqRank[b.frequency] ?? 1));

  for (const item of rest) {
    if (item.frequency === 'low' && item.w * item.d > BULKY_AREA_CM2) {
      offDesk.push({
        ...item,
        reasonAr: 'بتاخد ' + Math.round(item.w * item.d) + ' سم² من المساحة وانت نادراً بتستخدمها — مكانها رف أو درج',
      });
      continue;
    }
    const rule = ruleFor(item.category);
    const spot = findSpot(item, rule, { W, D, placed, reachOrigin, dominant, light, cats });
    if (spot) {
      placed.push({ ...item, x: spot.x, y: spot.y, w: spot.w, d: spot.d, rotated: spot.rotated, reasonAr: spot.reasonAr });
    } else {
      offDesk.push({
        ...item,
        reasonAr: item.frequency === 'low'
          ? 'مش بتستخدمها كتير والمساحة مزحومة — مكانها الدرج أو رف'
          : 'مفيش مساحة مناسبة ليها على السطح',
      });
    }
  }

  notes.push(...physicalNotes({ surface, windowSide, dominant, placed, offDesk, cats }));
  for (const tip of profile.tipsAr || []) notes.push({ level: 'tip', textAr: tip });

  const usedArea = placed.reduce((s, p) => s + p.w * p.d, 0);
  return {
    desk: { widthCm: W, depthCm: D, seatXCm: seatX },
    profileAr: profile.spaceTypeAr,
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

function findSpot(item, rule, ctx) {
  const { W, D, placed, reachOrigin, dominant, light, cats } = ctx;
  const target = ZONES[rule.zone]?.targetCm ?? ZONES.secondary.targetCm;
  const selfPad = rule.hot ? HOT_CLEARANCE : 1;
  let best = null;

  const variants = [{ w: item.w, d: item.d, rotated: false }];
  if (Math.abs(item.w - item.d) > 2) variants.push({ w: item.d, d: item.w, rotated: true });

  const frontAnchor = placed.find((p) => cats[p.category]?.anchor === 'front-center');
  const backAnchor = placed.find((p) => cats[p.category]?.anchor === 'back-center');

  for (const v of variants) {
    for (let x = 0; x <= W - v.w; x += GRID) {
      for (let y = 0; y <= D - v.d; y += GRID) {
        const cand = { x, y, w: v.w, d: v.d };

        if (cand.y < EDGE_MARGIN) continue;

        const blocked = placed.some((p) => {
          const pad = Math.max(selfPad, cats[p.category]?.hot ? HOT_CLEARANCE : 1);
          return rectsOverlap(cand, { x: p.x, y: p.y, w: p.w, d: p.d }, pad);
        });
        if (blocked) continue;

        // مساحة الشغل قدام المرساة القدامية تفضل فاضية
        if (frontAnchor && cand.y < frontAnchor.y &&
            rectsOverlap(cand, { x: frontAnchor.x - 4, y: 0, w: frontAnchor.w + 8, d: frontAnchor.y }, 0)) continue;

        // الحاجات العالية ممنوعة تحجب المرساة الخلفية (شاشة/مراية)
        if (backAnchor && item.h > 12 && cand.y + cand.d > backAnchor.y - 12 &&
            rectsOverlap(cand, { x: backAnchor.x - 5, y: 0, w: backAnchor.w + 10, d: backAnchor.y }, 0)) continue;

        const cx = cand.x + cand.w / 2;
        const cy = cand.y + cand.d / 2;
        const dist = Math.hypot(cx - reachOrigin.x, cy - reachOrigin.y);

        let cost = Math.abs(dist - target);

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

        if (!best || cost < best.cost) best = { ...cand, rotated: v.rotated, cost, dist };
      }
    }
  }

  if (!best) return null;
  if (best.cost > 60 && item.frequency === 'low') return null;

  best.reasonAr = describeReason(rule, best, dominant);
  return best;
}

function describeReason(rule, spot, dominant) {
  const zoneAr = ZONES[rule.zone]?.labelAr || 'في منطقة مريحة';
  let extra = '';
  if (rule.side === 'dominant') extra = ' على ناحية إيدك ال' + (dominant === 'right' ? 'يمين' : 'شمال');
  else if (rule.side === 'off') extra = ' على الناحية ال' + (dominant === 'right' ? 'شمال' : 'يمين') + ' بعيد عن إيد الشغل';
  if (rule.keepDry) extra += ' وبعيد عن الحاجات اللي بتتلف لو اتكب';
  if (rule.avoidLight) extra += ' وبعيد عن الشمس';
  if (rule.wantsLight) extra += ' وقريب من الضو';
  if (rule.hot) extra += ' وحواليه خلوص عشان بيسخن';
  return zoneAr + extra + ' — على بُعد ' + Math.round(spot.dist) + ' سم منك';
}

/** ملاحظات فيزيائية عامة — بتنطبق على أي مساحة مهما كان نوعها. */
function physicalNotes({ surface, windowSide, dominant, placed, offDesk, cats }) {
  const out = [];
  const hasScreen = placed.some((p) => cats[p.category]?.screen);

  if (windowSide === 'back' && hasScreen) {
    out.push({ level: 'warn', textAr: 'الشباك ورا ضهرك — الضو هيتعكس على الشاشة وهيتعبك. لف السطح بحيث يبقى الشباك على جنبك، أو استخدم ستارة.' });
  } else if (windowSide === 'front' && hasScreen) {
    out.push({ level: 'warn', textAr: 'الشباك قدامك ورا الشاشة — هتبص في الضو طول اليوم وعينك هتوجعك. لف السطح ٩٠ درجة عشان الشباك يبقى على جنبك.' });
  } else if (windowSide === 'left' || windowSide === 'right') {
    out.push({ level: 'ok', textAr: 'الشباك على جنبك — ده أحسن وضع للإضاءة الطبيعية. ✅' });
  }

  const lamp = placed.find((p) => /lamp|إضاءة|أباجورة/i.test(p.category + p.nameAr));
  if (lamp) {
    const onDominant = dominant === 'right'
      ? lamp.x + lamp.w / 2 > surface.widthCm / 2
      : lamp.x + lamp.w / 2 < surface.widthCm / 2;
    if (!onDominant) {
      out.push({ level: 'ok', textAr: 'الإضاءة على ناحية إيدك ال' + (dominant === 'right' ? 'شمال' : 'يمين') + ' — عشان إيدك متعملش ضل على اللي بتعمله. ✅' });
    }
  }

  if (placed.some((p) => cats[p.category]?.keepDry)) {
    out.push({ level: 'tip', textAr: 'السوايل اتحطت بعيد — لو اتكبت مش هتوصل للحاجات اللي بتتلف.' });
  }

  if (placed.some((p) => cats[p.category]?.hot)) {
    out.push({ level: 'tip', textAr: 'الحاجات اللي بتسخن سيبنا حواليها خلوص عشان متقربش من حاجة تتأثر بالحرارة.' });
  }

  if (offDesk.length) {
    out.push({ level: 'tip', textAr: 'شيلنا ' + offDesk.length + ' حاجة من على السطح. المساحة الفاضية بتقلل التشتت، والحاجات دي مكانها الأنسب درج أو رف.' });
  }

  return out;
}

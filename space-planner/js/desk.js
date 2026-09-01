/**
 * desk.js — ترتيب المكتب بقواعد إرجونومية.
 *
 * نفس المبدأ: الموديل بيتعرّف على الحاجات ويقيسها،
 * والقواعد والحساب هنا هما اللي بيقرروا كل حاجة تروح فين.
 *
 * نظام الإحداثيات (بالسنتيمتر):
 *   x = 0 عند طرف المكتب الشمال  →  x = widthCm ناحية اليمين
 *   y = 0 عند الحافة القدامية (ناحيتك)  →  y = depthCm ناحية الحيطة
 */

const GRID = 2;             // دقة البحث بالسنتيمتر
const PRIMARY_REACH = 40;   // منطقة الوصول السهل من غير ما تتحرك
const SECONDARY_REACH = 65; // منطقة الوصول بمد الدراع
const KEYBOARD_FRONT_GAP = 10; // مساحة الرسغين قدام الكيبورد
const EDGE_MARGIN = 4;      // هامش أمان من حافة المكتب
const BULKY_AREA_CM2 = 600; // أكبر من كده ونادر الاستخدام = يتشال

/**
 * قواعد كل نوع حاجة:
 *  zone      — المنطقة المثالية
 *  side      — 'dominant' | 'off' | 'center' | 'any'
 *  blocksView— هل ممكن تحجب الشاشة لو اتحطت وراها
 *  keepDry   — حاجة سايلة: تفضل بعيد عن الإلكترونيات
 */
const RULES = {
  monitor:   { zone: 'back',      side: 'center', anchor: true },
  laptop:    { zone: 'back',      side: 'center', anchor: true },
  keyboard:  { zone: 'front',     side: 'center', anchor: true },
  mouse:     { zone: 'front',     side: 'dominant', anchor: true },
  drink:     { zone: 'secondary', side: 'off',      keepDry: true },
  phone:     { zone: 'primary',   side: 'off' },
  notebook:  { zone: 'primary',   side: 'dominant' },
  pens:      { zone: 'primary',   side: 'dominant' },
  lamp:      { zone: 'back',      side: 'off', tall: true },
  speaker:   { zone: 'back',      side: 'any', tall: true },
  headphones:{ zone: 'secondary', side: 'off' },
  plant:     { zone: 'far',       side: 'any', tall: true },
  books:     { zone: 'far',       side: 'any', tall: true },
  storage:   { zone: 'far',       side: 'any' },
  decor:     { zone: 'far',       side: 'any' },
  other:     { zone: 'secondary', side: 'any' },
};

const ZONE_TARGET = {
  front: 18, primary: 32, secondary: 52, back: 70, far: 85,
};

function ruleFor(category) {
  return RULES[category] || RULES.other;
}

function rectsOverlap(a, b, pad = 1) {
  return (
    a.x < b.x + b.w + pad && a.x + a.w + pad > b.x &&
    a.y < b.y + b.d + pad && a.y + a.d + pad > b.y
  );
}

/**
 * @param {{widthCm:number, depthCm:number}} desk
 * @param {Array} items [{id,nameAr,category,widthCm,depthCm,heightCm,frequency}]
 * @param {{dominantHand:'right'|'left', windowSide:'left'|'right'|'front'|'back'|'none', seatXCm?:number}} opts
 */
export function layoutDesk(desk, items, opts = {}) {
  const W = desk.widthCm;
  const D = desk.depthCm;
  const dominant = opts.dominantHand === 'left' ? 'left' : 'right';
  const windowSide = opts.windowSide || 'none';
  const seatX = Number.isFinite(opts.seatXCm) ? opts.seatXCm : W / 2;
  const reachOrigin = { x: seatX, y: -5 };

  const placed = [];
  const offDesk = [];
  const notes = [];

  const norm = items
    .map((it) => ({
      ...it,
      w: Number(it.widthCm) || 0,
      d: Number(it.depthCm) || 0,
      h: Number(it.heightCm) || 0,
      category: RULES[it.category] ? it.category : 'other',
      frequency: it.frequency || 'medium',
    }))
    .filter((it) => it.w > 0 && it.d > 0);

  // ١) المراسي الأول: الشاشة، الكيبورد، الماوس — دول بيحددوا كل حاجة بعديهم
  const monitor = norm.find((i) => i.category === 'monitor' || i.category === 'laptop');
  const keyboard = norm.find((i) => i.category === 'keyboard');
  const mouse = norm.find((i) => i.category === 'mouse');

  if (monitor) {
    const y = Math.max(0, D - monitor.d - 2);
    const x = clamp(seatX - monitor.w / 2, 0, W - monitor.w);
    placed.push({ ...monitor, x, y, rotated: false, reasonAr: 'قدامك مباشرة وفي أبعد نقطة — عشان مسافة النظر' });
    const viewDistance = y - reachOrigin.y;
    if (viewDistance < 50) {
      notes.push({
        level: 'warn',
        textAr: `مسافة النظر للشاشة حوالي ${Math.round(viewDistance)} سم — الموصى بيه 50 لـ 70 سم. المكتب ضيق في العمق، فارجع بالكرسي شوية أو ركّب الشاشة على ذراع حائط.`,
      });
    }
    if (monitor.category === 'laptop') {
      notes.push({
        level: 'tip',
        textAr: 'اللابتوب شاشته واطية فبتخلّيك تحني رقبتك. ارفعه على ستاند (أو رزمة كتب) لحد ما تبقى أعلى نقطة في الشاشة على مستوى عينك، واستخدم كيبورد وماوس خارجيين.',
      });
    }
  }

  if (keyboard) {
    const x = clamp(seatX - keyboard.w / 2, 0, W - keyboard.w);
    placed.push({ ...keyboard, x, y: KEYBOARD_FRONT_GAP, rotated: false, reasonAr: 'في المنتصف قدامك، وسايب مساحة للرسغين' });
  }

  if (mouse) {
    const kb = placed.find((p) => p.category === 'keyboard');
    const y = kb ? kb.y : KEYBOARD_FRONT_GAP;
    const x = dominant === 'right'
      ? clamp((kb ? kb.x + kb.w : seatX + 10) + 3, 0, W - mouse.w)
      : clamp((kb ? kb.x : seatX - 10) - mouse.w - 3, 0, W - mouse.w);
    placed.push({ ...mouse, x, y, rotated: false, reasonAr: `جنب الكيبورد على ناحية إيدك ال${dominant === 'right' ? 'يمين' : 'شمال'} وقريب منه` });
  }

  // ٢) الباقي: بحث على شبكة بدالة تكلفة
  const rest = norm.filter((i) => !placed.some((p) => p.id === i.id));
  const freqRank = { high: 0, medium: 1, low: 2 };
  rest.sort((a, b) => (freqRank[a.frequency] ?? 1) - (freqRank[b.frequency] ?? 1));

  for (const item of rest) {
    // حاجة كبيرة وبتستخدمها نادراً = بتاكل مكتبك من غير مقابل
    if (item.frequency === 'low' && item.w * item.d > BULKY_AREA_CM2) {
      offDesk.push({
        ...item,
        reasonAr: `بتاخد ${Math.round(item.w * item.d)} سم² من المكتب وانت نادراً بتستخدمها — مكانها رف أو درج`,
      });
      continue;
    }
    const rule = ruleFor(item.category);
    const best = findSpot(item, rule, { W, D, placed, reachOrigin, dominant, monitor });
    if (best) {
      placed.push({ ...item, x: best.x, y: best.y, w: best.w, d: best.d, rotated: best.rotated, reasonAr: best.reasonAr });
    } else {
      offDesk.push({
        ...item,
        reasonAr: item.frequency === 'low'
          ? 'مش بتستخدمها كتير والمكتب مزحوم — مكانها الدرج أو رف'
          : 'مفيش مساحة مناسبة عليها على المكتب',
      });
    }
  }

  notes.push(...ergonomicNotes({ desk, windowSide, dominant, placed, offDesk }));

  const usedArea = placed.reduce((s, p) => s + p.w * p.d, 0);
  return {
    desk: { widthCm: W, depthCm: D, seatXCm: seatX },
    placed,
    offDesk,
    notes,
    stats: {
      deskAreaCm2: Math.round(W * D),
      usedAreaCm2: Math.round(usedArea),
      freePercent: Math.round(100 - (usedArea / (W * D)) * 100),
      onDesk: placed.length,
      removed: offDesk.length,
    },
  };
}

function findSpot(item, rule, ctx) {
  const { W, D, placed, reachOrigin, dominant, monitor } = ctx;
  const target = ZONE_TARGET[rule.zone] ?? ZONE_TARGET.secondary;
  let best = null;

  const variants = [{ w: item.w, d: item.d, rotated: false }];
  if (Math.abs(item.w - item.d) > 2) variants.push({ w: item.d, d: item.w, rotated: true });

  for (const v of variants) {
    for (let x = 0; x <= W - v.w; x += GRID) {
      for (let y = 0; y <= D - v.d; y += GRID) {
        const cand = { x, y, w: v.w, d: v.d };

        // هامش أمان من الحافة القدامية — عشان الحاجات متقعش
        if (cand.y < EDGE_MARGIN) continue;

        if (placed.some((p) => rectsOverlap(cand, { x: p.x, y: p.y, w: p.w, d: p.d }))) continue;

        // ممنوع أي حاجة في مساحة الرسغين قدام الكيبورد
        const kb = placed.find((p) => p.category === 'keyboard');
        if (kb && cand.y < kb.y && rectsOverlap(cand, { x: kb.x - 4, y: 0, w: kb.w + 8, d: kb.y }, 0)) continue;

        // الحاجات العالية ممنوعة تقف قدام الشاشة وتحجبها
        const mon = placed.find((p) => p.category === 'monitor' || p.category === 'laptop');
        if (mon && item.h > 12 && cand.y + cand.d > mon.y - 12 &&
            rectsOverlap(cand, { x: mon.x - 5, y: 0, w: mon.w + 10, d: mon.y }, 0)) continue;

        const cx = cand.x + cand.w / 2;
        const cy = cand.y + cand.d / 2;
        const dist = Math.hypot(cx - reachOrigin.x, cy - reachOrigin.y);

        let cost = Math.abs(dist - target);

        // ناحية اليمين/الشمال
        const isDominantSide = dominant === 'right' ? cx > reachOrigin.x : cx < reachOrigin.x;
        if (rule.side === 'dominant' && !isDominantSide) cost += 22;
        if (rule.side === 'off' && isDominantSide) cost += 22;
        if (rule.side === 'center') cost += Math.abs(cx - reachOrigin.x) * 0.8;

        // المشروبات: بعيد عن الكيبورد والشاشة، ولو اتكبت متروحش عليهم
        if (rule.keepDry) {
          if (kb && cand.y < kb.y + kb.d + 6) cost += 30;
          const nearElectronics = placed.filter((p) => ['keyboard', 'laptop', 'monitor', 'speaker'].includes(p.category));
          for (const e of nearElectronics) {
            const gap = Math.hypot(cx - (e.x + e.w / 2), cy - (e.y + e.d / 2));
            if (gap < 25) cost += (25 - gap) * 1.2;
          }
        }

        // نفضّل الالتصاق بالحواف للحاجات النادرة الاستخدام
        if (rule.zone === 'far') cost += (D - (cand.y + cand.d)) * 0.5;

        if (!best || cost < best.cost) {
          best = { ...cand, rotated: v.rotated, cost, dist };
        }
      }
    }
  }

  if (!best) return null;
  // بعيدة أوي عن مكانها المثالي ونادرة الاستخدام → الأفضل تتشال
  if (best.cost > 60 && item.frequency === 'low') return null;

  best.reasonAr = describeReason(rule, best, dominant);
  return best;
}

function describeReason(rule, spot, dominant) {
  const zoneAr = {
    front: 'قدامك مباشرة',
    primary: 'في متناول إيدك من غير ما تتحرك',
    secondary: 'على بُعد مد دراع',
    back: 'في العمق ناحية الحيطة',
    far: 'بعيد عن منطقة الشغل',
  }[rule.zone] || 'في منطقة مريحة';

  let extra = '';
  if (rule.side === 'dominant') extra = ` على ناحية إيدك ال${dominant === 'right' ? 'يمين' : 'شمال'}`;
  else if (rule.side === 'off') extra = ` على الناحية ال${dominant === 'right' ? 'شمال' : 'يمين'} بعيد عن إيد الشغل`;
  if (rule.keepDry) extra += ' وبعيد عن الإلكترونيات لو اتكب';
  return `${zoneAr}${extra} — على بُعد ${Math.round(spot.dist)} سم منك`;
}

function ergonomicNotes({ desk, windowSide, dominant, placed, offDesk }) {
  const out = [];

  if (windowSide === 'back') {
    out.push({ level: 'warn', textAr: 'الشباك ورا ضهرك — الضو هيتعكس على الشاشة وهيتعبك. لف المكتب بحيث يبقى الشباك على جنبك، أو استخدم ستارة.' });
  } else if (windowSide === 'front') {
    out.push({ level: 'warn', textAr: 'الشباك قدامك ورا الشاشة — هتبص في الضو طول اليوم وعينك هتوجعك. لف المكتب ٩٠ درجة عشان الشباك يبقى على جنبك.' });
  } else if (windowSide === 'left' || windowSide === 'right') {
    out.push({ level: 'ok', textAr: 'الشباك على جنبك — ده أحسن وضع للإضاءة الطبيعية. ✅' });
  }

  const lamp = placed.find((p) => p.category === 'lamp');
  if (lamp) {
    const lampOnDominant = dominant === 'right'
      ? lamp.x + lamp.w / 2 > desk.widthCm / 2
      : lamp.x + lamp.w / 2 < desk.widthCm / 2;
    if (!lampOnDominant) {
      out.push({ level: 'ok', textAr: `الأباجورة على ناحية إيدك ال${dominant === 'right' ? 'شمال' : 'يمين'} — عشان إيدك متعملش ضل وانت بتكتب. ✅` });
    }
  }

  if (desk.depthCm < 60) {
    out.push({ level: 'warn', textAr: `عمق المكتب ${Math.round(desk.depthCm)} سم — ده ضيق. المريح ٧٠ سم على الأقل عشان الشاشة تبعد كفاية.` });
  }

  const drinks = placed.filter((p) => p.category === 'drink');
  if (drinks.length) {
    out.push({ level: 'tip', textAr: 'المشروب اتحط بعيد عن الكيبورد والشاشة — لو اتكب مش هيوصلهم.' });
  }

  if (offDesk.length) {
    out.push({ level: 'tip', textAr: `شيلنا ${offDesk.length} حاجة من على المكتب. المكتب الفاضي بيقلل التشتت، والحاجات دي مكانها الأنسب درج أو رف.` });
  }

  return out;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export const DESK_CATEGORIES = Object.keys(RULES);

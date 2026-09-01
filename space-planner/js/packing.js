/**
 * packing.js — رص ثلاثي الأبعاد (3D Bin Packing).
 *
 * دي الحتة اللي *مينفعش* الموديل يخمّنها. مسألة رياضية معروفة،
 * وبنحلها بخوارزمية "المساحات القصوى" (Maximal Spaces) مع ترتيب
 * تنازلي بالحجم و 6 دورانات لكل قطعة.
 *
 * الناتج قاطع: ده يدخل، وده لأ، وبالترتيب ده بالظبط.
 */

const EPS = 0.001;

/** كل الدورانات الممكنة لصندوق (٦ اتجاهات). */
function orientations(item) {
  const { w, d, h } = item;
  const all = [
    [w, d, h], [w, h, d], [d, w, h],
    [d, h, w], [h, w, d], [h, d, w],
  ];
  // لو القطعة مش مسموح تتقلب (زي لابتوب أو حاجة قابلة للكسر)،
  // نسمح بس بالدوران حوالين المحور الرأسي.
  const allowed = item.keepUpright ? [[w, d, h], [d, w, h]] : all;
  const seen = new Set();
  const out = [];
  for (const [ow, od, oh] of allowed) {
    const key = `${ow.toFixed(2)}x${od.toFixed(2)}x${oh.toFixed(2)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ w: ow, d: od, h: oh });
  }
  return out;
}

function fitsIn(space, dim) {
  return (
    dim.w <= space.w + EPS &&
    dim.d <= space.d + EPS &&
    dim.h <= space.h + EPS
  );
}

function intersects(a, b) {
  return (
    a.x < b.x + b.w - EPS && a.x + a.w > b.x + EPS &&
    a.y < b.y + b.d - EPS && a.y + a.d > b.y + EPS &&
    a.z < b.z + b.h - EPS && a.z + a.h > b.z + EPS
  );
}

function contains(outer, inner) {
  return (
    outer.x <= inner.x + EPS && outer.y <= inner.y + EPS && outer.z <= inner.z + EPS &&
    outer.x + outer.w >= inner.x + inner.w - EPS &&
    outer.y + outer.d >= inner.y + inner.d - EPS &&
    outer.z + outer.h >= inner.z + inner.h - EPS
  );
}

/**
 * بعد ما نحط قطعة، كل مساحة فاضية بتتقاطع معاها بتتقسم
 * لحد ٦ مساحات جديدة حواليها.
 */
function splitSpace(space, box) {
  const parts = [];
  // شمال
  if (box.x - space.x > EPS) {
    parts.push({ x: space.x, y: space.y, z: space.z, w: box.x - space.x, d: space.d, h: space.h });
  }
  // يمين
  const rightEdge = box.x + box.w;
  if (space.x + space.w - rightEdge > EPS) {
    parts.push({ x: rightEdge, y: space.y, z: space.z, w: space.x + space.w - rightEdge, d: space.d, h: space.h });
  }
  // قدام
  if (box.y - space.y > EPS) {
    parts.push({ x: space.x, y: space.y, z: space.z, w: space.w, d: box.y - space.y, h: space.h });
  }
  // ورا
  const backEdge = box.y + box.d;
  if (space.y + space.d - backEdge > EPS) {
    parts.push({ x: space.x, y: backEdge, z: space.z, w: space.w, d: space.y + space.d - backEdge, h: space.h });
  }
  // تحت
  if (box.z - space.z > EPS) {
    parts.push({ x: space.x, y: space.y, z: space.z, w: space.w, d: space.d, h: box.z - space.z });
  }
  // فوق
  const topEdge = box.z + box.h;
  if (space.z + space.h - topEdge > EPS) {
    parts.push({ x: space.x, y: space.y, z: topEdge, w: space.w, d: space.d, h: space.z + space.h - topEdge });
  }
  return parts;
}

/** بنشيل أي مساحة متحطوطة جوه مساحة أكبر — عشان القايمة متكبرش بلا داعي. */
function prune(spaces) {
  const kept = [];
  for (let i = 0; i < spaces.length; i++) {
    const s = spaces[i];
    if (s.w < 1 || s.d < 1 || s.h < 1) continue; // أقل من سنتيمتر = مش مفيدة
    let swallowed = false;
    for (let j = 0; j < spaces.length; j++) {
      if (i === j) continue;
      if (contains(spaces[j], s) && !(contains(s, spaces[j]) && j > i)) {
        swallowed = true;
        break;
      }
    }
    if (!swallowed) kept.push(s);
  }
  return kept;
}

/**
 * @param {{widthCm:number, depthCm:number, heightCm:number, maxWeightKg?:number}} bin
 * @param {Array} items  [{id, nameAr, widthCm, depthCm, heightCm, weightKg?, fragile?, keepUpright?, compressible?, priority?}]
 * @returns {{placed:Array, unplaced:Array, stats:Object}}
 */
export function pack3D(bin, items) {
  const B = { w: bin.widthCm, d: bin.depthCm, h: bin.heightCm };
  const binVolume = B.w * B.d * B.h;

  // القطع الجامدة بترص هندسياً. القطع اللينة (هدوم) بتتحشر في الفاضي بعدين.
  const rigid = [];
  const soft = [];
  for (const it of items) {
    const norm = {
      ...it,
      w: Number(it.widthCm) || 0,
      d: Number(it.depthCm) || 0,
      h: Number(it.heightCm) || 0,
      weightKg: Number(it.weightKg) || 0,
    };
    if (norm.w <= 0 || norm.d <= 0 || norm.h <= 0) continue;
    (it.compressible ? soft : rigid).push(norm);
  }

  // الترتيب: الحاجات الجامدة الأكبر الأول (عشان تلاقي مكانها قبل ما الفاضي يتفتت)،
  // والقابل للكسر يتأجل للآخر عشان يستقر فوق مش تحت التقيل.
  rigid.sort((a, b) => {
    if (!!a.fragile !== !!b.fragile) return a.fragile ? 1 : -1;
    const volA = a.w * a.d * a.h;
    const volB = b.w * b.d * b.h;
    if (Math.abs(volA - volB) > 1) return volB - volA;
    return Math.max(b.w, b.d, b.h) - Math.max(a.w, a.d, a.h);
  });

  let spaces = [{ x: 0, y: 0, z: 0, ...B }];
  const placed = [];
  const unplaced = [];
  let usedWeight = 0;

  for (const item of rigid) {
    if (bin.maxWeightKg && usedWeight + item.weightKg > bin.maxWeightKg + EPS) {
      unplaced.push({ ...item, reasonAr: 'هيعدّي حد الوزن المسموح' });
      continue;
    }

    let best = null;
    for (const space of spaces) {
      for (const dim of orientations(item)) {
        if (!fitsIn(space, dim)) continue;
        // الحاجات العادية: الأوطى الأول — بيبني طبقات مستقرة من تحت لفوق.
        // القابل للكسر: أعلى سطح متاح — عشان ميجيش فوقه حاجة تقيلة.
        const score = item.fragile
          ? -space.z * 1000 + space.y * 10 + space.x
          : space.z * 1000 + space.y * 10 + space.x;
        if (!best || score < best.score) {
          best = { score, space, dim };
        }
      }
    }

    if (!best) {
      // بنفرّق بين "مستحيل تدخل أصلاً" و"الشنطة اتملت".
      const emptyBin = { x: 0, y: 0, z: 0, ...B };
      const everFits = orientations(item).some((dim) => fitsIn(emptyBin, dim));
      unplaced.push({
        ...item,
        reasonAr: everFits
          ? 'مفيش مساحة فاضية كفاية'
          : `أكبر من الشنطة نفسها (أطول ضلع ${Math.round(Math.max(item.w, item.d, item.h))} سم)`,
      });
      continue;
    }

    const box = {
      x: best.space.x, y: best.space.y, z: best.space.z,
      w: best.dim.w, d: best.dim.d, h: best.dim.h,
    };
    placed.push({ ...item, box, rotated: box.w !== item.w || box.h !== item.h });
    usedWeight += item.weightKg;

    // نحدّث المساحات الفاضية
    const next = [];
    for (const s of spaces) {
      if (intersects(s, box)) next.push(...splitSpace(s, box));
      else next.push(s);
    }
    spaces = prune(next);
  }

  // الهدوم واللينة: بتتحشر في الفاضي المتبقي بمعامل ضغط.
  const usedVolume = placed.reduce((sum, p) => sum + p.box.w * p.box.d * p.box.h, 0);
  let freeVolume = binVolume - usedVolume;
  soft.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  for (const item of soft) {
    const compressed = item.w * item.d * item.h * 0.7; // اللبس بيتضغط ~٣٠٪
    if (bin.maxWeightKg && usedWeight + item.weightKg > bin.maxWeightKg + EPS) {
      unplaced.push({ ...item, reasonAr: 'هيعدّي حد الوزن المسموح' });
      continue;
    }
    if (compressed <= freeVolume) {
      freeVolume -= compressed;
      usedWeight += item.weightKg;
      placed.push({ ...item, box: null, stuffed: true });
    } else {
      unplaced.push({ ...item, reasonAr: 'مفيش فاضي كفاية حتى بعد الكبس' });
    }
  }

  const finalUsed = binVolume - freeVolume;
  return {
    placed,
    unplaced,
    stats: {
      binVolumeCm3: Math.round(binVolume),
      usedVolumeCm3: Math.round(finalUsed),
      fillPercent: Math.round((finalUsed / binVolume) * 100),
      totalWeightKg: Math.round(usedWeight * 100) / 100,
      overWeight: bin.maxWeightKg ? usedWeight > bin.maxWeightKg : false,
      placedCount: placed.length,
      unplacedCount: unplaced.length,
    },
  };
}

/**
 * ترتيب الرص للمستخدم: من تحت لفوق، ومن ورا لقدام.
 * ده اللي بيتحول لخطوات "حط ده الأول، وبعده ده".
 */
export function packingOrder(placed) {
  const rigid = placed.filter((p) => p.box);
  const soft = placed.filter((p) => !p.box);
  const sorted = [...rigid].sort((a, b) => {
    if (Math.abs(a.box.z - b.box.z) > 0.5) return a.box.z - b.box.z;
    if (Math.abs(a.box.y - b.box.y) > 0.5) return b.box.y - a.box.y;
    return a.box.x - b.box.x;
  });
  const steps = sorted.map((p, i) => ({
    step: i + 1,
    nameAr: p.nameAr,
    positionAr: describePosition(p.box),
    rotated: p.rotated,
    fragile: !!p.fragile,
  }));
  if (soft.length) {
    steps.push({
      step: steps.length + 1,
      nameAr: soft.map((s) => s.nameAr).join('، '),
      positionAr: 'احشرها في الفراغات اللي فضلت بين الحاجات',
      rotated: false,
      fragile: false,
    });
  }
  return steps;
}

function describePosition(box) {
  const layer = box.z < 1 ? 'في القاع' : `على ارتفاع ${Math.round(box.z)} سم`;
  const depth = box.y < 1 ? 'ناحية الضهر' : 'قدام';
  return `${layer}، ${depth}`;
}

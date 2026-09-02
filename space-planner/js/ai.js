/**
 * ai.js — طبقة الذكاء عبر قدرة `sample` بتاعة Artifacts.
 *
 * الفرق عن نسخة Gemini: الصفحة بتسأل Claude مباشرة من غير أي مفتاح API،
 * والمستخدم مش محتاج يعمل حاجة. المقابل إن مفيش توليد صور، فميزة
 * "صورة بعد الترتيب" بتتخفي في النسخة دي.
 *
 * نفس الحدود بالظبط: الموديل بيشوف ويقترح، والرياضة والخوارزمية بيقرروا.
 */

const ZONE_ENUM = ['front', 'primary', 'secondary', 'back', 'far'];
const SIDE_ENUM = ['dominant', 'off', 'center', 'any'];
const ANCHOR_ENUM = ['back-center', 'front-center', 'front-dominant', 'none'];

const BAG_CATS_LIST = [
  'laptop', 'electronics', 'camera', 'glass', 'shoes', 'clothes',
  'toiletries', 'book', 'food', 'other',
];

/** بيرجّع دالة sample أو null لو القدرة مش متاحة في العرض ده. */
export async function aiReady() {
  try {
    return (await window.claude?.use?.('sample')) || null;
  } catch {
    return null;
  }
}

/** هل العرض ده يقدر يبعت صور أصلاً؟ */
export async function canSendImages(sample) {
  try {
    const limits = await sample.limits();
    return !!limits?.images;
  } catch {
    return false;
  }
}

/**
 * بيصغّر الصورة وبيرجّع Blob (اللي قدرة sample بتاخده) + dataUrl للعرض.
 */
export function fileToBase64Resized(file, maxSide = 1280) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      canvas.toBlob(
        (blob) => resolve({ blob, dataUrl, base64: dataUrl.split(',')[1], width: w, height: h }),
        'image/jpeg',
        0.85,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('مقدرناش نفتح الصورة دي'));
    };
    img.src = url;
  });
}

function friendlyError(err) {
  const code = err?.code;
  if (code === 'not_granted') return new Error('لازم توافق على استخدام Claude عشان الميزة دي تشتغل');
  if (code === 'rate_limited') return new Error('في ضغط دلوقتي — استنى شوية وجرب تاني');
  if (code === 'images_unavailable') return new Error('العرض ده مش بيسمح ببعت صور. استخدم «أدخل الحاجات بنفسك»');
  if (code === 'image_rejected') return new Error('الصورة دي مترفضت — جرب صورة تانية بصيغة JPG');
  if (code === 'invalid_json') return new Error('رد الموديل مكانش مفهوم — جرب تاني');
  if (code === 'cancelled') return new Error('اتلغى');
  return new Error(err?.message || 'حصل خطأ — جرب تاني');
}

const RULES_BRIEF = `
القواعد بتتكتب بالمفردات دي بس:
- zone: ${ZONE_ENUM.join(' / ')} (قدامه مباشرة / في متناول إيده / مد دراع / في العمق / بعيد)
- side: ${SIDE_ENUM.join(' / ')} (ناحية إيده المسيطرة / الناحية التانية / في النص / أي مكان)
- anchor: الحاجة الرئيسية اللي المساحة بتتبني حواليها — ${ANCHOR_ENUM.join(' / ')}.
  back-center = اللي بيبص لها (شاشة/مراية) · front-center = اللي بيشتغل عليه (كيبورد/تختة) ·
  front-dominant = جنب إيده (ماوس). كل خانة تتاخد مرة واحدة بالكتير.
- الأعلام: tall (عالية فممكن تحجب) · keepDry (سايلة) · avoidLight (بتبوظ في الشمس) ·
  wantsLight (محتاجة ضو) · hot (بتسخن) · screen (شاشة).
لازم تسيب فئة اسمها other لأي حاجة مش داخلة في تصنيف.
`;

/* ═══════════ ١+٤+٥: الرؤية وتعرّف المساحة وتوليد القواعد ═══════════ */

export async function analyzeScene({ image, mode, scaleRefLabel, profile, intent, sample }) {
  const isBag = mode === 'bag';
  const generateProfile = !isBag && !profile;

  let prompt = `انت بتحلل صورة ${isBag ? 'حاجات هتترص في شنطة' : 'مساحة عشان ترتّبها'}.
رد بـ JSON بس، من غير أي كلام قبله أو بعده.

`;

  if (generateProfile) {
    prompt += `المطلوب:
1) حدد المساحة دي إيه بالظبط من اللي عليها. مثال: ترابيزة عليها مراية ومكياج = تسريحة مش مكتب.
   ترابيزة عليها شاشة وكيبورد = مكتب شغل. ترابيزة جنب سرير عليها أباجورة = كومودينو.
2) اكتب قواعد ترتيب النوع ده من المساحات: الفئات اللي بتتحط عليه، وكل فئة تروح فين وليه.
   فكّر زي متخصص: إيه اللي لازم يبقى في متناول الإيد، إيه اللي بيبوظ في الشمس، إيه اللي بيسخن، وإيه اللي بيحجب.
${RULES_BRIEF}
3) دوّر على مرجع القياس في الصورة: ${scaleRefLabel}. حدد مربعه بدقة عالية جداً — كل الحسابات معتمدة عليه.
4) حدد سطح المساحة نفسه بمربع، وقدّر مقاسه الحقيقي.
5) اعمل ليستة بكل حاجة على السطح.
6) الشباك أو مصدر الضو فين بالنسبة للشخص؟

الصيغة:
{"spaceTypeAr":"...","profile":{"spaceTypeAr":"...","defaultSizeCm":{"width":0,"depth":0},
 "categories":[{"key":"...","labelAr":"...","zone":"...","side":"...","anchor":"...","tall":false,"keepDry":false,"avoidLight":false,"wantsLight":false,"hot":false,"screen":false}],
 "tipsAr":["..."]},
 "scaleReference":{"found":true,"whatAr":"...","box":[0,0,0,0]},
 "surface":{"box":[0,0,0,0]},
 "windowSide":"left|right|front|back|none",
 "objects":[{"nameAr":"...","category":"...","box":[0,0,0,0],"heightCm":0,"frequency":"high|medium|low","fragile":false,"confidence":0.9}]}`;
  } else if (isBag) {
    prompt += `المطلوب:
1) دوّر على مرجع القياس: ${scaleRefLabel}. حدد مربعه بدقة عالية جداً.
2) اعمل ليستة بكل حاجة ظاهرة هتترص. الفئات المسموحة: ${BAG_CATS_LIST.join('، ')}

الصيغة:
{"scaleReference":{"found":true,"whatAr":"...","box":[0,0,0,0]},
 "objects":[{"nameAr":"...","category":"...","box":[0,0,0,0],"heightCm":0,"frequency":"high|medium|low","fragile":false,"confidence":0.9}]}`;
  } else {
    const catList = Object.entries(profile.categories).map(([k, v]) => `${k} (${v.labelAr})`).join('، ');
    prompt += `دي صورة ${profile.spaceTypeAr}.

المطلوب:
1) دوّر على مرجع القياس: ${scaleRefLabel}. حدد مربعه بدقة عالية جداً.
2) حدد سطح المساحة بمربع.
3) اعمل ليستة بكل حاجة عليه. الفئات المسموحة: ${catList}
4) الشباك فين بالنسبة للشخص؟

الصيغة:
{"scaleReference":{"found":true,"whatAr":"...","box":[0,0,0,0]},
 "surface":{"box":[0,0,0,0]},
 "windowSide":"left|right|front|back|none",
 "objects":[{"nameAr":"...","category":"...","box":[0,0,0,0],"heightCm":0,"frequency":"high|medium|low","fragile":false,"confidence":0.9}]}`;
  }

  if (intent) prompt += `\n\nصاحب المساحة عايز: "${intent}" — خلي التصنيف والقواعد تخدم الهدف ده.`;

  prompt += `

قواعد مهمة:
- المربعات بصيغة [ymin, xmin, ymax, xmax] بمقياس من 0 لـ 1000.
- الأسماء بالعربي المصري، قصيرة وواضحة.
- متخترعش حاجات مش ظاهرة في الصورة.
- متحاولش تحسب العرض أو العمق بالسنتيمتر — إحنا هنحسبهم من مرجع القياس. قدّر الارتفاع بس.`;

  let json;
  try {
    json = await sample.json(prompt, { images: image.blob, modelTier: 'complex' });
  } catch (err) {
    throw friendlyError(err);
  }

  json.objects = (json.objects || []).filter((o) => Array.isArray(o.box) && o.box.length === 4);
  if (json.profile) json.generatedProfile = profileFromModel(json.profile);
  return json;
}

/** الموديل بيرجّع الفئات كليستة — بنحولها لكائن. التنظيف بيحصل في profiles.js */
export function profileFromModel(raw) {
  if (!raw || !Array.isArray(raw.categories)) return null;
  const categories = {};
  for (const c of raw.categories) {
    if (!c || !c.key) continue;
    const def = { labelAr: c.labelAr, zone: c.zone, side: c.side };
    for (const f of ['tall', 'keepDry', 'avoidLight', 'wantsLight', 'hot', 'screen']) {
      if (c[f] === true) def[f] = true;
    }
    if (c.anchor && c.anchor !== 'none') def.anchor = c.anchor;
    categories[c.key] = def;
  }
  return {
    spaceTypeAr: raw.spaceTypeAr,
    spaceKind: 'surface',
    defaultSizeCm: raw.defaultSizeCm,
    categories,
    tipsAr: raw.tipsAr,
  };
}

/* ═══════════ ٦: التوجيه بالكلام ═══════════ */

export async function adaptProfile({ profile, intent, sample }) {
  const current = Object.entries(profile.categories)
    .map(([k, v]) => `${k} | ${v.labelAr} | ${v.zone} | ${v.side}${v.anchor ? ' | anchor:' + v.anchor : ''}`)
    .join('\n');

  const prompt = `دي قواعد ترتيب "${profile.spaceTypeAr}" الحالية (المفتاح | الاسم | المنطقة | الناحية):

${current}

صاحب المساحة عايز: "${intent}"

عدّل القواعد عشان تخدم اللي هو عايزه. تقدر تنقل فئات لمناطق تانية، تضيف فئات جديدة، أو تغيّر المرساة.
سيب أي فئة اللي هو عايزه مش بيأثر عليها زي ما هي.
${RULES_BRIEF}
حدّث spaceTypeAr لو نوع المساحة اتغير فعلاً، وحط في tipsAr نصيحة أو اتنين مرتبطين باللي طلبه.

رد بـ JSON بس بالصيغة دي:
{"spaceTypeAr":"...","defaultSizeCm":{"width":0,"depth":0},
 "categories":[{"key":"...","labelAr":"...","zone":"...","side":"...","anchor":"...","tall":false,"keepDry":false,"avoidLight":false,"wantsLight":false,"hot":false,"screen":false}],
 "tipsAr":["..."]}`;

  try {
    return profileFromModel(await sample.json(prompt, { modelTier: 'default' }));
  } catch (err) {
    throw friendlyError(err);
  }
}

/* ═══════════ ٢: الشرح بالعامية ═══════════ */

export async function explainPlan({ mode, plan, sample }) {
  const summary = mode === 'bag'
    ? plan.steps.map((s) => `${s.step}. ${s.nameAr} — ${s.positionAr}`).join('\n')
    : plan.placed.map((p) => `${p.nameAr}: ${p.reasonAr}`).join('\n');

  const prompt = `دي نتيجة خوارزمية ${mode === 'bag' ? 'رص شنطة' : 'ترتيب ' + (plan.profileAr || 'مساحة')}:

${summary}
${plan.notes ? '\nملاحظات:\n' + plan.notes.map((n) => n.textAr).join('\n') : ''}

اكتب فقرة قصيرة (٣ لـ ٤ جمل) بالعامية المصرية تشرح منطق الترتيب ده وأهم حاجة يركز عليها.
متكررش الليستة، وميبقاش فيها عناوين ولا نقط. كلام طبيعي زي ما صاحبك بيشرحلك.
متخترعش أرقام أو تفاصيل مش موجودة فوق. رد بالفقرة بس.`;

  const res = await sample(prompt, { modelTier: 'quick' });
  return res.text || '';
}

/* ═══════════ ٧: اسأل عن مساحتك ═══════════ */

export async function askAboutSpace({ question, plan, mode, sample, onText }) {
  const context = mode === 'bag'
    ? `شنطة، ترتيب الرص:\n${plan.steps.map((s) => `${s.step}. ${s.nameAr} — ${s.positionAr}`).join('\n')}` +
      (plan.unplaced?.length ? `\nمدخلش: ${plan.unplaced.map((u) => u.nameAr).join('، ')}` : '')
    : `${plan.profileAr || 'مساحة'} مقاسها ${Math.round(plan.desk.widthCm)}×${Math.round(plan.desk.depthCm)} سم.\n` +
      `اللي عليها:\n${plan.placed.map((p) => `- ${p.nameAr} (${Math.round(p.w)}×${Math.round(p.d)} سم): ${p.reasonAr}`).join('\n')}` +
      (plan.offDesk?.length ? `\nاتشال: ${plan.offDesk.map((o) => o.nameAr).join('، ')}` : '') +
      `\nملاحظات: ${plan.notes.map((n) => n.textAr).join(' | ')}`;

  const prompt = `دي مساحة مستخدم بعد ما الخوارزمية رتبتها:

${context}

سؤاله: "${question}"

جاوبه بالعامية المصرية في ٤ جمل بالكتير، بناءً على المساحة والمقاسات اللي فوق بالظبط.
لو السؤال محتاج معلومة مش موجودة فوق، قوله إنك مش شايفها في الصورة بدل ما تخترع.
كن عملي ومحدد — اقترح حاجة يعملها.`;

  const res = await sample(prompt, { modelTier: 'default', onText, cache: false });
  return res.text || '';
}

/* ═══════════ ٣: صورة "بعد الترتيب" — مش متاحة في نسخة الآرتيفاكت ═══════════ */

export const CAN_RENDER_IMAGE = false;

export async function renderAfterImage() {
  throw new Error('توليد الصور مش متاح في النسخة دي — المخطط المرسوم هو الدقيق أصلاً');
}

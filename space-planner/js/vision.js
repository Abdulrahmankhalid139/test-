/**
 * vision.js — طبقة الذكاء الاصطناعي (Gemini).
 *
 * ٧ مميزات AI:
 *   1) يتعرّف على الحاجات في الصورة ويحدد مكانها
 *   2) يشرح الترتيب بالعامية
 *   3) يرسم صورة "بعد الترتيب"
 *   4) يتعرّف على نوع المساحة (مكتب؟ تسريحة؟ ركن قهوة؟)
 *   5) يولّد قواعد الترتيب للمساحة دي بالذات
 *   6) يعدّل القواعد حسب اللي انت عايزه بالكلام
 *   7) يجاوب على أسئلتك عن مساحتك
 *
 * اللي الموديل ممنوع يعمله:
 *   ✗ ميحسبش المقاسات — الرياضة بتعملها من مرجع القياس
 *   ✗ ميقررش مكان أي حاجة — الخوارزمية بتقرر
 *   ✗ ميخترعش مناطق أو قيود برة المفردات المسموحة — بيتفلتر في profiles.js
 */

// لو جوجل غيّرت أسماء الموديلات، غيّرهم من هنا بس.
export const MODELS = {
  vision: 'gemini-2.5-flash',
  image: 'gemini-2.5-flash-image',
};

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const BAG_CATEGORIES = [
  'laptop', 'electronics', 'camera', 'glass', 'shoes', 'clothes',
  'toiletries', 'book', 'food', 'other',
];

/** المفردات المسموحة للموديل لما يولّد قواعد مساحة. */
const ZONE_ENUM = ['front', 'primary', 'secondary', 'back', 'far'];
const SIDE_ENUM = ['dominant', 'off', 'center', 'any'];
const ANCHOR_ENUM = ['back-center', 'front-center', 'front-dominant', 'none'];

/* ═══════════════ أدوات ═══════════════ */

/** بيصغّر الصورة قبل ما تتبعت — أسرع، وبيوفر من حصتك المجانية. */
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
      resolve({ base64: dataUrl.split(',')[1], dataUrl, width: w, height: h });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('مقدرناش نفتح الصورة دي'));
    };
    img.src = url;
  });
}

async function callGemini(model, body, apiKey) {
  if (!apiKey) throw new Error('محتاج تحط مفتاح Gemini الأول (مجاني من Google AI Studio)');

  let res;
  try {
    res = await fetch(`${API_BASE}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('مفيش اتصال بالإنترنت — أو الشبكة رفضت الطلب');
  }

  if (!res.ok) {
    let detail = '';
    try {
      const err = await res.json();
      detail = err?.error?.message || '';
    } catch { /* الرد مش JSON */ }

    if (res.status === 400 && /API key/i.test(detail)) throw new Error('مفتاح الـAPI غلط — راجعه');
    if (res.status === 403) throw new Error('المفتاح مرفوض. اتأكد إنه مفعّل لـ Generative Language API');
    if (res.status === 404) throw new Error(`الموديل "${model}" مش متاح لمفتاحك. غيّر الاسم من MODELS في vision.js`);
    if (res.status === 429) throw new Error('خلصت حصتك المجانية دلوقتي. استنى شوية وجرب تاني');
    if (res.status >= 500) throw new Error('سيرفر جوجل مضغوط دلوقتي — جرب كمان شوية');
    throw new Error(detail || `الطلب فشل (${res.status})`);
  }

  return res.json();
}

function textOf(response) {
  const parts = response?.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text).filter(Boolean).join('');
}

function extractJson(response) {
  const text = textOf(response);
  if (!text.trim()) {
    const reason = response?.candidates?.[0]?.finishReason;
    throw new Error(reason === 'SAFETY'
      ? 'الموديل رفض يحلل الصورة دي'
      : 'الموديل رجّع رد فاضي — جرب صورة أوضح');
  }
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error('مقدرناش نقرا رد الموديل');
  }
}

/* ═══════════════ المخططات ═══════════════ */

const profileSchema = {
  type: 'OBJECT',
  properties: {
    spaceTypeAr: { type: 'STRING' },
    defaultSizeCm: {
      type: 'OBJECT',
      properties: { width: { type: 'NUMBER' }, depth: { type: 'NUMBER' } },
    },
    categories: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          key: { type: 'STRING' },
          labelAr: { type: 'STRING' },
          zone: { type: 'STRING', enum: ZONE_ENUM },
          side: { type: 'STRING', enum: SIDE_ENUM },
          anchor: { type: 'STRING', enum: ANCHOR_ENUM },
          tall: { type: 'BOOLEAN' },
          keepDry: { type: 'BOOLEAN' },
          avoidLight: { type: 'BOOLEAN' },
          wantsLight: { type: 'BOOLEAN' },
          hot: { type: 'BOOLEAN' },
          screen: { type: 'BOOLEAN' },
        },
        required: ['key', 'labelAr', 'zone', 'side'],
      },
    },
    tipsAr: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['spaceTypeAr', 'categories'],
};

function sceneSchema(withProfile) {
  const properties = {
    scaleReference: {
      type: 'OBJECT',
      properties: {
        found: { type: 'BOOLEAN' },
        whatAr: { type: 'STRING' },
        box: { type: 'ARRAY', items: { type: 'NUMBER' } },
      },
      required: ['found'],
    },
    surface: {
      type: 'OBJECT',
      properties: {
        box: { type: 'ARRAY', items: { type: 'NUMBER' } },
        descriptionAr: { type: 'STRING' },
      },
    },
    windowSide: { type: 'STRING', enum: ['left', 'right', 'front', 'back', 'none'] },
    objects: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          nameAr: { type: 'STRING' },
          category: { type: 'STRING' },
          box: { type: 'ARRAY', items: { type: 'NUMBER' } },
          heightCm: { type: 'NUMBER' },
          frequency: { type: 'STRING', enum: ['high', 'medium', 'low'] },
          fragile: { type: 'BOOLEAN' },
          confidence: { type: 'NUMBER' },
        },
        required: ['nameAr', 'category', 'box', 'heightCm'],
      },
    },
  };
  if (withProfile) properties.profile = profileSchema;
  return { type: 'OBJECT', properties, required: ['scaleReference', 'objects'] };
}

/** الموديل بيرجّع الفئات كليستة (أسهل عليه) — بنحولها لكائن هنا. */
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

/* ═══════════════ ١ + ٤ + ٥: الرؤية وتعرّف المساحة وتوليد القواعد ═══════════════ */

const RULES_BRIEF = `
لو هتولّد قواعد، القواعد بتتكتب بالمفردات دي بس:
- zone: front (قدامه مباشرة) / primary (في متناول إيده) / secondary (مد دراع) / back (في العمق) / far (بعيد)
- side: dominant (ناحية إيده المسيطرة) / off (الناحية التانية) / center (في النص) / any
- anchor: الحاجة الرئيسية اللي المساحة بتتبني حواليها — back-center (اللي بيبص لها زي الشاشة أو المراية)،
  front-center (اللي بيشتغل عليه زي الكيبورد أو تختة التقطيع)، front-dominant (جنب إيده زي الماوس)، أو none.
  كل خانة إرساء تتاخد مرة واحدة بالكتير.
- الأعلام: tall (عالية فممكن تحجب)، keepDry (سايلة)، avoidLight (بتبوظ في الشمس)،
  wantsLight (محتاجة ضو)، hot (بتسخن)، screen (شاشة).
لازم تسيب فئة اسمها other لأي حاجة مش داخلة في تصنيف.
`;

/**
 * بيحلل الصورة. لو مفيش بروفايل محدد، الموديل بيتعرّف على نوع المساحة
 * ويولّد قواعدها. المربعات بترجع [ymin,xmin,ymax,xmax] بمقياس 0..1000.
 */
export async function analyzeScene({ base64, mode, scaleRefLabel, profile, intent, apiKey }) {
  const isBag = mode === 'bag';
  const generateProfile = !isBag && !profile;

  let prompt;
  if (isBag) {
    prompt = `انت مساعد بصري بيحلل صورة حاجات هتترص في شنطة.

مهمتك:
1) دوّر على مرجع القياس: ${scaleRefLabel}. حدد مربعه بدقة عالية جداً — كل الحسابات معتمدة عليه.
2) اعمل ليستة بكل حاجة ظاهرة هتترص، وكل واحدة: nameAr (بالمصري، قصير)، category (من: ${BAG_CATEGORIES.join(', ')})، box، heightCm (تقديرك للارتفاع الحقيقي)، frequency، fragile، confidence.`;
  } else if (generateProfile) {
    prompt = `انت مساعد بيحلل صورة مساحة ويرتّبها.

مهمتك:
1) **حدد المساحة دي إيه بالظبط.** بص على الحاجات اللي عليها والمكان اللي هي فيه.
   مثال: ترابيزة عليها مراية ومكياج = تسريحة، مش مكتب. ترابيزة عليها شاشة وكيبورد = مكتب شغل.
   ترابيزة جنب سرير عليها أباجورة = كومودينو. اكتب الاسم بالمصري في spaceTypeAr.
2) **اكتب قواعد ترتيب المساحة دي** في profile: الفئات اللي بتتحط على النوع ده من المساحات،
   وكل فئة تروح فين وليه. فكّر زي متخصص في المساحة دي — إيه اللي لازم يبقى في متناول الإيد،
   إيه اللي بيبوظ في الشمس، إيه اللي بيسخن، وإيه اللي بيحجب.
   وحط في tipsAr نصيحة أو اتنين عملية ومحددة للنوع ده من المساحات.
${RULES_BRIEF}
3) دوّر على مرجع القياس: ${scaleRefLabel}. حدد مربعه بدقة عالية جداً — كل الحسابات معتمدة عليه.
4) حدد سطح المساحة نفسه بمربع في surface، وقدّر مقاسه الحقيقي في profile.defaultSizeCm.
5) اعمل ليستة بكل حاجة على السطح، وكل واحدة: nameAr، category (لازم تكون key من الفئات اللي انت كتبتها)،
   box، heightCm، frequency، fragile، confidence.
6) windowSide: الشباك أو مصدر الضو الأساسي فين بالنسبة للشخص الواقف/القاعد؟`;
  } else {
    const catList = Object.entries(profile.categories)
      .map(([k, v]) => `${k} (${v.labelAr})`).join('، ');
    prompt = `انت مساعد بصري بيحلل صورة ${profile.spaceTypeAr}.

مهمتك:
1) دوّر على مرجع القياس: ${scaleRefLabel}. حدد مربعه بدقة عالية جداً — كل الحسابات معتمدة عليه.
2) حدد سطح المساحة نفسه بمربع في surface.
3) اعمل ليستة بكل حاجة على السطح، وكل واحدة: nameAr (بالمصري، قصير)، box، heightCm (تقديرك للارتفاع الحقيقي)، frequency، fragile، confidence، و category من دي بس: ${catList}
4) windowSide: الشباك أو مصدر الضو الأساسي فين بالنسبة للشخص؟`;
  }

  if (intent) {
    prompt += `\n\n**اللي صاحب المساحة عايزه منها:** "${intent}"\nخلي التصنيف والقواعد تخدم الهدف ده.`;
  }

  prompt += `

قواعد مهمة:
- المربعات بصيغة [ymin, xmin, ymax, xmax] بمقياس من 0 لـ 1000.
- متخترعش حاجات مش ظاهرة في الصورة.
- متحاولش تحسب العرض أو العمق بالسنتيمتر — إحنا هنحسبهم من مرجع القياس. قدّر الارتفاع بس.`;

  const body = {
    contents: [{
      role: 'user',
      parts: [
        { text: prompt },
        { inlineData: { mimeType: 'image/jpeg', data: base64 } },
      ],
    }],
    generationConfig: {
      temperature: 0.15,
      responseMimeType: 'application/json',
      responseSchema: sceneSchema(generateProfile),
    },
  };

  const json = extractJson(await callGemini(MODELS.vision, body, apiKey));
  json.objects = (json.objects || []).filter((o) => Array.isArray(o.box) && o.box.length === 4);
  if (json.profile) json.generatedProfile = profileFromModel(json.profile);
  return json;
}

/* ═══════════════ ٦: التوجيه بالكلام ═══════════════ */

/**
 * بياخد بروفايل موجود + اللي انت عايزه، ويطلّع بروفايل معدّل.
 * مثال: "عايزة التسريحة دي تبقى ركن مذاكرة كمان".
 */
export async function adaptProfile({ profile, intent, apiKey }) {
  const current = Object.entries(profile.categories)
    .map(([k, v]) => `${k} | ${v.labelAr} | ${v.zone} | ${v.side}${v.anchor ? ' | anchor:' + v.anchor : ''}`)
    .join('\n');

  const prompt = `دي قواعد ترتيب "${profile.spaceTypeAr}" الحالية (المفتاح | الاسم | المنطقة | الناحية):

${current}

صاحب المساحة عايز: "${intent}"

عدّل القواعد عشان تخدم اللي هو عايزه. تقدر تنقل فئات لمناطق تانية، تضيف فئات جديدة، أو تغيّر المرساة.
سيب أي فئة اللي هو عايزه مش بيأثر عليها زي ما هي.
${RULES_BRIEF}
وحدّث spaceTypeAr لو نوع المساحة اتغير فعلاً، وحط في tipsAr نصيحة أو اتنين مرتبطين باللي هو طلبه.`;

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      responseMimeType: 'application/json',
      responseSchema: profileSchema,
    },
  };

  return profileFromModel(extractJson(await callGemini(MODELS.vision, body, apiKey)));
}

/* ═══════════════ ٢: الشرح بالعامية ═══════════════ */

export async function explainPlan({ mode, plan, apiKey }) {
  const summary = mode === 'bag'
    ? plan.steps.map((s) => `${s.step}. ${s.nameAr} — ${s.positionAr}`).join('\n')
    : plan.placed.map((p) => `${p.nameAr}: ${p.reasonAr}`).join('\n');

  const prompt = `دي نتيجة خوارزمية ${mode === 'bag' ? 'رص شنطة' : 'ترتيب ' + (plan.profileAr || 'مساحة')}:

${summary}
${plan.notes ? '\nملاحظات:\n' + plan.notes.map((n) => n.textAr).join('\n') : ''}

اكتب فقرة قصيرة (٣ لـ ٤ جمل) بالعامية المصرية تشرح منطق الترتيب ده وأهم حاجة يركز عليها.
متكررش الليستة، وميبقاش فيها عناوين ولا نقط. كلام طبيعي زي ما صاحبك بيشرحلك.
متخترعش أرقام أو تفاصيل مش موجودة فوق.`;

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.6, maxOutputTokens: 400 },
  };

  return textOf(await callGemini(MODELS.vision, body, apiKey));
}

/* ═══════════════ ٧: اسأل عن مساحتك ═══════════════ */

export async function askAboutSpace({ question, plan, mode, apiKey }) {
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

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.5, maxOutputTokens: 500 },
  };

  return textOf(await callGemini(MODELS.vision, body, apiKey));
}

/* ═══════════════ ٣: صورة "بعد الترتيب" ═══════════════ */

export async function renderAfterImage({ base64, plan, apiKey }) {
  const moves = plan.placed.slice(0, 12).map((p) => `- ${p.nameAr}: ${p.reasonAr}`).join('\n');
  const removed = (plan.offDesk || []).map((p) => p.nameAr).join('، ');

  const prompt = `عدّل الصورة دي عشان تورّي نفس المكان بالظبط بعد الترتيب.

مهم جداً: خلي نفس الأوضة، نفس الأثاث، نفس الحيطة، نفس الإضاءة، ونفس زاوية التصوير.
متخترعش حاجات جديدة ومتغيرش المكان. حرّك الحاجات الموجودة بس.

الترتيب الجديد:
${moves}${removed ? `\n\nشيل من على السطح: ${removed}` : ''}

النتيجة: نفس الصورة بالظبط بس الحاجات اتحركت للأماكن دي، والمساحة مرتبة ونضيفة.`;

  const body = {
    contents: [{
      role: 'user',
      parts: [
        { text: prompt },
        { inlineData: { mimeType: 'image/jpeg', data: base64 } },
      ],
    }],
  };

  const res = await callGemini(MODELS.image, body, apiKey);
  const parts = res?.candidates?.[0]?.content?.parts || [];
  const img = parts.find((p) => p.inlineData?.data);
  if (!img) throw new Error('الموديل مرجعش صورة — جرب تاني أو اكتفي بالمخطط');
  return `data:${img.inlineData.mimeType || 'image/png'};base64,${img.inlineData.data}`;
}

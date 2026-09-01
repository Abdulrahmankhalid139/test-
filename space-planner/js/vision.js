/**
 * vision.js — طبقة الذكاء الاصطناعي (Gemini).
 *
 * دور الموديل هنا محدود عن قصد:
 *   ✅ يتعرّف على الحاجات ويحدد مكانها في الصورة
 *   ✅ يقدّر الارتفاع (مش موجود في صورة مسطحة)
 *   ✅ يكتب الشرح بالعامية
 *   ✅ يرسم صورة "بعد" اختيارية
 *   ❌ ميحسبش المقاسات — الرياضة بتعملها من مرجع القياس
 *   ❌ ميقررش الترتيب — الخوارزمية بتقرر
 *
 * كل الاستدعاءات بتروح من متصفحك لجوجل مباشرة بمفتاحك انت.
 */

// لو جوجل غيّرت أسماء الموديلات، غيّرهم من هنا بس.
export const MODELS = {
  vision: 'gemini-2.5-flash',
  image: 'gemini-2.5-flash-image',
};

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const DESK_CATEGORIES = [
  'monitor', 'laptop', 'keyboard', 'mouse', 'drink', 'phone', 'notebook',
  'pens', 'lamp', 'speaker', 'headphones', 'plant', 'books', 'storage', 'decor', 'other',
];

const BAG_CATEGORIES = [
  'laptop', 'electronics', 'camera', 'glass', 'shoes', 'clothes',
  'toiletries', 'book', 'food', 'other',
];

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

function extractJson(response) {
  const text = response?.candidates?.[0]?.content?.parts
    ?.map((p) => p.text)
    .filter(Boolean)
    .join('') || '';
  if (!text.trim()) {
    const reason = response?.candidates?.[0]?.finishReason;
    throw new Error(reason === 'SAFETY'
      ? 'الموديل رفض يحلل الصورة دي'
      : 'الموديل رجّع رد فاضي — جرب صورة أوضح');
  }
  try {
    return JSON.parse(text);
  } catch {
    // احتياطي: أحياناً بيلف الـJSON في ```json
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error('مقدرناش نقرا رد الموديل');
  }
}

const analysisSchema = (categories) => ({
  type: 'OBJECT',
  properties: {
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
          category: { type: 'STRING', enum: categories },
          box: { type: 'ARRAY', items: { type: 'NUMBER' } },
          heightCm: { type: 'NUMBER' },
          frequency: { type: 'STRING', enum: ['high', 'medium', 'low'] },
          fragile: { type: 'BOOLEAN' },
          confidence: { type: 'NUMBER' },
        },
        required: ['nameAr', 'category', 'box', 'heightCm'],
      },
    },
  },
  required: ['scaleReference', 'objects'],
});

/**
 * بيحلل صورة المكتب أو الشنطة.
 * ملحوظة: المربعات بترجع بمقياس 0..1000 بصيغة [ymin, xmin, ymax, xmax].
 */
export async function analyzeScene({ base64, mode, scaleRefLabel, apiKey }) {
  const isDesk = mode === 'desk';
  const categories = isDesk ? DESK_CATEGORIES : BAG_CATEGORIES;

  const prompt = `انت مساعد بصري بيحلل صورة ${isDesk ? 'مكتب شغل' : 'شنطة وحاجات هتتحط فيها'}.

مهمتك:
1) دوّر على مرجع القياس في الصورة: ${scaleRefLabel}. حدد مربعه بدقة عالية جداً — كل الحسابات معتمدة عليه.
2) حدد ${isDesk ? 'سطح المكتب نفسه' : 'الشنطة نفسها'} بمربع.
3) اعمل ليستة بكل حاجة ${isDesk ? 'على المكتب' : 'ظاهرة هتترص'}، وكل واحدة:
   - nameAr: اسمها بالعربي المصري، قصير وواضح
   - category: من القائمة المسموحة بس
   - box: مربعها في الصورة
   - heightCm: تقديرك لارتفاعها الحقيقي بالسنتيمتر (الصورة مسطحة فده تقدير — قدّر بالمنطق من نوع الحاجة)
   - frequency: بتستخدم قد إيه (high للحاجات اللي بتتمسك كل شوية، low للديكور والتخزين)
   - fragile: هل قابلة للكسر
   - confidence: ثقتك من 0 لـ 1
${isDesk ? '4) windowSide: الشباك أو مصدر الضو الأساسي فين بالنسبة للشخص القاعد؟ left/right/front/back/none' : ''}

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
      temperature: 0.1,
      responseMimeType: 'application/json',
      responseSchema: analysisSchema(categories),
    },
  };

  const json = extractJson(await callGemini(MODELS.vision, body, apiKey));
  json.objects = (json.objects || []).filter((o) => Array.isArray(o.box) && o.box.length === 4);
  return json;
}

/** بيكتب شرح بالعامية للترتيب اللي الخوارزمية طلعته. */
export async function explainPlan({ mode, plan, apiKey }) {
  const summary = mode === 'desk'
    ? plan.placed.map((p) => `${p.nameAr}: ${p.reasonAr}`).join('\n')
    : plan.steps.map((s) => `${s.step}. ${s.nameAr} — ${s.positionAr}`).join('\n');

  const prompt = `دي نتيجة خوارزمية ${mode === 'desk' ? 'ترتيب مكتب' : 'رص شنطة'}:

${summary}

${plan.notes ? 'ملاحظات:\n' + plan.notes.map((n) => n.textAr).join('\n') : ''}

اكتب فقرة قصيرة (٣ لـ ٤ جمل) بالعامية المصرية تشرح للمستخدم منطق الترتيب ده وأهم حاجة يركز عليها.
متكررش الليستة، وميبقاش فيها عناوين ولا نقط. كلام طبيعي زي ما صاحبك بيشرحلك.
متخترعش أرقام أو تفاصيل مش موجودة فوق.`;

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.6, maxOutputTokens: 400 },
  };

  const res = await callGemini(MODELS.vision, body, apiKey);
  return res?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('') || '';
}

/**
 * صورة "بعد الترتيب" — تعديل على صورتك الأصلية، مش رسم من الصفر.
 * بنقولها بالنص تحافظ على نفس المكان والإضاءة عشان متخترعش مكتب تاني.
 */
export async function renderAfterImage({ base64, mode, plan, apiKey }) {
  const moves = (mode === 'desk' ? plan.placed : []).slice(0, 12)
    .map((p) => `- ${p.nameAr}: ${p.reasonAr}`).join('\n');
  const removed = (plan.offDesk || []).map((p) => p.nameAr).join('، ');

  const prompt = `عدّل الصورة دي عشان تورّي نفس المكان بالظبط بعد الترتيب.

مهم جداً: خلي نفس الأوضة، نفس المكتب، نفس الحيطة، نفس الإضاءة، ونفس زاوية التصوير.
متخترعش أثاث جديد ومتغيرش المكان. حرّك الحاجات الموجودة بس.

الترتيب الجديد:
${moves}
${removed ? `\nشيل من على المكتب: ${removed}` : ''}

النتيجة: نفس الصورة بالظبط بس الحاجات اتحركت للأماكن دي، والمكتب مرتب ونضيف.`;

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

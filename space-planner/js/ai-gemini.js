/**
 * ai-gemini.js — الناقل التاني: Gemini بمفتاح API.
 *
 * ليه موجود: قدرة `sample` شغالة جوه claude.ai بس. لو التطبيق هيتحط على
 * أي استضافة تانية (GitHub Pages، Netlify، أي سيرفر) — أو يتلبس كتطبيق
 * حقيقي على الفون — محتاج طريق تاني للموديل. ده هو.
 *
 * الفرق الوحيد إن المستخدم بيجيب مفتاح مجاني من Google AI Studio ويحطه
 * في الإعدادات. المفتاح بيتخزن على جهازه هو بس ومابيروحش لأي حد تاني.
 *
 * الملف ده ناقل بحت: بيلبس Gemini شكل الواجهة اللي ai-core.js بيستنّاها
 * (كائن بيتنده كدالة، وليه .json و.limits)، وبعد كده كل البرومبتات
 * والتحقق بيشتغلوا من نفس المكان بالظبط زي نسخة Claude.
 *
 * ده بالظبط اللي كان ناقص قبل كده: كانت في نسخة تانية من كل برومبت هنا،
 * فكل ميزة جديدة كانت بتتحط في ناحية وتفضل ناقصة في التانية.
 */

import { friendlyError } from './ai-core.js';
import { store } from './store.js';

export {
  analyzeScene, adaptProfile, explainPlan, askAboutSpace,
  profileFromModel, fileToBase64Resized, friendlyError,
} from './ai-core.js';

/** لو جوجل غيّرت أسماء الموديلات، غيّرهم من هنا بس. */
export const MODELS = {
  vision: 'gemini-2.5-flash',
  image: 'gemini-2.5-flash-image',
};

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/** الأخطاء بتتحوّل لأكواد موحّدة عشان friendlyError تفهمها زي أي ناقل. */
function coded(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

async function callGemini(model, body, apiKey) {
  if (!apiKey) throw coded('no_key', 'محتاج تحط مفتاح Gemini الأول (مجاني من Google AI Studio)');

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

    if (res.status === 400 && /API key/i.test(detail)) throw coded('no_key', 'مفتاح الـAPI غلط — راجعه');
    if (res.status === 403) throw coded('no_key', 'المفتاح مرفوض. اتأكد إنه مفعّل لـ Generative Language API');
    if (res.status === 404) throw new Error(`الموديل "${model}" مش متاح لمفتاحك. غيّر الاسم من MODELS`);
    if (res.status === 429) throw coded('rate_limited', 'خلصت حصتك المجانية دلوقتي. استنى شوية وجرب تاني');
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
    throw reason === 'SAFETY'
      ? coded('image_rejected', 'الموديل رفض يحلل الصورة دي')
      : coded('invalid_json', 'الموديل رجّع رد فاضي — جرب صورة أوضح');
  }
  try {
    return JSON.parse(text);
  } catch {
    // الموديل ساعات بيلف الـJSON بكلام أو بعلامات كود — بناخد أول كائن
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]); } catch { /* برضو بايظ */ }
    }
    throw coded('invalid_json', 'مقدرناش نقرا رد الموديل');
  }
}

/** بيبني أجزاء الطلب: النص، ومعاه الصورة لو فيه صورة. */
function partsFor(prompt, images) {
  const parts = [{ text: prompt }];
  const list = Array.isArray(images) ? images : images ? [images] : [];
  for (const im of list) {
    // النواة بتبعت base64 هنا (الـblob بتاع sample مالوش لازمة مع Gemini)
    const data = typeof im === 'string' ? im : im?.base64;
    if (data) parts.push({ inlineData: { mimeType: 'image/jpeg', data } });
  }
  return parts;
}

/**
 * بيرجّع caller بنفس شكل قدرة sample بالظبط.
 * null لو مفيش مفتاح — فالتطبيق بيقول للمستخدم يحطه بدل ما يقع.
 */
export async function aiReady() {
  const apiKey = store.getPrefs().geminiKey;
  if (!apiKey) return null;

  const caller = async (prompt, opts = {}) => {
    const body = { contents: [{ role: 'user', parts: partsFor(prompt, opts.images) }] };
    const res = await callGemini(MODELS.vision, body, apiKey);
    const text = textOf(res);
    // النواة بتقرا res.text، وonText بتاعة البث مالهاش مقابل هنا،
    // فبنندهها مرة واحدة بالنص كامل عشان الواجهة تفضل واحدة.
    if (typeof opts.onText === 'function' && text) opts.onText(text);
    return { text };
  };

  caller.json = async (prompt, opts = {}) => {
    const body = {
      contents: [{ role: 'user', parts: partsFor(prompt, opts.images) }],
      generationConfig: { responseMimeType: 'application/json' },
    };
    return extractJson(await callGemini(MODELS.vision, body, apiKey));
  };

  caller.limits = async () => ({ images: true });
  caller.apiKey = apiKey;
  return caller;
}

/** Gemini بيقبل صور، فالإجابة دايماً أيوة طالما فيه مفتاح. */
export async function canSendImages(caller) {
  return !!caller?.apiKey;
}

/* ═══════════ صورة "بعد الترتيب" — متاحة في النسخة دي بس ═══════════ */

/** الناقل ده محتاج مفتاح — التطبيق بيظهر خانة المفتاح في الإعدادات. */
export const NEEDS_KEY = true;

export const CAN_RENDER_IMAGE = true;

/**
 * الميزة الوحيدة اللي موجودة هنا ومش موجودة في نسخة الآرتيفاكت.
 * الصورة دي للتخيّل بس — المخطط المرسوم من الأرقام هو الدقيق.
 */
export async function renderAfterImage({ image, plan, caller }) {
  const base64 = typeof image === 'string' ? image : image?.base64;
  if (!base64) throw new Error('محتاجين الصورة الأصلية');

  const moves = plan.placed.slice(0, 12).map((p) => `- ${p.nameAr}`).join('\n');
  const removed = (plan.offDesk || []).map((p) => p.nameAr).join('، ');

  const prompt = `عدّل الصورة دي عشان تورّي نفس المكان بالظبط بعد الترتيب.

مهم جداً: خلي نفس الأوضة، نفس الأثاث، نفس الحيطة، نفس الإضاءة، ونفس زاوية التصوير.
متخترعش حاجات جديدة ومتغيرش المكان. حرّك الحاجات الموجودة بس.

الحاجات اللي على السطح:
${moves}${removed ? `\n\nشيل من على السطح: ${removed}` : ''}

النتيجة: نفس الصورة بالظبط بس الحاجات اتحركت لأماكنها الجديدة، والمساحة مرتبة ونضيفة.`;

  const body = {
    contents: [{ role: 'user', parts: partsFor(prompt, base64) }],
  };

  const res = await callGemini(MODELS.image, body, caller?.apiKey || store.getPrefs().geminiKey);
  const parts = res?.candidates?.[0]?.content?.parts || [];
  const img = parts.find((p) => p.inlineData?.data);
  if (!img) throw new Error('الموديل مرجعش صورة — جرب تاني أو اكتفي بالمخطط');
  return `data:${img.inlineData.mimeType || 'image/png'};base64,${img.inlineData.data}`;
}

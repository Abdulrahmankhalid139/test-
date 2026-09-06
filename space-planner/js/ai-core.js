/**
 * ai-core.js — كل كلام الموديل في مكان واحد.
 *
 * ليه الملف ده موجود: كان في نسختين من كل برومبت، واحدة لـClaude وواحدة
 * لـGemini. كل ما نضيف حاجة (الأركان، الوزن، إيد المستخدم) واحدة بس هي
 * اللي بتتحدّث، والتانية بتفضل ورا من غير ما حد ياخد باله. النتيجة إن
 * نسخة Gemini بقت بتبني وتقع وقت التشغيل.
 *
 * دلوقتي البرومبتات هنا مرة واحدة، والملفين التانيين ناقل بس:
 *   ai.js         → قدرة sample بتاعة Artifacts (من غير مفتاح، جوه claude.ai)
 *   ai-gemini.js  → Gemini بمفتاح API (لأي استضافة عادية)
 *
 * الاتنين بيدّوا نفس الواجهة: كائن `caller` بيتنده كدالة للنص،
 * وبـ.json() للـJSON. فالدوال اللي تحت مش عارفة ولا مهتمة مين اللي بيرد.
 *
 * الحدود زي ما هي: الموديل بيشوف ويقترح، والرياضة والخوارزمية بيقرروا.
 */

import { SCALE_REFERENCES } from './geometry.js';

/** الرد بيتكتب باللغة اللي المستخدم مختارها. */
const LANG_NOTE = {
  ar: '',
  en: '\n\nIMPORTANT: write your entire answer in English, not Arabic.',
};

/** التسميات بقت {ar,en} — بناخد العربي للموديل عشان باقي البرومبت عربي. */
const labelOf = (v) => (v && typeof v === 'object' ? v.ar || v.en : v) || '';

const ZONE_ENUM = ['front', 'primary', 'secondary', 'back', 'far'];
const SIDE_ENUM = ['dominant', 'off', 'center', 'any'];
const ANCHOR_ENUM = ['back-center', 'front-center', 'front-dominant', 'none'];

/**
 * كتالوج مراجع القياس اللي التطبيق عنده مقاسها الموثّق.
 * في وضع «لاقيها إنت» بنوري الموديل الليستة دي عشان يرجّع refId منها.
 * هو بيقول «لقيت ده، وده مربعه» — والمقاس بالسنتيمتر بييجي من geometry.js،
 * مش من كلامه، عشان مايعايرش الصورة على رقم مخترع.
 */
const AUTO_REF_CATALOG = Object.values(SCALE_REFERENCES)
  .filter((r) => r.id !== 'custom')
  .map((r) => `${r.id} (${labelOf(r.labelAr)})`)
  .join(' · ');

const BAG_CATS_LIST = [
  'laptop', 'electronics', 'camera', 'glass', 'shoes', 'clothes',
  'toiletries', 'book', 'food', 'other',
];


/**
 * المفردات اللي الموديل مسموح يكتب بيها القواعد.
 *
 * ده مش تنسيق — ده الحد اللي بيخلي قواعد مولّدة بالـAI آمنة: أي كلمة برة
 * الليستة دي بتتفلتر في normalizeProfile قبل ما توصل للخوارزمية.
 */
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

لو المساحة container، الأعلام المهمة بقت: keepUpright (لازم تفضل واقفة) ·
fragile (قابلة للكسر فبتترص فوق) · compressible (لينة فبتتحشر في الفراغات).
والمناطق والنواحي مش مهمة في الحالة دي.
`;

/**
 * بيحوّل خطأ الناقل لجملة المستخدم يفهمها.
 * كل ناقل بيرمي أكواد مختلفة، فبيوحّدها قبل ما يبعتها هنا.
 */
export function friendlyError(err) {
  const code = err?.code;
  if (code === 'not_granted') return new Error('لازم توافق على استخدام Claude عشان الميزة دي تشتغل');
  if (code === 'rate_limited') return new Error('في ضغط دلوقتي — استنى شوية وجرب تاني');
  if (code === 'images_unavailable') return new Error('العرض ده مش بيسمح ببعت صور. استخدم «أدخل الحاجات بنفسك»');
  if (code === 'image_rejected') return new Error('الصورة دي مترفضت — جرب صورة تانية بصيغة JPG');
  if (code === 'invalid_json') return new Error('رد الموديل مكانش مفهوم — جرب تاني');
  if (code === 'no_key') return new Error('محتاج مفتاح API — افتح الإعدادات وحطه');
  if (code === 'cancelled') return new Error('اتلغى');
  return new Error(err?.message || 'حصل خطأ — جرب تاني');
}

/**
 * بيصغّر الصورة قبل ما تتبعت — أسرع وأرخص، ونفس الدقة عملياً.
 *
 * بيرجّع الصيغ التلاتة مع بعض: blob (قدرة sample بتاخده)، base64 (Gemini
 * بياخده)، وdataUrl (للعرض). كده الناقلين مش محتاجين نسخة لكل واحد.
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

/* ═══════════ ١+٤+٥: الرؤية وتعرّف المساحة وتوليد القواعد ═══════════ */

export async function analyzeScene({ image, mode, scaleRefLabel, profile, intent, caller, lang = 'ar', sizeMethod = 'ref', whatIsIt = '', whatToPut = '' }) {
  const isBag = mode === 'bag';
  const generateProfile = !isBag && !profile;
  // في وضع «أنا كاتب المقاس» المسطرة هي المساحة نفسها، فالموديل بيدوّر عليها هي.
  const known = sizeMethod === 'known';
  // في وضع «لاقيها إنت» إحنا مش قايلين له المسطرة إيه — هو اللي بيلاقيها ويسمّيها،
  // وإحنا بنجيب مقاسها من الكتالوج. لو لقى حاجة مش عندنا مقاسها، الأمانة أحسن من رقم مخترع.
  const auto = sizeMethod === 'auto';
  const calibLine = known
    ? `حدد مربع المساحة نفسها (${scaleRefLabel}) بدقة عالية جداً — كل الحسابات معتمدة على المربع ده. وحط في scaleReference نفس المربع.`
    : auto
      ? `دوّر بنفسك في الصورة على أي حاجة مقاسها الحقيقي معروف وثابت (مواصفة قياسية أو حاجة يومية مقاسها معروف).
   اختار أوضحهم وأقربهم للحاجات اللي هتتقاس، وحدد مربعه بدقة عالية جداً — كل الحسابات معتمدة عليه.
   لو طابق واحد من دول حط مفتاحه في refId: ${AUTO_REF_CATALOG}
   لو اللي لقيته مش في الليستة دي، حط refId:"" واكتب اسمه في whatAr.
   متقولش مقاسه بالسنتيمتر — إحنا عندنا المقاس الموثّق، انت قول لقيت إيه وفين بس.
   ولو مفيش في الصورة أي حاجة مقاسها معروف فعلاً، رجّع found:false — ده رد صح ومقبول، متخترعش مرجع.
   وحط في confidence رقم من 0 لـ 1 يقول انت متأكد قد إيه إن ده الحاجة دي فعلاً.`
      : `دوّر على مرجع القياس في الصورة: ${scaleRefLabel}. حدد مربعه بدقة عالية جداً — كل الحسابات معتمدة عليه.`;

  let prompt = `انت بتحلل صورة ${isBag ? 'حاجات هتترص في شنطة' : 'مساحة عشان ترتّبها'}.
رد بـ JSON بس، من غير أي كلام قبله أو بعده.

`;

  if (generateProfile) {
    prompt += `المطلوب:
1) حدد المساحة دي إيه بالظبط، **وهل هي سطح بترتب عليه ولا حاوية بترص جواها**:
   - surface = بترتب حاجات فوقه: مكتب، تسريحة، رف مطبخ، كومودينو، ترابيزة عدة.
   - container = بترص حاجات جواه: شنطة، درج، دولاب، كرتونة، تلاجة، شنطة عربية.
   مثال: ترابيزة عليها مراية ومكياج = تسريحة (surface). درج مفتوح فيه حاجات = درج (container).
2) اكتب قواعد ترتيب النوع ده من المساحات: الفئات اللي بتتحط عليه، وكل فئة تروح فين وليه.
   فكّر زي متخصص: إيه اللي لازم يبقى في متناول الإيد، إيه اللي بيبوظ في الشمس، إيه اللي بيسخن، وإيه اللي بيحجب.
${RULES_BRIEF}
3) ${calibLine}
4) حدد سطح المساحة نفسه بمربع، **وكمان أركانه الأربعة** بالترتيب:
   قدام-شمال، قدام-يمين، ورا-يمين، ورا-شمال (قدام = الناحية القريبة من الكاميرا).
   الأركان دي بترسم المخطط على الصورة نفسها، فخليها على حرف السطح بالظبط.
5) اعمل ليستة بكل حاجة على السطح.
6) الشباك أو مصدر الضو فين بالنسبة للشخص؟

الصيغة:
{"spaceTypeAr":"...","profile":{"spaceTypeAr":"...","spaceKind":"surface|container","defaultSizeCm":{"width":0,"depth":0,"height":0},
 "categories":[{"key":"...","labelAr":"...","zone":"...","side":"...","anchor":"...","tall":false,"keepDry":false,"avoidLight":false,"wantsLight":false,"hot":false,"screen":false,"keepUpright":false,"compressible":false}],
 "tipsAr":["..."]},
 "scaleReference":{"found":true,"refId":"","whatAr":"...","box":[0,0,0,0],"confidence":0.9},
 "surface":{"box":[0,0,0,0],"corners":[[0,0],[0,0],[0,0],[0,0]]},
 "windowSide":"left|right|front|back|none",
 "spaceEmpty":false,
 "spaceSizeCm":{"width":0,"depth":0,"height":0},
 "dominantHand":"right|left|unknown",
 "objects":[{"nameAr":"...","category":"...","box":[0,0,0,0],"heightCm":0,"frequency":"high|medium|low","fragile":false,"confidence":0.9}]}`;
  } else if (isBag) {
    prompt += `المطلوب:
1) ${calibLine}
2) حدد مربع الحاوية نفسها (الشنطة/الدرج/الرف) لو ظاهرة، وأركانها الأربعة لو باينة.
3) اعمل ليستة بكل حاجة ظاهرة هتترص. الفئات المسموحة: ${BAG_CATS_LIST.join('، ')}
4) قدّر وزن كل حاجة بالكيلوجرام في weightKg — تقدير تقريبي معقول لنوعها ومقاسها.
   ده الرقم الوحيد اللي إحنا مش بنحسبه، وحد وزن شركة الطيران بيتبني عليه، فخليه واقعي.

الصيغة:
{"scaleReference":{"found":true,"refId":"","whatAr":"...","box":[0,0,0,0],"confidence":0.9},
 "surface":{"box":[0,0,0,0],"corners":[[0,0],[0,0],[0,0],[0,0]]},
 "dominantHand":"right|left|unknown",
 "spaceEmpty":false,
 "spaceSizeCm":{"width":0,"depth":0,"height":0},
 "objects":[{"nameAr":"...","category":"...","box":[0,0,0,0],"heightCm":0,"weightKg":0,"frequency":"high|medium|low","fragile":false,"confidence":0.9}]}`;
  } else {
    const catList = Object.entries(profile.categories).map(([k, v]) => `${k} (${v.labelAr})`).join('، ');
    prompt += `دي صورة ${profile.spaceTypeAr}.

المطلوب:
1) ${calibLine}
2) حدد سطح المساحة بمربع، **وكمان أركانه الأربعة** بالترتيب:
   قدام-شمال، قدام-يمين، ورا-يمين، ورا-شمال (قدام = الناحية القريبة من الكاميرا).
3) اعمل ليستة بكل حاجة عليه. الفئات المسموحة: ${catList}
4) الشباك فين بالنسبة للشخص؟

الصيغة:
{"scaleReference":{"found":true,"refId":"","whatAr":"...","box":[0,0,0,0],"confidence":0.9},
 "surface":{"box":[0,0,0,0],"corners":[[0,0],[0,0],[0,0],[0,0]]},
 "windowSide":"left|right|front|back|none",
 "spaceEmpty":false,
 "spaceSizeCm":{"width":0,"depth":0,"height":0},
 "dominantHand":"right|left|unknown",
 "objects":[{"nameAr":"...","category":"...","box":[0,0,0,0],"heightCm":0,"frequency":"high|medium|low","fragile":false,"confidence":0.9}]}`;
  }

  if (intent) prompt += `\n\nصاحب المساحة عايز: "${intent}" — خلي التصنيف والقواعد تخدم الهدف ده.`;

  // المستخدم جاوب على السؤالين. ده مش تأكيد لكلامك — ده معلومة إنت مش
  // شايفها: هو واقف قدام الحاجة وإنت شايف صورة. لو كلامه خالف اللي
  // شايفه، كلامه هو الصح.
  if (whatIsIt) prompt += `\n\nصاحب المساحة بيقول إن دي: "${whatIsIt}". صدّقه — هو شايفها وإنت لأ.`;
  if (whatToPut) {
    prompt += `\n\nوعايز يحط فيها: "${whatToPut}". اطلع كل حاجة قالها كصف في objects` +
      ` بمقاسها التقريبي بالسنتيمتر، حتى لو مش ظاهرة في الصورة — دي حاجات ناوي يحطها مش موجودة دلوقتي.`;
  }

  prompt += `

قواعد مهمة:
- المربعات بصيغة [ymin, xmin, ymax, xmax] بمقياس من 0 لـ 1000.
- الأسماء ${lang === 'en' ? 'بالإنجليزي' : 'بالعربي المصري'}، قصيرة وواضحة.
- متخترعش حاجات مش ظاهرة في الصورة.
- **قدّر مقاس المساحة بالسنتيمتر في spaceSizeCm دايماً**، سواء لقيت مرجع قياس
  أو لأ. لو مفيش مرجع، خمّن من نوع الحاجة نفسها وشكلها ونسبتها لأي حاجة
  حواليها. تقدير معقول أنفع بكتير من لا حاجة — المستخدم هيصححه بسهولة.
- **المساحة الفاضية رد صح ومقبول.** لو المساحة مفيهاش حاجات (سلة فاضية، درج
  فاضي، مكتب مولّع)، رجّع objects قايمة فاضية [] وحط spaceEmpty:true.
  متخترعش حاجات عشان تملى القايمة — المستخدم ساعتها بيسأل «إيه اللي يدخل هنا؟»
  مش «رتّبلي اللي موجود»، وده سؤال مختلف بس مشروع بنفس القدر.
- لو المساحة فاضية، قدّر مقاسها الحقيقي بالسنتيمتر في spaceSizeCm بقد ما تقدر
  من شكلها ونوعها (سلة مكتب، درج، رف). ده تقدير للاسترشاد بس والمستخدم هيصححه.
- متحاولش تحسب العرض أو العمق بالسنتيمتر — إحنا هنحسبهم من مرجع القياس. قدّر الارتفاع بس.
- dominantHand: استنتج من الصورة نفسها الشخص بيستخدم أنهي إيد. الأدلة: الماوس على أنهي ناحية،
  الحاجات مكوّمة ناحية مين، النوتة أو الكوباية على أنهي جنب من الكيبورد، الأباجورة على عكس إيد الكتابة.
  لو الأدلة مش واضحة رجّع "unknown" — ده أحسن بكتير من تخمين، لأن الترتيب كله بينقلب عليه.${LANG_NOTE[lang]}`;

  let json;
  try {
    json = await caller.json(prompt, { images: image.blob || image.base64, modelTier: 'complex' });
  } catch (err) {
    throw friendlyError(err);
  }

  json.objects = (json.objects || []).filter((o) => Array.isArray(o.box) && o.box.length === 4);
  if (json.profile) json.generatedProfile = profileFromModel(json.profile);
  return json;
}

/* ═══════════ الوصف بالكلام — بديل كامل للصورة ═══════════ */

/**
 * بيفهم المساحة من جملة بالعامية بدل ما يشوفها.
 *
 * ليه ده موجود: فيه عروض مش بتسمح ببعت صور خالص (قيد من المنصة، مش من
 * التطبيق). ساعتها الصورة بتقف، لكن السؤال نفسه — «المساحة دي يدخلها إيه
 * وأرتبه إزاي؟» — مالوش دعوة بالصورة أصلاً. الوصف بالكلام بيدّي نفس
 * المدخلات اللي الصورة بتدّيها: نوع المساحة، مقاسها، واللي جواها.
 *
 * وبيفضل نفس الحد: الموديل بيفهم ويقدّر، والخوارزمية هي اللي بترتّب.
 * كل رقم بيرجع منه بيتقصّ في app.js قبل ما يوصل لأي حسبة.
 */
export async function describeSpace({ text, caller, lang = 'ar', profile = null }) {
  const catLine = profile
    ? `الفئات المسموحة: ${Object.entries(profile.categories).map(([k, v]) => `${k} (${labelOf(v.labelAr)})`).join('، ')}`
    : 'اختار مفاتيح فئات مناسبة للمساحة دي بنفسك.';

  const prompt = `المستخدم بيوصف مساحة بالكلام عشان ترتّبهاله. مشوفتش صورة — الوصف ده هو كل اللي عندك.

كلامه: "${text}"

المطلوب:
1) المساحة دي إيه، وهل هي **سطح بترتب عليه** ولا **حاوية بترص جواها**؟
   surface = بترتب فوقه (مكتب، تسريحة، رف، ترابيزة).
   container = بترص جواه (سلة، درج، شنطة، كرتونة، تلاجة).
2) مقاسها بالسنتيمتر. لو قال المقاس استخدمه زي ما هو. لو قال تقريب
   («حوالي شبر»، «صغيرة») قدّر رقم معقول لنوع المساحة ده.
3) اكتب قواعد ترتيب النوع ده.
${RULES_BRIEF}
4) اطلع كل حاجة قال إنه عايز يحطها، كل واحدة صف لوحدها بمقاسها التقريبي
   بالسنتيمتر ووزنها بالكيلو. لو قال حاجة بالجمع («أقلام») اعملها صف واحد
   بمقاس المجموعة مع بعض. **متزوّدش حاجات هو مقالهاش.**
   ${catLine}
5) لو مقالش عايز يحط إيه، سيب items فاضية — ده رد صح.

رد بـJSON بس:
{"profile":{"spaceTypeAr":"...","spaceKind":"surface|container","defaultSizeCm":{"width":0,"depth":0,"height":0},
 "categories":[{"key":"...","labelAr":"...","zone":"...","side":"...","anchor":"...","tall":false,"keepDry":false,"avoidLight":false,"wantsLight":false,"hot":false,"screen":false,"keepUpright":false,"compressible":false}],
 "tipsAr":["..."]},
 "sizeCm":{"width":0,"depth":0,"height":0},
 "sizeFromUser":true,
 "items":[{"nameAr":"...","category":"...","widthCm":0,"depthCm":0,"heightCm":0,"weightKg":0,"frequency":"high|medium|low","fragile":false}]}

قواعد:
- الأسماء ${lang === 'en' ? 'بالإنجليزي' : 'بالعربي المصري'}، قصيرة.
- sizeFromUser: true لو هو اللي قال المقاس، false لو إنت اللي قدّرته.
- متخترعش تفاصيل هو مقالهاش.${LANG_NOTE[lang]}`;

  let json;
  try {
    json = await caller.json(prompt, { modelTier: 'complex' });
  } catch (err) {
    throw friendlyError(err);
  }

  json.items = Array.isArray(json.items) ? json.items : [];
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
    for (const f of ['tall', 'keepDry', 'avoidLight', 'wantsLight', 'hot', 'screen', 'keepUpright', 'compressible']) {
      if (c[f] === true) def[f] = true;
    }
    if (c.anchor && c.anchor !== 'none') def.anchor = c.anchor;
    categories[c.key] = def;
  }
  return {
    spaceTypeAr: raw.spaceTypeAr,
    spaceKind: raw.spaceKind === 'container' ? 'container' : 'surface',
    defaultSizeCm: raw.defaultSizeCm,
    categories,
    tipsAr: raw.tipsAr,
  };
}

/* ═══════════ ٦: التوجيه بالكلام ═══════════ */

export async function adaptProfile({ profile, intent, caller, lang = 'ar' }) {
  const current = Object.entries(profile.categories)
    .map(([k, v]) => `${k} | ${labelOf(v.labelAr)} | ${v.zone} | ${v.side}${v.anchor ? ' | anchor:' + v.anchor : ''}`)
    .join('\n');

  const prompt = `دي قواعد ترتيب "${labelOf(profile.spaceTypeAr)}" الحالية (المفتاح | الاسم | المنطقة | الناحية):

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
    return profileFromModel(await caller.json(prompt, { modelTier: 'default' }));
  } catch (err) {
    throw friendlyError(err);
  }
}

/* ═══════════ ٢: الشرح بالعامية ═══════════ */

export async function explainPlan({ mode, plan, caller, lang = 'ar', summary = '' }) {
  // الملخص بييجي مترجم جاهز من app.js — عنده المترجم، والنواة لأ.
  // قبل كده كانت النواة بتقرا حقل positionAr مش موجود، فكلمة undefined
  // كانت بتتبعت للموديل وبيرددها للمستخدم في الشرح.
  const lines = summary || (mode === 'bag'
    ? (plan.steps || []).map((s) => `${s.step}. ${s.nameAr}`).join('\n')
    : (plan.placed || []).map((p) => p.nameAr).join('، '));

  const prompt = `دي نتيجة خوارزمية ${mode === 'bag' ? 'رص شنطة' : 'ترتيب مساحة'}:

${lines}


اكتب فقرة قصيرة (٣ لـ ٤ جمل) بالعامية المصرية تشرح منطق الترتيب ده وأهم حاجة يركز عليها.
متكررش الليستة، وميبقاش فيها عناوين ولا نقط. كلام طبيعي زي ما صاحبك بيشرحلك.
متخترعش أرقام أو تفاصيل مش موجودة فوق. رد بالفقرة بس.${LANG_NOTE[lang]}`;

  const res = await caller(prompt, { modelTier: 'quick' });
  return res.text || '';
}

/* ═══════════ ٧: اسأل عن مساحتك ═══════════ */

export async function askAboutSpace({ question, plan, mode, caller, onText, lang = 'ar' }) {
  const context = mode === 'bag'
    ? `شنطة، ترتيب الرص:\n${plan.steps.map((s) => `${s.step}. ${s.nameAr}`).join('\n')}` +
      (plan.unplaced?.length ? `\nمدخلش: ${plan.unplaced.map((u) => u.nameAr).join('، ')}` : '')
    : `مساحة مقاسها ${Math.round(plan.desk.widthCm)}×${Math.round(plan.desk.depthCm)} سم.\n` +
      `اللي عليها:\n${plan.placed.map((p) => `- ${p.nameAr} (${Math.round(p.w)}×${Math.round(p.d)} سم، على بُعد ${Math.round(Math.hypot(p.x + p.w / 2 - plan.desk.seatXCm, p.y + p.d / 2 + 5))} سم من الشخص)`).join('\n')}` +
      (plan.offDesk?.length ? `\nاتشال: ${plan.offDesk.map((o) => o.nameAr).join('، ')}` : '');

  const prompt = `دي مساحة مستخدم بعد ما الخوارزمية رتبتها:

${context}

سؤاله: "${question}"

جاوبه بالعامية المصرية في ٤ جمل بالكتير، بناءً على المساحة والمقاسات اللي فوق بالظبط.
لو السؤال محتاج معلومة مش موجودة فوق، قوله إنك مش شايفها في الصورة بدل ما تخترع.
كن عملي ومحدد — اقترح حاجة يعملها.${LANG_NOTE[lang]}`;

  const res = await caller(prompt, { modelTier: 'default', onText, cache: false });
  return res.text || '';
}


/**
 * app.js — الربط بين الكاميرا، الذكاء، الحساب، والرسم.
 */
import { SCALE_REFERENCES, SIZE_COMPARISONS, nearestComparison, normalizeBox, computeScale, boxToCm, perspectiveCorrect, scaleConfidence, round1 } from './geometry.js';
import { pack3D, packingOrder } from './packing.js';
import { layoutSurface, tryFit } from './surface.js';
import { renderPhotoOverlay, imageToPlan, hitTest } from './overlay.js';
import { validCorners, cornersFromBox } from './homography.js';
import { startEditing, select as selectItem, moveTo, swap, removeItem, restoreItem, undo as undoEdit, reset as resetLayout, verdict, CONTAINER_EDIT_PROFILE } from './edit.js';
import { planSpaces, moveSummary, COMPANION_SUGGESTIONS } from './multispace.js';
import { renderDeskPlan, renderBagPlan, renderLegend } from './render.js';
import { aiReady, canSendImages, analyzeScene, describeSpace, adaptProfile, explainPlan, askAboutSpace, renderAfterImage, fileToBase64Resized, CAN_RENDER_IMAGE, NEEDS_KEY } from './ai.js';
import { BUILT_IN_PROFILES, GENERIC_PROFILE, GENERIC_CONTAINER, normalizeProfile, profileOptions, getProfile, isContainer, ZONES } from './profiles.js';
import { CABIN_BAGS, BAG_CATEGORIES } from '../data/bags.js';
import { store } from './store.js';
import { t, tx, tr, getLang, setLang, initLang } from './i18n.js';

const FREQ_KEYS = { high: 'freqHigh', medium: 'freqMedium', low: 'freqLow' };

const state = {
  // مفيش اختيار وضع: نوع المساحة بيتحدد من البروفايل نفسه.
  // spaceKind: 'surface' → مرتّب الأسطح · 'container' → الرص ثلاثي الأبعاد
  profile: null,
  image: null,
  items: [],
  scale: null,
  surface: { widthCm: 140, depthCm: 70, heightCm: 30 },
  // المقاس اللي المستخدم كتبه بنفسه — بيغلب أي تقدير من الصورة أو من البروفايل
  userSize: null,
  // حد الوزن بييجي من مقاس شركة الطيران لو اتختار
  maxWeightKg: 0,
  airlineId: '',
  plan: null,
  bin: null,
  // أركان السطح في الصورة — بيها بنرسم المخطط على الصورة نفسها
  corners: null,
  cornersApprox: false,
  // الأركان دي المستخدم حطها بإيده؟ الرسالة تحت الصورة بتتغير على أساسها
  cornersManual: false,
  // وضع التحريك: اللمس على الصورة مايعملش حاجة غير لما المستخدم يفتحه
  moveMode: false,
  // حالة التعديل اليدوي، وبتتعمل أول ما المستخدم يفتح وضع التعديل
  edit: null,
  view: 'plan',
  // المساحات المكمّلة اللي المستخدم ضافها (درج، رف...)
  extraSpaces: [],
  // المساحة اتصوّرت وهي فاضية — السؤال بقى «إيه اللي يدخل؟» مش «رتّب اللي موجود»
  // المقاس تخمين مش قياس — بنقوله للمستخدم ونديله طريقة يصلحه بالمقارنة
  sizeIsGuess: false,
  emptySpace: false,
  emptySource: 'photo',
  emptyEstimate: null,
  // إيد المستخدم اللي الموديل استنتجها من الصورة — null يعني اختياره هو اللي ساري
  handDetected: null,
  // إحنا اللي عدّينا المراجعة؟ الشريط في شاشة النتيجة بيتعلق على ده
  autoAccepted: false,
  // مصدر المقاس متخزن كوصف مش كجملة جاهزة — عشان تبديل اللغة يعيد كتابة
  // البانر زي أي حاجة تانية في الشاشة بدل ما يفضل باللغة القديمة
  scaleInfo: null,
};

/**
 * عتبة تخطي المراجعة.
 *
 * الثقة الإجمالية = ثقة القياس × متوسط ثقة الموديل في الحاجات × (0.85 لو المرجع تقريبي).
 * اخترنا 0.8 لأن أصغر خصم في scaleConfidence هو 0.2 — يعني أي عيب في المرجع
 * (صغير في الصورة أو متصوّر بزاوية مايلة) بينزّل الحاصل تحت العتبة على طول.
 * والمرجع التقريبي بيتضرب في 0.85 فوحده كفاية إنه يمنع التخطي مهما كان الباقي.
 * النتيجة: مبنعديش المراجعة غير لما المرجع قياسي وظاهر كويس والموديل واثق
 * في كل حاجة شافها (متوسط ≥ 0.8) — وأي حاجة ثقتها تحت 0.5 بتوقّف التخطي لوحدها،
 * لأن دي بالظبط اللي الواجهة بتعلّمها conf-low عشان المستخدم يبص عليها.
 */
const AUTO_SKIP_THRESHOLD = 0.8;

/** إعداد التخطي — الافتراضي شغال، والقراية بـ !== false عشان التفضيلات القديمة. */
const autoSkipOn = () => store.getPrefs().autoSkip !== false;

function overallConfidence({ scaleScore, approxRef, items }) {
  if (!items.length) return 0;
  const mean = items.reduce((sum, i) => sum + i.confidence, 0) / items.length;
  if (Math.min(...items.map((i) => i.confidence)) < 0.5) return 0;
  return scaleScore * mean * (approxRef ? 0.85 : 1);
}

/** الوضع مشتق: مفيش حالة منفصلة تتعارض مع البروفايل. */
const isBag = () => isContainer(state.profile);

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

/* ═══════════ أدوات واجهة ═══════════ */
function showScreen(name) {
  $$('.screen').forEach((s) => s.classList.toggle('active', s.dataset.screen === name));
  syncActionBar(name);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * الإجراء الأساسي بيفضل ثابت تحت زي أي تطبيق موبايل، وبيتغير حسب الشاشة:
 * التصوير → «حلّل» و«أدخل يدوي» · المراجعة → «احسب» · النتيجة → مفيش.
 */
function syncActionBar(screen) {
  const onCapture = screen === 'capture';
  const onReview = screen === 'review';
  $('#btnAnalyze').classList.toggle('hidden', !onCapture);
  $('#btnManual').classList.toggle('hidden', !onCapture);
  $('#btnPlan').classList.toggle('hidden', !onReview);
  $('#actionbar').classList.toggle('hidden', !onCapture && !onReview);
}
function toast(msg, ms = 3600) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add('hidden'), ms);
}
function loading(on, text = '') {
  $('#loaderText').textContent = text;
  $('#loader').classList.toggle('hidden', !on);
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

/** بيمشي على كل عنصر موسوم ويحط النص باللغة الحالية. */
function applyLang() {
  document.title = t('appName');
  for (const el of $$('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of $$('[data-i18n-html]')) el.innerHTML = t(el.dataset.i18nHtml);
  for (const el of $$('[data-i18n-ph]')) el.placeholder = t(el.dataset.i18nPh);
  $('#btnLang').textContent = getLang() === 'ar' ? 'EN' : 'ع';
  $('#btnLang').title = t('switchTo');

  // نوع المساحة بيبدأ دايماً «اكتشف تلقائياً» — مش بيتخزن من مرة للتانية
  const keepType = $('#spaceType').value;
  $('#spaceType').innerHTML =
    `<option value="auto">${esc(t('autoDetect'))}</option>` +
    profileOptions().map((g) => `<optgroup label="${esc(t(g.group))}">${
      g.items.map((p) => `<option value="${p.id}">${esc(tx(p.labelAr))}</option>`).join('')
    }</optgroup>`).join('');
  $('#spaceType').value = keepType || 'auto';
  updateHints();

  syncGo();

  // اللي معروض دلوقتي يتعاد رسمه باللغة الجديدة
  renderScaleBanner();
  if (state.profile) renderDetectedSpace();
  if (state.items.length) renderItems();
  if (state.plan) (isBag() ? renderBagResult : renderDeskResult)();
}

function updateHints() { /* مفيش تلميحات على شاشة التصوير بعد التبسيط */ }

/**
 * بيكتب بانر المقاس من state.scaleInfo.
 * الرقم اتحسب مرة واحدة، والجملة بتتكتب كل مرة — فتبديل اللغة مبيغيّرش أي حساب.
 */
function renderScaleBanner() {
  const el = $('#scaleBanner');
  const info = state.scaleInfo;
  if (!info) { el.className = 'banner'; el.textContent = ''; return; }

  if (info.kind === 'manual') {
    el.className = 'banner warn';
    el.textContent = t('b_manual');
    return;
  }
  if (info.kind === 'known') {
    el.className = 'banner ok';
    el.textContent = t('b_known', { w: info.widthCm, d: info.depthCm });
    return;
  }

  // مساحة فاضية: مفيش مرجع ومش محتاجينه. بنقول ده صراحة بدل ما نسيب
  // المستخدم يفتكر إن حاجة وقعت.
  if (info.kind === 'guessed') {
    el.className = 'banner warn';
    el.textContent = t('b_guessed');
    return;
  }
  if (info.kind === 'described') {
    el.className = 'banner ok';
    el.textContent = t('b_described');
    return;
  }
  if (info.kind === 'empty') {
    el.className = 'banner ok';
    el.textContent = t('b_empty');
    return;
  }

  const ref = SCALE_REFERENCES[info.refId];
  const level = t(info.score > 0.75 ? 'conf_high' : info.score > 0.45 ? 'conf_mid' : 'conf_low');
  el.className = `banner ${info.score > 0.45 ? 'ok' : 'warn'}`;
  // «لاقيها إنت»: بنقول إن الموديل هو اللي اختار المرجع، وهل ده مقاس
  // قياسي موثّق ولا حاجة يومية تقريبية — عشان يعرف يثق في الرقم قد إيه.
  el.innerHTML = info.kind === 'auto'
    ? t('b_scaleAuto', {
      what: esc(tx(ref.labelAr)),
      kind: t(ref.approx ? 'refApprox' : 'refExact'),
      level,
    })
    : info.score > 0.45
      ? t('b_scaleOk', { what: esc(info.whatAr || (ref ? tx(ref.labelAr) : t('scaleRef'))), level })
      : t('b_scaleWarn', { level });
}

/* ═══════════ التهيئة ═══════════ */
function init() {
  initLang();
  const prefs = store.getPrefs();
  applyLang();
  $('#dominantHand').value = prefs.dominantHand || 'right';
  // «لاقيها إنت» هي الافتراضي — أقل خطوة على المستخدم
  $('#optAutoSkip').checked = autoSkipOn();
  syncActionBar('capture');
  renderSaved();

  $('#btnLang').addEventListener('click', () => {
    setLang(getLang() === 'ar' ? 'en' : 'ar');
    applyLang();
  });

  $$('[data-goto]').forEach((b) => b.addEventListener('click', () => showScreen(b.dataset.goto)));
  $('#btnPick').addEventListener('click', () => $('#fileInput').click());
  $('#whatInput').addEventListener('input', syncGo);
  $('#putInput').addEventListener('input', syncGo);
  syncGo();
  $('#fileInput').addEventListener('change', onFilePicked);
  $('#btnAnalyze').addEventListener('click', onAnalyze);
  $('#btnManual').addEventListener('click', onManual);
  $('#spaceType').addEventListener('change', updateHints);
  $('#btnChangeSpace').addEventListener('click', () => $('#changeSpaceWrap').classList.toggle('hidden'));
  $('#btnAdapt').addEventListener('click', onAdaptProfile);
  $('#btnAsk').addEventListener('click', onAsk);
  $('#btnAddItem').addEventListener('click', () => { addItem(); renderItems(); });
  // الضغط على «احسب» بإيده معناها إنه راجع بنفسه — الشريط مالوش لازمة وقتها
  $('#btnPlan').addEventListener('click', () => { state.autoAccepted = false; onPlan(); });
  $('#btnOpenReview').addEventListener('click', () => {
    $('#autoSkipBar').classList.add('hidden');
    showScreen('review');
  });
  $('#btnDismissSkip').addEventListener('click', () => $('#autoSkipBar').classList.add('hidden'));
  $('#optAutoSkip').addEventListener('change', () => store.setPrefs({ autoSkip: $('#optAutoSkip').checked }));
  $('#btnAfterImage').addEventListener('click', onAfterImage);
  $('#btnSave').addEventListener('click', onSave);

  $('#photoOverlay').addEventListener('click', onOverlayTap);
  setupCornerDrag();
  $('#btnMoveMode').addEventListener('click', toggleMoveMode);
  $('#btnRemoveItem').addEventListener('click', onRemoveSelected);
  $('#btnSaveEdit').addEventListener('click', onSaveEdit);
  $('#btnUndo').addEventListener('click', onUndoMove);
  $('#btnResetLayout').addEventListener('click', onResetLayout);
  $('#btnFitAsk').addEventListener('click', onFitAsk);
  $('#btnFitCheck').addEventListener('click', onFitCheck);
  $('#btnAddSpace').addEventListener('click', onAddSpace);
  $('#spacesList').addEventListener('input', (e) => {
    const row = e.target.closest('[data-space]');
    const f = e.target.dataset.sf;
    if (!row || !f) return;
    state.extraSpaces[+row.dataset.space].size[f] = Number(e.target.value) || 0;
    runSpaces();
  });
  $('#spacesList').addEventListener('click', (e) => {
    const i = e.target.dataset.dropspace;
    if (i === undefined) return;
    state.extraSpaces.splice(+i, 1);
    renderSpaces();
    runSpaces();
  });

  // خانة المفتاح بتظهر بس في النسخة اللي محتاجاه — نسخة الآرتيفاكت مش محتاجة
  $('#keyWrap').classList.toggle('hidden', !NEEDS_KEY);
  $('#apiKey').value = store.getPrefs().geminiKey || '';
  $('#apiKey').addEventListener('change', () => store.setPrefs({ geminiKey: $('#apiKey').value.trim() }));

  $('#btnSettings').addEventListener('click', () => $('#settingsDialog').showModal());
  setupInstall();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* بيشتغل عادي من غيره */ });
  }
}

/**
 * زر «حلّل» بيشتغل بصورة **أو** بإجابة على أي سؤال.
 *
 * قبل كده كان مربوط بالصورة بس، فاللي عايز يوصف مساحته بالكلام من غير
 * صورة كان بيلاقي الزر مقفول من غير سبب ظاهر — رغم إن الكلام لوحده
 * كافي تماماً للترتيب.
 */
function syncGo() {
  const answered = !!($('#whatInput').value.trim() || $('#putInput').value.trim());
  $('#btnAnalyze').disabled = !state.image && !answered;
  $('#btnAnalyze').textContent = t(state.image ? 'analyze' : 'analyzeWords');
}

/* ═══════════ الصورة ═══════════ */
async function onFilePicked(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const img = await fileToBase64Resized(file);
    state.image = img;
    $('#previewImg').src = img.dataUrl;
    $('#preview').classList.remove('hidden');
    syncGo();
  } catch (err) {
    toast(err.message);
  }
}

/* ═══════════ التحليل ═══════════ */

/**
 * الصورة بتتقبل دايماً.
 *
 * قبل كده كان فيه خمس نقط ممكن ترفض الصورة: مرجع القياس مالقهوش، المرجع
 * مش في الكتالوج، مفيش حاجات، المقاس مكتوبش... كل واحدة فيهم كانت
 * منطقية لوحدها، ومع بعض كانوا بيرفضوا الصورة اللي المستخدم صوّرها فعلاً.
 *
 * دلوقتي مفيش رفض. الموديل بيشوف اللي يقدر يشوفه، وبيقدّر المقاس، وأي
 * حاجة ناقصة بتتسأل في الشاشة اللي بعدها بمقارنة («قد علبة مناديل»)
 * مش بمسطرة. الرقم اللي بييجي من المرجع أدق، فبناخده لو لقيناه —
 * لكن غيابه مش سبب نوقّف بيه حد.
 */
async function onAnalyze() {
  const caller = await aiReady();
  if (!caller) return toast(t('t_noAIphoto'));
  // مفيش صورة؟ يبقى إجاباته هي المدخل — مش رسالة خطأ.
  if (!state.image) return onDescribeFromAnswers(caller);
  if (!(await canSendImages(caller))) {
    // العرض ده ممنوع منه الصور (قيد من المنصة). كلام المستخدم كافي لوحده.
    // بس رسالة واحدة: لو مجاوبش، الرسالة تقول السببين مع بعض بدل ما
    // التوست التاني يمسح الأول قبل ما يقراه.
    return onDescribeFromAnswers(caller, t('t_noImages'));
  }

  const whatIsIt = $('#whatInput').value.trim();
  const whatToPut = $('#putInput').value.trim();
  store.setPrefs({ dominantHand: $('#dominantHand').value });

  loading(true, t('t_analyzing'));
  try {
    const chosen = $('#spaceType').value;
    const intent = $('#intent').value.trim();
    const chosenProfile = chosen !== 'auto' ? getProfile(chosen) : null;

    const analysis = await analyzeScene({
      image: state.image,
      mode: chosenProfile && isContainer(chosenProfile) ? 'bag' : 'surface',
      scaleRefLabel: '',
      profile: chosenProfile,
      intent,
      caller,
      lang: getLang(),
      sizeMethod: 'auto',
      whatIsIt,
      whatToPut,
    });

    // البروفايل: اختيار المستخدم أولاً، وإلا المولّد بعد ما يتفلتر
    if (chosenProfile) {
      state.profile = chosenProfile;
    } else if (analysis.generatedProfile) {
      state.profile = normalizeProfile(analysis.generatedProfile,
        analysis.generatedProfile.spaceKind === 'container' ? GENERIC_CONTAINER : GENERIC_PROFILE);
    } else {
      state.profile = GENERIC_PROFILE;
    }

    // المقياس: لو الموديل لقى مرجع من الكتالوج بنعاير عليه، وإلا بنكمّل
    // بتقديره للمقاس. مفيش رمي أخطاء هنا خالص.
    const surfBox = analysis.surface?.box ? normalizeBox(analysis.surface.box) : null;
    const refBox = analysis.scaleReference?.found ? normalizeBox(analysis.scaleReference.box) : null;
    const rid = analysis.scaleReference?.refId;
    const ref = typeof rid === 'string' && rid !== 'custom' ? SCALE_REFERENCES[rid] : null;

    let scale = null;
    if (refBox && ref?.widthCm) {
      scale = computeScale(refBox, ref.widthCm, ref.heightCm);
      state.scaleInfo = {
        kind: 'auto', refId: ref.id,
        whatAr: analysis.scaleReference.whatAr,
        score: scaleConfidence(scale, refBox).score,
      };
    } else {
      state.scaleInfo = { kind: 'guessed' };
    }
    state.scale = scale;

    // مقاس المساحة: من المرجع لو موجود، وإلا من تقدير الموديل، وإلا النموذجي
    const est = analysis.spaceSizeCm || {};
    const def = state.profile.defaultSizeCm || {};
    if (scale && surfBox && !isBag()) {
      const d = boxToCm(surfBox, scale);
      state.surface = {
        widthCm: clampCm(d.widthCm, 3, 400, def.width || 60),
        depthCm: clampCm(d.depthCm, 3, 300, def.depth || 40),
        heightCm: clampCm(est.height, 2, 250, def.height || 20),
      };
    } else {
      state.surface = {
        widthCm: clampCm(est.width, 3, 400, def.width || 60),
        depthCm: clampCm(est.depth, 3, 300, def.depth || 40),
        heightCm: clampCm(est.height, 2, 250, def.height || 20),
      };
    }
    state.userSize = null;
    state.sizeIsGuess = !scale;

    // أركان السطح للرسم على الصورة
    const rawCorners = validCorners(analysis.surface?.corners);
    if (rawCorners) {
      state.corners = rawCorners;
      state.cornersApprox = false;
    } else if (surfBox) {
      state.corners = cornersFromBox(surfBox)?.corners || null;
      state.cornersApprox = true;
    } else {
      state.corners = null;
    }

    if (analysis.windowSide) store.setPrefs({ windowSide: analysis.windowSide });
    applyDetectedHand(analysis.dominantHand);

    // الحاجات: اللي في الصورة + اللي المستخدم قال إنه عايز يحطه
    const cats = Object.keys(state.profile.categories);
    state.items = (analysis.objects || []).slice(0, 30).map((o, i) => {
      const box = normalizeBox(o.box);
      let w = 0, d = 0;
      if (scale && box) {
        const dims = boxToCm(box, scale);
        const corr = refBox ? perspectiveCorrect(box, refBox) : 1;
        w = dims.widthCm * corr;
        d = dims.depthCm * corr;
      }
      return {
        id: `it${i}`,
        nameAr: o.nameAr || t('newItem'),
        category: cats.includes(o.category) ? o.category : 'other',
        widthCm: clampCm(w || o.widthCm, 0.5, 300, 8),
        depthCm: clampCm(d || o.depthCm, 0.5, 300, 8),
        heightCm: clampCm(o.heightCm, 0.2, 200, 5),
        weightKg: clampCm(o.weightKg, 0, 30, 0),
        frequency: o.frequency || 'medium',
        fragile: !!o.fragile,
        confidence: Math.max(0, Math.min(1, Number(o.confidence) || 0.6)),
      };
    });

    state.emptySpace = !state.items.length;
    state.emptySource = 'photo';
    if (state.emptySpace) {
      addItem();
      // المساحة الفاضية شرحها أهم من شرح المقاس: هي اللي بتفسّر ليه
      // القايمة فاضية وإيه المطلوب منه. تحذير المقاس بيفضل على المحرر نفسه.
      if (!scale) state.scaleInfo = { kind: 'empty' };
    }

    state.edit = null;
    renderScaleBanner();
    renderPhotoRef();
    renderDetectedSpace();
    renderItems();
    showScreen('review');
  } catch (err) {
    // حتى الخطأ مش بيرجّعنا لنقطة الصفر: بنكمّل بكلام المستخدم
    toast(err.message, 5000);
    onDescribeFromAnswers(caller);
  } finally {
    loading(false);
  }
}

/**
 * الإيد اللي الموديل استنتجها من الصورة.
 *
 * بنقبل «يمين» أو «شمال» بس — أي حاجة تانية (وأهمها "unknown") معناها
 * إن اختيار المستخدم هو اللي يفضل ساري. ومبنغيّرش اختياره في صمت:
 * الملاحظة بتفضل ظاهرة في شاشة المراجعة.
 */
function applyDetectedHand(hand) {
  if (hand !== 'right' && hand !== 'left') { state.handDetected = null; return; }
  const before = $('#dominantHand').value;
  $('#dominantHand').value = hand;
  store.setPrefs({ dominantHand: hand });
  state.handDetected = hand;
  if (before !== hand) toast(t('handDetected', { hand: t(hand) }), 5000);
}

/**
 * الطريق التاني: من إجابات المستخدم لوحدها، من غير ما الصورة تتحلل.
 * بيتنده لما الصور ممنوعة، أو لما التحليل يفشل لأي سبب.
 */
async function onDescribeFromAnswers(caller, why = '') {
  const whatIsIt = $('#whatInput').value.trim();
  const whatToPut = $('#putInput').value.trim();
  if (!whatIsIt && !whatToPut) {
    // مجاوبش على حاجة — بنوديه للسؤالين بدل ما نسيبه واقف
    $('#whatInput').focus();
    $('#whatInput').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return toast(why ? `${why} ${t('answerFirst')}` : t('answerFirst'), 8000);
  }
  if (why) toast(why, 5000);
  const c = caller || await aiReady();
  if (!c) return toast(t('t_noAI'));

  loading(true, t('t_analyzing'));
  try {
    const chosen = $('#spaceType').value;
    const chosenProfile = chosen !== 'auto' ? getProfile(chosen) : null;
    const text = [whatIsIt, whatToPut && `عايز أحط فيها: ${whatToPut}`].filter(Boolean).join('. ');
    const r = await describeSpace({ text, caller: c, lang: getLang(), profile: chosenProfile });
    applyDescribed(r, text);
  } catch (err) {
    toast(err.message || t('describeNone'));
  } finally {
    loading(false);
  }
}

/** مدخل يدوي — التطبيق يفضل شغال من غير AI ولا حصة ولا نت. */
function onManual() {
  state.items = [];
  state.scale = null;
  // مفيش صورة ومفيش موديل — فمفيش إيد متستنتجة ولا تخطي مراجعة
  state.handDetected = null;
  state.autoAccepted = false;
  const chosen = $('#spaceType').value;
  state.profile = chosen === 'auto' ? BUILT_IN_PROFILES.desk : getProfile(chosen);
  // لو كتب المقاس في خطوة المقاس، منستهبلش ونرجّعه للمقاس النموذجي
  state.userSize = null;
  applyProfileSize();
  // مفيش صورة يعني مفيش حاجات اتشافت — وده بالظبط حالة «المساحة الفاضية»:
  // اكتب المقاس، وقول عايز تحط إيه. الفرق الوحيد إن مفيش صورة أصلاً.
  state.emptySpace = true;
  state.emptySource = 'manual';
  addItem();
  renderDetectedSpace();
  state.scaleInfo = { kind: 'manual' };
  renderScaleBanner();
  renderItems();
  showScreen('review');
}

/**
 * بيقصّ رقم جاي من الموديل على حدود معقولة.
 *
 * `fallback` مهم: من غيره الرقم الناقص كان بيقع على **أصغر حد مسموح**.
 * يعني الموديل لو نسي ارتفاع الحاوية، بتبقى حاوية بارتفاع ٢ سم — وكل
 * حاجة واقفة بتترفض بحجة «أكبر من الشنطة نفسها». القيمة الناقصة لازم
 * ترجع لمقاس نموذجي، مش لأصغر رقم في المدى.
 */
const clampCm = (v, lo, hi, fallback = lo) => {
  const n = Number(v);
  const base = Number.isFinite(n) && n > 0 ? n : fallback;
  return round1(Math.max(lo, Math.min(hi, base)));
};

/* ═══════════ مراجعة الحاجات ═══════════ */
function addItem() {
  state.items.push({
    id: `it${Date.now()}`, nameAr: t('newItem'),
    category: 'other',
    widthCm: 10, depthCm: 10, heightCm: 10, weightKg: 0,
    frequency: 'medium', fragile: false, confidence: 1,
  });
}

function renderItems() {
  const cats = state.profile?.categories || GENERIC_PROFILE.categories;
  const catOptions = Object.entries(cats).map(([k, v]) => [k, tx(v.labelAr)]);

  // مقاس المساحة بيتعرض هنا بس — بعد ما التطبيق عرف هي إيه فعلاً.
  // الحاويات محتاجة ارتفاع كمان، وشنطة السفر بس هي اللي بتشوف مقاسات الطيران.
  const bag = isBag();
  const airline = bag && state.profile?.usesAirlinePresets ? `
        <label class="wide">${esc(t('airlinePreset'))}
          <select data-airline>
            <option value="">—</option>
            ${CABIN_BAGS.filter((b) => b.w).map((b) => `<option value="${b.id}" ${state.airlineId === b.id ? 'selected' : ''}>${esc(b.nameAr)} — ${b.w}×${b.d}×${b.h}</option>`).join('')}
          </select>
        </label>
        <p class="hint wide">${esc(t('airlineWarn'))}</p>` : '';
  // الوزن بيتعرض في الحاويات بس — السطح مالوش حد وزن فالخانة هتزحمه على الفاضي
  const weightHint = bag ? `<p class="hint">${esc(t('weightHint'))}</p>` : '';

  // «قد إيه؟» بالمقارنة مش بالمسطرة — المستخدم مش معاه متر ومش هيقيس.
  const near = nearestComparison(state.surface);
  const compare = `
        <label class="wide">${esc(t('sizeLikeQ'))}
          <select data-compare>
            <option value="">${esc(t('sizeKeep'))}</option>
            ${SIZE_COMPARISONS.map((c) => `<option value="${c.id}" ${near?.id === c.id ? 'selected' : ''}>${esc(tx(c.labelAr))}</option>`).join('')}
          </select>
        </label>`;

  const spaceEditor = `
    <div class="item space-size">
      <div>
        <strong>${esc(bag ? t('spaceSize') : t('surfaceSize'))}</strong>
        <p class="hint">${esc(state.sizeIsGuess ? t('sizeGuessHint') : (bag ? t('containerSizeHint') : t('surfaceSizeHint')))}</p>
        <div class="item-dims">
          <label>${esc(t('width'))}<input type="number" data-surface="widthCm" value="${state.surface.widthCm}" step="1" min="1"></label>
          <label>${esc(t('depth'))}<input type="number" data-surface="depthCm" value="${state.surface.depthCm}" step="1" min="1"></label>
          ${bag ? `<label>${esc(t('height'))}<input type="number" data-surface="heightCm" value="${state.surface.heightCm || 30}" step="1" min="1"></label>` : ''}
          ${compare}
          ${airline}
        </div>
      </div>
    </div>`;

  // المساحة الفاضية سؤالها مختلف: مش «راجع اللي لقيناه» لكن «قول عايز تحط إيه».
  const emptyIntro = state.emptySpace ? `
    <div class="item empty-intro">
      <div>
        <strong>${esc(t(state.emptySource === 'manual' ? 'emptyTitleManual' : 'emptyTitle'))}</strong>
        <p class="hint">${esc(t(state.emptySource === 'manual' ? 'emptyHintManual' : 'emptyHint'))}</p>
        <div class="row">
          <input id="wishInput" class="input" type="text" maxlength="200"
                 value="${esc(state.wishText || '')}" placeholder="${esc(t('wishPh'))}">
          <button id="btnWish" class="btn ghost small" type="button">${esc(t('wishBtn'))}</button>
        </div>
      </div>
    </div>` : '';

  $('#itemsList').innerHTML = spaceEditor + emptyIntro + weightHint + state.items.map((it) => `
    <div class="item ${it.confidence < 0.5 ? 'conf-low' : ''}" data-id="${it.id}">
      <div>
        <input class="item-name" data-f="nameAr" value="${esc(it.nameAr)}" aria-label="${esc(t('itemName'))}">
        <div class="item-dims">
          <label>${esc(t('width'))}<input type="number" data-f="widthCm" value="${it.widthCm}" step="0.5" min="0.5"></label>
          <label>${esc(t('depth'))}<input type="number" data-f="depthCm" value="${it.depthCm}" step="0.5" min="0.5"></label>
          <label>${esc(t('height'))}<input type="number" data-f="heightCm" value="${it.heightCm}" step="0.5" min="0.2"></label>
          ${bag ? `<label>${esc(t('weight'))}<input type="number" data-f="weightKg" value="${it.weightKg || 0}" step="0.1" min="0" max="30"></label>` : ''}
        </div>
        <select data-f="category" aria-label="${esc(t('kind'))}">
          ${catOptions.map(([k, v]) => `<option value="${k}" ${it.category === k ? 'selected' : ''}>${v}</option>`).join('')}
        </select>
        ${!isBag() ? `
        <select data-f="frequency" aria-label="${esc(t('usage'))}">
          ${Object.entries(FREQ_KEYS).map(([k, key]) => `<option value="${k}" ${it.frequency === k ? 'selected' : ''}>${esc(t(key))}</option>`).join('')}
        </select>` : ''}
      </div>
      <button class="item-del" data-del="${it.id}" aria-label="${esc(t('del'))}">×</button>
    </div>`).join('');

  $('#itemsList').oninput = (e) => {
    const surfaceField = e.target.dataset.surface;
    if (surfaceField) {
      state.surface[surfaceField] = Number(e.target.value) || 0;
      state.userSize = { ...state.surface };
      return;
    }
    const row = e.target.closest('[data-id]');
    const f = e.target.dataset.f;
    if (!row || !f) return;
    const it = state.items.find((x) => x.id === row.dataset.id);
    if (!it) return;
    it[f] = ['widthCm', 'depthCm', 'heightCm', 'weightKg'].includes(f) ? Number(e.target.value) || 0 : e.target.value;
  };
  const wish = $('#btnWish');
  if (wish) {
    wish.onclick = onWish;
    $('#wishInput').oninput = (e) => { state.wishText = e.target.value; };
    $('#wishInput').onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); onWish(); } };
  }

  $('#itemsList').onchange = (e) => {
    if (e.target.dataset.compare !== undefined) {
      const c = SIZE_COMPARISONS.find((x) => x.id === e.target.value);
      if (!c) return;
      state.surface = {
        widthCm: c.widthCm,
        depthCm: c.depthCm,
        heightCm: c.heightCm || state.surface.heightCm || 20,
      };
      state.userSize = { ...state.surface };
      state.sizeIsGuess = false;
      renderItems();
      return;
    }
    if (e.target.dataset.airline === undefined) return;
    const b = CABIN_BAGS.find((x) => x.id === e.target.value);
    if (!b?.w) return;
    state.surface = { widthCm: b.w, depthCm: b.d, heightCm: b.h };
    state.userSize = { ...state.surface };
    state.maxWeightKg = b.kg || 0;
    state.airlineId = b.id;
    renderItems();
  };
  $('#itemsList').onclick = (e) => {
    const id = e.target.dataset.del;
    if (!id) return;
    state.items = state.items.filter((x) => x.id !== id);
    renderItems();
  };
}

/**
 * التثبيت على الموبايل. المتصفح بيدي الحدث ده لما الصفحة تستوفي شروط PWA
 * (manifest + service worker + https) — فالزرار بيظهر لوحده وقتها بس.
 * على iOS مفيش الحدث ده، فبنوجّه المستخدم لزرار المشاركة.
 */
function setupInstall() {
  const btn = $('#btnInstall');
  let deferred = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    btn.classList.remove('hidden');
  });

  btn.addEventListener('click', async () => {
    if (!deferred) return;
    btn.disabled = true;
    deferred.prompt();
    await deferred.userChoice;
    deferred = null;
    btn.classList.add('hidden');
    btn.disabled = false;
  });

  // iOS: مفيش beforeinstallprompt، بس لسه ينفع يتثبت من زرار المشاركة
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (isIOS && !standalone) {
    btn.classList.remove('hidden');
    btn.textContent = t('installIOS');
    btn.disabled = true;
  }
}

/** الملاحظة إما مفتاح من الخوارزمية أو نصيحة {ar,en} من البروفايل. */
function noteText(n) {
  return n.text?.key ? tr(n.text) : tx(n.text);
}

/* ═══════════ الحساب ═══════════ */
async function onPlan() {
  const valid = state.items.filter((i) => i.widthCm > 0 && i.depthCm > 0 && i.heightCm > 0);
  if (!valid.length) return toast(t('t_needItems'));

  if (!isBag()) {
    if (!(state.surface.widthCm > 20 && state.surface.depthCm > 20)) return toast(t('t_needSize'));
    const prefs = store.getPrefs();
    state.plan = layoutSurface(state.surface, valid, state.profile || GENERIC_PROFILE, {
      dominantHand: $('#dominantHand').value,
      windowSide: prefs.windowSide || 'none',
    });
    state.edit = null;
    $('#editBar').classList.add('hidden');
    renderDeskResult();
  } else {
    // مقاس الحاوية بيتقرا من نفس المكان اللي السطح بياخد منه — محرر المراجعة
    const def = state.profile.defaultSizeCm || {};
    const bin = {
      widthCm: state.surface.widthCm || def.width,
      depthCm: state.surface.depthCm || def.depth,
      heightCm: state.surface.heightCm || def.height,
      maxWeightKg: state.maxWeightKg || 0,
    };
    if (!(bin.widthCm > 0 && bin.depthCm > 0 && bin.heightCm > 0)) return toast(t('t_needBagSize'));
    state.bin = bin;

    const items = valid.map((i) => {
      const meta = state.profile.categories[i.category] || {};
      return { ...i, keepUpright: !!meta.keepUpright, fragile: i.fragile || !!meta.fragile, compressible: !!meta.compressible };
    });
    const res = pack3D(bin, items);
    state.plan = { ...res, steps: packingOrder(res.placed) };
    // الحاجة اللي مستحيل تدخل: رسالة صريحة وقت الحساب، مش سطر في ليستة تحت
    const tooBig = (res.unplaced || []).filter((u) => u.reason?.[0]?.key === 'p_tooBig');
    if (tooBig.length) {
      toast(t('tooBigMsg', { what: tooBig.map((u) => u.nameAr).join('، ') }), 6000);
    }
    renderBagResult();
  }

  $('#askAnswer').classList.add('hidden');
  $('#askInput').value = '';
  // الشريط بيظهر بس لما إحنا اللي عدّينا المراجعة، مش لما هو ضغط «احسب»
  $('#autoSkipBar').classList.toggle('hidden', !state.autoAccepted);
  showScreen('result');
  maybeExplain();
  return true;
}

function renderDeskResult() {
  const p = state.plan;
  $('#resultTitle').textContent = `${t('arrangeOf')} ${tx(p.profileName) || t('resultTitle')}`.trim();
  $('#statsRow').innerHTML = `
    <div class="stat"><b>${p.stats.onDesk}</b><span>${esc(t('statOnSurface'))}</span></div>
    <div class="stat"><b>${p.stats.freePercent}%</b><span>${esc(t('statFree'))}</span></div>
    <div class="stat"><b>${p.stats.removed}</b><span>${esc(t('statRemoved'))}</span></div>`;
  $('#planView').innerHTML = renderDeskPlan(p);
  $('#legendView').innerHTML = renderLegend(p.placed);
  $('#notesView').innerHTML = p.notes.map((n) =>
    `<div class="note ${n.level}"><span>${n.level === 'warn' ? '⚠️' : n.level === 'ok' ? '✅' : '💡'}</span><span>${esc(noteText(n))}</span></div>`).join('');
  $('#stepsView').innerHTML = `
    <h3>${esc(t('whyHere'))}</h3>
    <ol>${p.placed.map((i) => `<li><b>${esc(i.nameAr)}</b><br><span class="pos">${esc(tr(i.reason))}</span></li>`).join('')}</ol>
    ${p.offDesk.length ? `<div class="off-desk"><h3>${esc(t('removeThese'))}</h3><ul>${
      p.offDesk.map((i) => `<li><b>${esc(i.nameAr)}</b> — ${esc(tr(i.reason))}</li>`).join('')}</ul></div>` : ''}`;
  $('#btnAfterImage').classList.toggle('hidden', !CAN_RENDER_IMAGE);

  // الصورة هي العرض لو موجودة، وإلا المخطط
  const canPhoto = !!state.image;
  $('#editHint').textContent = canPhoto ? t('editHint') : '';
  setView();
  $('#fitPanel').classList.remove('hidden');
  $('#spacesPanel').classList.remove('hidden');
  renderSpaces();
  runSpaces();
}

function renderBagResult() {
  const p = state.plan;
  $('#resultTitle').textContent = tx(state.profile?.spaceTypeAr) || t('bagResult');
  const weightWarn = p.stats.overWeight ? ' ⚠️' : '';
  $('#statsRow').innerHTML = `
    <div class="stat"><b>${p.stats.placedCount}</b><span>${esc(t('statFits'))}</span></div>
    <div class="stat"><b>${p.stats.unplacedCount}</b><span>${esc(t('statNoFit'))}</span></div>
    <div class="stat"><b>${p.stats.fillPercent}%</b><span>${esc(t('statFill'))}</span></div>
    ${p.stats.requestedWeightKg ? `<div class="stat"><b>${p.stats.totalWeightKg}${weightWarn}</b><span>${esc(t('statKg'))}</span></div>` : ''}`;
  $('#editBar').classList.add('hidden');
  $('#editHint').textContent = state.image ? t('photoDragHint') : '';
  $('#fitPanel').classList.add('hidden');
  $('#spacesPanel').classList.add('hidden');
  $('#planView').innerHTML = renderBagPlan(state.bin, p.placed);
  setView();
  $('#legendView').innerHTML = renderLegend(p.placed);
  $('#notesView').innerHTML = p.stats.overWeight
    ? `<div class="note warn"><span>⚠️</span><span>${esc(t('n_overweight', {
      total: p.stats.requestedWeightKg, limit: state.bin?.maxWeightKg || 0,
    }))}</span></div>` : '';
  $('#stepsView').innerHTML = `
    <h3>${esc(t('packOrder'))}</h3>
    <ol>${p.steps.map((st) => `<li><b>${esc(st.nameAr)}</b>${st.rotated ? ` <span class="pos">${esc(t('rotate'))}</span>` : ''}${st.fragile ? ' ⚠️' : ''}<br><span class="pos">${esc(tr(st.position))}</span></li>`).join('')}</ol>
    ${p.unplaced.length ? `<div class="off-desk"><h3>${esc(t('wontFit'))}</h3><ul>${
      p.unplaced.map((i) => `<li><b>${esc(i.nameAr)}</b> — ${esc(tr(i.reason))}</li>`).join('')}</ul></div>` : ''}`;
  // صورة "بعد" ليها معنى في المكتب بس
  $('#btnAfterImage').classList.add('hidden');
}

/* ═══════════ إضافات الـAI ═══════════ */
async function maybeExplain() {
  $('#aiNote').classList.add('hidden');
  const caller = await aiReady();
  if (!caller) return;
  try {
    // الملخص بيتترجم هنا: الخطوات بترجع {key, params} والترجمة عند الواجهة
    const summary = isBag()
      ? (state.plan.steps || []).map((s) => `${s.step}. ${s.nameAr} — ${tr(s.position)}`).join('\n')
      : (state.plan.placed || []).map((p) => `${p.nameAr} — ${tr(p.reason)}`).join('\n');
    const text = await explainPlan({
      mode: isBag() ? 'bag' : 'surface', plan: state.plan, caller, lang: getLang(), summary,
    });
    if (text.trim()) {
      $('#aiNote').textContent = text.trim();
      $('#aiNote').classList.remove('hidden');
    }
  } catch { /* الشرح رفاهية — المخطط هو الأساس */ }
}

async function onAfterImage() {
  const caller = await aiReady();
  if (!state.image) return toast(t('t_noOriginal'));
  loading(true, t('t_drawing'));
  try {
    const url = await renderAfterImage({ image: state.image, plan: state.plan, caller });
    $('#afterImage').src = url;
    $('#afterImageWrap').classList.remove('hidden');
    $('#afterImageWrap').scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    toast(err.message);
  } finally {
    loading(false);
  }
}

/* ═══════════ الحفظ ═══════════ */
function onSave() {
  const ok = store.saveScan({
    mode: isBag() ? 'bag' : 'surface',
    title: !isBag()
      ? `${tx(state.profile?.spaceTypeAr) || t('appName')} ${Math.round(state.surface.widthCm)}×${Math.round(state.surface.depthCm)}`
      : `${tx(state.profile?.spaceTypeAr) || t('bagResult')}`,
    items: state.items,
    surface: state.surface,
    profile: state.profile,
    bin: state.bin,
  });
  toast(ok ? t('t_savedOk') : t('t_savedFull'));
  renderSaved();
}

function renderSaved() {
  const scans = store.getScans();
  $('#savedScans').classList.toggle('hidden', !scans.length);
  $('#savedList').innerHTML = scans.map((s) => `
    <li>
      <span>${esc(s.title)} <span class="muted">— ${new Date(s.savedAt).toLocaleDateString(getLang() === 'ar' ? 'ar-EG' : 'en-GB')}</span></span>
      <span>
        <button data-load="${s.savedAt}">${esc(t('open'))}</button>
        <button data-drop="${s.savedAt}">${esc(t('erase'))}</button>
      </span>
    </li>`).join('');
  $('#savedList').onclick = (e) => {
    const load = e.target.dataset.load, drop = e.target.dataset.drop;
    if (drop) { store.deleteScan(+drop); renderSaved(); return; }
    if (!load) return;
    const s = store.getScans().find((x) => x.savedAt === +load);
    if (!s) return;
    state.items = s.items; state.surface = s.surface || state.surface; state.profile = s.profile; state.bin = s.bin;
    renderDetectedSpace();
    renderItems();
    showScreen('review');
  };
}

/* ═══════════ ٤+٥: المساحة اللي اتحددت وقواعدها ═══════════ */

/** كل مساحة ليها مقاس نموذجي مختلف — التسريحة مش بمقاس المكتب. */
function applyProfileSize() {
  const size = state.profile?.defaultSizeCm;
  if (!(size?.width > 0 && size?.depth > 0)) return;
  const u = state.userSize;
  state.surface = {
    widthCm: u?.widthCm > 0 ? u.widthCm : size.width,
    depthCm: u?.depthCm > 0 ? u.depthCm : size.depth,
    heightCm: u?.heightCm > 0 ? u.heightCm : (size.height || 30),
  };
}

/** بيعرض نوع المساحة والقواعد اللي هتتنفّذ — عشان تشوفها قبل الحساب. */
function renderDetectedSpace() {
  const box = $('#detectedSpace');
  if (!state.profile) { box.classList.add('hidden'); return; }

  box.classList.remove('hidden');
  const src = state.profile.source === 'ai' ? ' 🤖' : '';
  $('#detectedName').textContent = tx(state.profile.spaceTypeAr) + src;

  // ملخص القواعد: كل فئة رايحة فين
  $('#rulesList').innerHTML = Object.values(state.profile.categories)
    .filter((c) => c.zone)
    .slice(0, 14)
    .map((c) => {
      const zone = t('zone_' + c.zone);
      const flags = [c.keepDry && '💧', c.avoidLight && '🌑', c.wantsLight && '☀️', c.hot && '🔥', c.anchor && '📌']
        .filter(Boolean).join('');
      return `<li>${esc(tx(c.labelAr))} → ${esc(zone)} ${flags}</li>`;
    }).join('');

  // ملاحظة الإيد بتفضل ظاهرة هنا — التوست بيروح، وده اللي المستخدم يرجعله
  const handNote = $('#handNote');
  handNote.classList.toggle('hidden', !state.handDetected);
  if (state.handDetected) handNote.textContent = t('handDetected', { hand: t(state.handDetected) });
}

/* ═══════════ المخطط على الصورة + التعديل اليدوي ═══════════ */

/**
 * تبديل بين المخطط من فوق والمخطط مرسوم على الصورة.
 * الأرقام واحدة في الاتنين — اللي بيتغير نقطة النظر بس.
 */
/**
 * مفيش تبويبات.
 *
 * الصورة هي العرض. المخطط من فوق كان بديل وقت ما الرسم على الصورة
 * مكانش موجود — دلوقتي موجود، والاتنين مع بعض كانوا بيخلّوا المستخدم
 * يختار بين حاجة عايزها وحاجة مش عايزها. المخطط بيفضل للحالة الوحيدة
 * اللي مفيهاش صورة أصلاً.
 */
function setView(view) {
  const hasPhoto = !!state.image;
  state.view = hasPhoto ? 'photo' : 'plan';
  $('#planView').classList.toggle('hidden', hasPhoto);
  $('#photoView').classList.toggle('hidden', !hasPhoto);
  $('#editTools').classList.toggle('hidden', !hasPhoto);
  $('#removedList').classList.toggle('hidden', !hasPhoto || !state.edit?.removed?.length);
  if (hasPhoto) { renderOverlay(); renderRemoved(); }
}

/** الحاجات المعروضة دلوقتي: المعدّلة لو المستخدم حرّك، وإلا اللي الخوارزمية طلعته. */
const shownPlaced = () => (state.edit ? state.edit.placed : state.plan?.placed) || [];

/**
 * أماكن الحاجات على مستوى واحد، مهما كانت الخوارزمية اللي حسبتها.
 *
 * السطح بيرجّع x/y/w/d جاهزين. الحاوية بترجّع صندوق ثلاثي الأبعاد —
 * فبناخد إسقاطه على قاع الحاوية، لأن ده اللي بتشوفه لما تبص جواها من فوق.
 * الحاجات المحشورة في الفراغات (من غير صندوق) مالهاش مكان محدد فبتتساب.
 */
function footprints() {
  if (!isBag()) return shownPlaced();
  if (state.edit) return state.edit.placed;
  return (state.plan?.placed || [])
    .filter((p) => p.box)
    .map((p) => ({
      ...p,
      x: p.box.x, y: p.box.y, w: p.box.w, d: p.box.d,
      z: p.box.z,
    }));
}

/** المستوى اللي بنرسم عليه: السطح نفسه، أو قاع الحاوية. */
const planePlane = () => (isBag()
  ? { widthCm: state.bin?.widthCm || state.surface.widthCm, depthCm: state.bin?.depthCm || state.surface.depthCm }
  : state.surface);

/**
 * أركان افتراضية في نص الصورة لما مانعرفش المساحة فين.
 * دي نقطة بداية بس — المستخدم بيسحبها على حواف مساحته الحقيقية.
 */
function defaultCorners() {
  return [
    { x: 0.18, y: 0.82 }, { x: 0.82, y: 0.82 },
    { x: 0.72, y: 0.34 }, { x: 0.28, y: 0.34 },
  ];
}

function renderOverlay() {
  const box = $('#photoOverlay');
  if (!state.image || !state.plan) {
    box.innerHTML = '';
    $('#photoNote').textContent = t('photoNoImage');
    return;
  }
  // مانعرفش المساحة فين في الصورة؟ نحط رباعي مبدئي والمستخدم يظبطه.
  // ده أحسن بكتير من إننا نقول «مش قادرين» — هو شايف صورته وعارف حدودها.
  if (!state.corners) {
    state.corners = defaultCorners();
    state.cornersManual = true;
  }

  $('#photoBase').src = state.image.dataUrl;
  const imgW = 1000;
  const imgH = Math.round(1000 * (state.image.height / state.image.width));
  const out = renderPhotoOverlay(planePlane(), footprints(), state.corners, {
    imgW, imgH,
    approx: state.cornersApprox,
    selectedId: state.edit?.selectedId,
    movedIds: state.edit ? [...state.edit.movedIds] : [],
  });
  if (!out) { box.innerHTML = ''; $('#photoNote').textContent = t('photoNoImage'); return; }

  // مقابض الأركان — بتتحط فوق الرسمة عشان تتسحب
  const handles = state.corners.map((c, i) =>
    `<circle cx="${(c.x * imgW).toFixed(1)}" cy="${(c.y * imgH).toFixed(1)}" r="${imgW * 0.022}"
       class="corner-handle" data-corner="${i}" fill="var(--accent)" fill-opacity="0.85"
       stroke="#fff" stroke-width="${imgW * 0.006}"/>`).join('');
  box.innerHTML = out.svg.replace('</svg>', handles + '</svg>');

  state.projected = out.projected;
  state.homography = out.homography;
  $('#photoNote').textContent = t(state.cornersManual ? 'photoDrag'
    : state.cornersApprox ? 'photoApprox' : 'photoExact');
}

/**
 * سحب أركان المساحة على الصورة.
 *
 * الأركان الأربعة هي كل اللي التحويل الإسقاطي محتاجه. فلما التطبيق
 * مايعرفش المساحة فين — أو يعرفها غلط — المستخدم بيصلّحها بصباعه،
 * وهو أصلاً الوحيد اللي شايف الصورة والمكان الحقيقي مع بعض.
 */
function setupCornerDrag() {
  const box = $('#photoOverlay');
  let dragging = null;

  const pos = (ev) => {
    const svg = box.querySelector('svg');
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    const pt = ev.touches?.[0] || ev;
    return {
      x: Math.max(0, Math.min(1, (pt.clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (pt.clientY - r.top) / r.height)),
    };
  };

  const start = (ev) => {
    const i = ev.target?.dataset?.corner;
    if (i === undefined) return;
    dragging = +i;
    ev.preventDefault();
  };
  const move = (ev) => {
    if (dragging === null) return;
    const p = pos(ev);
    if (!p) return;
    state.corners[dragging] = p;
    state.cornersApprox = false;
    renderOverlay();
    ev.preventDefault();
  };
  const end = () => { dragging = null; };

  box.addEventListener('pointerdown', start);
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', end);
  box.addEventListener('touchstart', start, { passive: false });
  window.addEventListener('touchmove', move, { passive: false });
  window.addEventListener('touchend', end);
}

/**
 * بيبدأ التعديل عند أول لمسة.
 *
 * الحاوية بتتعدّل زي السطح بالظبط، بس على قاعها وبقواعد مبسّطة: جوه سلة
 * مفيش «منطقة وصول» ولا «ناحية إيدك»، فيه بس «داخلة ولا متراكبة».
 */
function ensureEditing() {
  if (state.edit || !state.plan) return state.edit;
  if (isBag()) {
    state.edit = startEditing(
      { placed: footprints() },
      planePlane(),
      CONTAINER_EDIT_PROFILE,
      {},
    );
  } else {
    state.edit = startEditing(state.plan, state.surface, state.profile || GENERIC_PROFILE, planOpts());
  }
  return state.edit;
}

function planOpts() {
  const prefs = store.getPrefs();
  return { dominantHand: $('#dominantHand').value, windowSide: prefs.windowSide || 'none' };
}

/**
 * لمسة على الصورة: أول لمسة بتختار، والتانية بتنقل أو بتبدّل.
 * ده أبسط من السحب على تليفون، وبيشتغل باللمس والماوس من غير كود منفصل.
 */
function onOverlayTap(ev) {
  if (!state.moveMode || !state.projected || !ensureEditing()) return;
  const svg = $('#photoOverlay svg');
  if (!svg) return;
  const r = svg.getBoundingClientRect();
  const vb = svg.viewBox.baseVal;
  const x = ((ev.clientX - r.left) / r.width) * vb.width;
  const y = ((ev.clientY - r.top) / r.height) * vb.height;

  const hitId = hitTest(state.projected, x, y);
  const picked = state.edit.selectedId;

  if (!picked) {
    if (!hitId) return;
    state.edit = selectItem(state.edit, hitId);
    const it = state.edit.placed.find((i) => i.id === hitId);
    showVerdict({ picked: it?.nameAr });
    afterEdit();
    return;
  }

  let res;
  if (hitId && hitId !== picked) {
    res = swap(state.edit, picked, hitId);
  } else if (hitId === picked) {
    state.edit = selectItem(state.edit, hitId);   // إلغاء الاختيار
    showVerdict({});
    afterEdit();
    return;
  } else {
    // مكان فاضي: بنحوّل نقطة الصورة لسنتيمترات على السطح، وبنحط المركز هناك
    const plan = imageToPlan(state.homography, x / vb.width, y / vb.height);
    if (!plan) return;
    const it = state.edit.placed.find((i) => i.id === picked);
    res = moveTo(state.edit, picked, plan.x - it.w / 2, plan.y - it.d / 2);
  }

  if (res?.ok) {
    state.edit = selectItem(res.st, null);
    state.edit.selectedId = null;
    showVerdict(res);
    afterEdit();
  }
}

/** بعد أي تعديل: الرسمة، الأزرار، وليستة اللي اتشال. */
function afterEdit() {
  renderOverlay();
  renderRemoved();
  $('#btnRemoveItem').disabled = !state.edit?.selectedId;
  if (!isBag() && state.plan) {
    $('#planView').innerHTML = renderDeskPlan({ ...state.plan, placed: state.edit.placed });
  }
}

/** وضع التحريك — زرار صريح بدل ما اللمس يشتغل من غير ما حد يطلبه. */
function toggleMoveMode() {
  state.moveMode = !state.moveMode;
  $('#btnMoveMode').classList.toggle('on', state.moveMode);
  $('#photoOverlay').classList.toggle('moving', state.moveMode);
  if (state.moveMode) ensureEditing();
  toast(t(state.moveMode ? 'moveModeOn' : 'moveModeOff'), 3000);
  afterEdit();
}

/** شيل الحاجة المختارة. */
function onRemoveSelected() {
  if (!state.edit?.selectedId) return toast(t('pickFirst'));
  const it = state.edit.placed.find((p) => p.id === state.edit.selectedId);
  const res = removeItem(state.edit, state.edit.selectedId);
  if (!res.ok) return;
  state.edit = res.st;
  toast(t('removedOne', { what: it?.nameAr || '' }), 4000);
  showVerdict({});
  afterEdit();
}

/** اللي اتشال بيفضل معروض عشان ترجّعه بلمسة. */
function renderRemoved() {
  const box = $('#removedList');
  const list = state.edit?.removed || [];
  box.classList.toggle('hidden', !list.length);
  if (!list.length) return;
  box.innerHTML = `<strong>${esc(t('removedTitle'))}</strong>` + list.map((p) =>
    `<button class="chip" type="button" data-restore="${esc(p.id)}">${esc(p.nameAr)} ↩</button>`).join('');
  box.onclick = (e) => {
    const id = e.target.dataset.restore;
    if (!id) return;
    const it = list.find((p) => p.id === id);
    const res = restoreItem(state.edit, id);
    if (!res.ok) return;
    state.edit = res.st;
    toast(t('restoredOne', { what: it?.nameAr || '' }));
    showVerdict(res);
    afterEdit();
  };
}

/** حفظ الترتيب اللي المستخدم عدّله بإيده. */
function onSaveEdit() {
  if (!state.edit) return toast(t('pickFirst'));
  const ok = store.saveScan({
    title: `${tx(state.profile?.spaceTypeAr) || t('appName')} ✋`,
    items: state.items,
    surface: state.surface,
    profile: state.profile,
    bin: state.bin,
    editedPlaced: state.edit.placed,
    removed: state.edit.removed || [],
  });
  toast(t(ok ? 'editSaved' : 't_savedFull'));
  renderSaved();
}

/** الحكم على التعديل — بنفس دالة تكلفة الخوارزمية، مش برأي تاني. */
function showVerdict(res) {
  const bar = $('#editBar');
  const out = $('#editVerdict');
  if (res.picked) {
    bar.classList.remove('hidden');
    out.className = 'verdict';
    out.textContent = t('editPicked', { what: res.picked });
    return;
  }
  if (!state.edit || !state.edit.movedIds.size) { bar.classList.add('hidden'); return; }

  bar.classList.remove('hidden');
  if (res.problems?.length) {
    out.className = 'verdict bad';
    out.textContent = t('vIllegal', { why: tr([res.problems[0].why]) });
    return;
  }
  // جوه حاوية مفيش «أحسن ولا أوحش» — مفيش منطقة وصول أصلاً.
  // السؤال الوحيد اللي ليه معنى: داخلة ومش راكبة على حاجة؟
  if (isBag()) {
    out.className = 'verdict good';
    out.textContent = t('okHere');
    return;
  }
  const v = verdict(state.edit);
  out.className = `verdict ${v.direction === 'better' ? 'good' : v.direction === 'worse' ? 'bad' : ''}`;
  out.textContent = v.direction === 'better'
    ? t('vBetter', { n: Math.abs(v.delta), cm: Math.abs(v.reachDelta) })
    : v.direction === 'worse' ? t('vWorse', { n: Math.abs(v.delta) })
    : t('vSame');
}

function onUndoMove() {
  if (!state.edit) return;
  state.edit = undoEdit(state.edit);
  showVerdict({});
  afterEdit();
}

function onResetLayout() {
  if (!state.edit) return;
  state.edit = resetLayout(state.edit);
  state.edit.removed = [];
  showVerdict({});
  afterEdit();
  if (!isBag() && state.plan) $('#planView').innerHTML = renderDeskPlan(state.plan);
}

/* ═══════════ الوصف بالكلام — بديل كامل للصورة ═══════════ */

/**
 * بيبني المساحة كلها من جملة المستخدم: نوعها، مقاسها، واللي جواها.
 *
 * ده مش «خطة بديلة» أقل من الصورة — ده نفس المدخلات بالظبط، جاية من
 * الشخص اللي شايف المساحة بدل الموديل. وفي الحالات اللي العرض مش بيسمح
 * فيها ببعت صور، ده الطريق الوحيد الشغال، فمابيتعاملش كأنه ناقص.
 */
/** بيطبّق نتيجة الوصف على الحالة — نفس المكان للمسارين. */
function applyDescribed(r, text) {
  const chosen = $('#spaceType').value;
  const chosenProfile = chosen !== 'auto' ? getProfile(chosen) : null;

  if (chosenProfile) {
    state.profile = chosenProfile;
  } else if (r.generatedProfile) {
    state.profile = normalizeProfile(r.generatedProfile,
      r.generatedProfile.spaceKind === 'container' ? GENERIC_CONTAINER : GENERIC_PROFILE);
  } else {
    state.profile = GENERIC_PROFILE;
  }

  const sz = r.sizeCm || {};
  const dflt = state.profile.defaultSizeCm || {};
  state.surface = {
    widthCm: clampCm(sz.width, 3, 400, dflt.width || 60),
    depthCm: clampCm(sz.depth, 3, 300, dflt.depth || 40),
    heightCm: clampCm(sz.height, 2, 250, dflt.height || 20),
  };
  state.userSize = null;
  state.sizeIsGuess = !r.sizeFromUser;

  const cats = Object.keys(state.profile.categories);
  state.items = (r.items || []).slice(0, 25).map((o, i) => ({
    id: `d${Date.now()}_${i}`,
    nameAr: o.nameAr || t('newItem'),
    category: cats.includes(o.category) ? o.category : 'other',
    widthCm: clampCm(o.widthCm, 0.5, 300, 8),
    depthCm: clampCm(o.depthCm, 0.5, 300, 8),
    heightCm: clampCm(o.heightCm, 0.2, 200, 5),
    weightKg: clampCm(o.weightKg, 0, 30, 0),
    frequency: ['high', 'medium', 'low'].includes(o.frequency) ? o.frequency : 'medium',
    fragile: !!o.fragile,
    confidence: 1,
  }));

  state.emptySpace = !state.items.length;
  state.emptySource = 'manual';
  if (state.emptySpace) addItem();

  state.scale = null;
  state.corners = null;
  state.edit = null;
  state.wishText = text;
  state.scaleInfo = { kind: 'described' };
  renderScaleBanner();
  renderPhotoRef();
  renderDetectedSpace();
  renderItems();
  showScreen('review');
  toast(t('describeGot', { what: tx(state.profile.spaceTypeAr), n: state.items.length }));
}

/** الصورة مش متحللة، بس لسه مفيدة — بيبص عليها وهو بيكتب الأرقام. */
function renderPhotoRef() {
  const box = $('#photoRef');
  if (!box) return;
  if (!state.image || state.scale) { box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  $('#photoRefImg').src = state.image.dataUrl;
  $('#photoRefNote').textContent = t('photoKept');
}

/* ═══════════ المساحة الفاضية: قول عايز تحط إيه ═══════════ */

/**
 * بيحوّل جملة زي «أقلام ومقص وشاحن» لحاجات بمقاسات.
 *
 * ده الجزء اللي بيخلي المساحة الفاضية مفيدة فعلاً: من غيره المستخدم
 * هيكتب كل حاجة ومقاسها بإيده، وده شغل كتير عشان سؤال بسيط.
 *
 * الموديل بيدّي المقاسات التقريبية بس — القرار «يدخل ولا مايدخلش وفين»
 * بيفضل رياضة زي أي حاجة تانية، والمستخدم بيقدر يعدّل أي رقم.
 */
async function onWish() {
  const text = ($('#wishInput')?.value || '').trim();
  if (!text) return toast(t('wishNeed'));

  const caller = await aiReady();
  if (!caller) return toast(t('t_noAI'));

  loading(true, t('t_analyzing'));
  try {
    const cats = Object.keys((state.profile || GENERIC_PROFILE).categories);
    const r = await caller.json(
      `المستخدم عنده ${tx(state.profile?.spaceTypeAr) || 'مساحة'} فاضية مقاسها ` +
      `${Math.round(state.surface.widthCm)}×${Math.round(state.surface.depthCm)}` +
      `${isBag() ? '×' + Math.round(state.surface.heightCm || 0) : ''} سم، وعايز يحط فيها: "${text}"\n\n` +
      `اطلعلي كل حاجة ذكرها كصف لوحده بمقاسه التقريبي الحقيقي بالسنتيمتر.\n` +
      `لو قال حاجة بالجمع (زي «أقلام») اعملها صف واحد بمقاس المجموعة مع بعض.\n` +
      `متزوّدش حاجات هو مقالهاش.\n\n` +
      `رد بـJSON بس:\n` +
      `{"items":[{"nameAr":"...","category":"واحدة من: ${cats.join('، ')}",` +
      `"widthCm":0,"depthCm":0,"heightCm":0,"weightKg":0,"frequency":"high|medium|low"}]}`,
      { modelTier: 'default' });

    const list = Array.isArray(r.items) ? r.items : [];
    if (!list.length) throw new Error(t('wishNone'));

    // نفس التقصيص المطبّق على أي رقم جاي من الموديل
    state.items = list.slice(0, 25).map((o, i) => ({
      id: `w${Date.now()}_${i}`,
      nameAr: o.nameAr || t('newItem'),
      category: cats.includes(o.category) ? o.category : 'other',
      widthCm: clampCm(o.widthCm, 0.5, 300, 8),
      depthCm: clampCm(o.depthCm, 0.5, 300, 8),
      heightCm: clampCm(o.heightCm, 0.2, 200, 5),
      weightKg: clampCm(o.weightKg, 0, 30, 0),
      frequency: ['high', 'medium', 'low'].includes(o.frequency) ? o.frequency : 'medium',
      fragile: !!o.fragile,
      confidence: 1,
    }));
    state.wishText = text;
    renderItems();
    toast(t('wishAdded', { n: state.items.length }));
  } catch (err) {
    toast(err.message);
  } finally {
    loading(false);
  }
}

/* ═══════════ هيدخل ولا لأ ═══════════ */

/**
 * بيسأل الموديل عن مقاس حاجة بالاسم — «شاشة ٢٧ بوصة» بتبقى أرقام.
 * الأرقام بترجع من الموديل، بس القرار «هتدخل ولا لأ» بيتحسب هنا بالرياضة.
 */
async function onFitAsk() {
  const what = $('#fitName').value.trim();
  if (!what) return toast(t('fitNeedSize'));
  const caller = await aiReady();
  if (!caller) return toast(t('t_noAI'));
  loading(true, t('t_analyzing'));
  try {
    const cats = Object.keys((state.profile || GENERIC_PROFILE).categories);
    const r = await caller.json(
      `قد إيه مقاس "${what}" بالسنتيمتر تقريباً؟ رد بـJSON بس:\n` +
      `{"widthCm":0,"depthCm":0,"heightCm":0,"category":"واحدة من: ${cats.join('، ')}"}`,
      { modelTier: 'quick' });
    $('#fitW').value = clampCm(r.widthCm, 0.5, 400, 10);
    $('#fitD').value = clampCm(r.depthCm, 0.5, 400, 10);
    $('#fitH').value = clampCm(r.heightCm, 0.2, 300, 10);
    $('#fitPanel').dataset.cat = cats.includes(r.category) ? r.category : 'other';
    onFitCheck();
  } catch (err) {
    toast(err.message);
  } finally {
    loading(false);
  }
}

function onFitCheck() {
  const w = parseFloat($('#fitW').value);
  const d = parseFloat($('#fitD').value);
  if (!(w > 0 && d > 0)) return toast(t('fitNeedSize'));
  if (isBag() || !state.plan) return;

  const out = $('#fitResult');
  const res = tryFit(state.surface, shownPlaced(), state.profile || GENERIC_PROFILE, {
    nameAr: $('#fitName').value.trim() || t('newItem'),
    category: $('#fitPanel').dataset.cat || 'other',
    widthCm: w, depthCm: d, heightCm: parseFloat($('#fitH').value) || 5,
    frequency: 'medium',
  }, planOpts());

  const nameOf = (id) => shownPlaced().find((p) => p.id === id)?.nameAr || '—';
  out.classList.remove('hidden');
  if (res.fits) {
    out.textContent = t('fitYes', { where: tr(res.spot.reason) });
  } else if (res.tooBig) {
    out.textContent = t('fitTooBig', { w: res.shortBy.widthCm, d: res.shortBy.depthCm });
  } else if (res.anchorTaken) {
    out.textContent = t('fitAnchorTaken', { what: res.blockedBy.map(nameOf).join('، ') });
  } else if (res.blockedBy.length) {
    out.textContent = t('fitNoRoom', { what: res.blockedBy.map(nameOf).join('، ') });
  } else {
    out.textContent = t('fitNoRoomHard');
  }
}

/* ═══════════ مساحات متصلة ═══════════ */

function renderSpaces() {
  const primary = state.profile?.id;
  const suggested = COMPANION_SUGGESTIONS[primary] || ['drawer', 'shelf'];
  const groups = profileOptions();
  const all = groups.flatMap((g) => g.items);

  $('#addSpaceType').innerHTML = all
    .sort((a, b) => (suggested.includes(b.id) ? 1 : 0) - (suggested.includes(a.id) ? 1 : 0))
    .map((p) => `<option value="${p.id}">${esc(tx(p.labelAr))}</option>`).join('');

  $('#spacesList').innerHTML = state.extraSpaces.map((sp, i) => `
    <div class="item" data-space="${i}">
      <div>
        <strong>${esc(tx(sp.profile.spaceTypeAr))}</strong>
        <div class="item-dims">
          <label>${esc(t('width'))}<input type="number" data-sf="widthCm" value="${sp.size.widthCm}" step="1" min="1"></label>
          <label>${esc(t('depth'))}<input type="number" data-sf="depthCm" value="${sp.size.depthCm}" step="1" min="1"></label>
          <label>${esc(t('height'))}<input type="number" data-sf="heightCm" value="${sp.size.heightCm}" step="1" min="1"></label>
        </div>
      </div>
      <button class="item-del" data-dropspace="${i}" aria-label="${esc(t('spaceRemove'))}">×</button>
    </div>`).join('');
}

function onAddSpace() {
  const prof = getProfile($('#addSpaceType').value);
  if (!prof) return;
  const d = prof.defaultSizeCm || {};
  state.extraSpaces.push({
    id: `sp${Date.now()}`,
    name: tx(prof.spaceTypeAr),
    profile: prof,
    size: { widthCm: d.width || 45, depthCm: d.depth || 40, heightCm: d.height || 20 },
  });
  renderSpaces();
  runSpaces();
}

/**
 * بيعيد التوزيع على كل المساحات مع بعض.
 * اللي بيفيض من السطح مابيختفيش — بيروح المساحة اللي بعدها بالترتيب.
 */
function runSpaces() {
  const out = $('#spacesResult');
  if (!state.extraSpaces.length || !state.plan) {
    out.classList.add('hidden');
    return;
  }
  const spaces = [
    { id: 'primary', name: tx(state.profile.spaceTypeAr), profile: state.profile, size: state.surface },
    ...state.extraSpaces.map((sp) => ({ ...sp, name: tx(sp.profile.spaceTypeAr) })),
  ];
  const res = planSpaces(spaces, state.items, planOpts());
  const sum = moveSummary(res, 'primary');

  out.classList.remove('hidden');
  out.innerHTML = [
    ...sum.relocated.map((r) => `<div class="note ok"><span>📦</span><span>${
      esc(t('spacesRelocated', { n: r.ids.length, where: r.name }))}</span></div>`),
    sum.homelessCount
      ? `<div class="note warn"><span>⚠️</span><span>${esc(t('spacesHomeless', { n: sum.homelessCount }))}</span></div>`
      : `<div class="note ok"><span>✅</span><span>${esc(t('spacesAllPlaced'))}</span></div>`,
  ].join('');
}

/* ═══════════ ٦: التوجيه بالكلام ═══════════ */

async function onAdaptProfile() {
  const caller = await aiReady();
  if (!caller) return toast(t('t_noAI'));
  const intent = $('#adaptIntent').value.trim();
  if (!intent) return toast(t('t_writeIntent'));
  if (!state.profile) return toast(t('t_needSpace'));

  loading(true, t('t_rewriting'));
  try {
    const adapted = await adaptProfile({ profile: state.profile, intent, caller, lang: getLang() });
    if (!adapted) throw new Error(t('t_noRules'));
    const before = state.profile.spaceTypeAr;
    state.profile = normalizeProfile(adapted, state.profile);
    if (state.profile.spaceTypeAr !== before) applyProfileSize();

    // الفئات اتغيرت، فأي حاجة فئتها بقت مش موجودة بترجع "حاجة تانية"
    for (const it of state.items) {
      if (!state.profile.categories[it.category]) it.category = 'other';
    }
    renderDetectedSpace();
    renderItems();
    $('#changeSpaceWrap').classList.add('hidden');
    toast(t('t_rulesChanged'));
  } catch (err) {
    toast(err.message);
  } finally {
    loading(false);
  }
}

/* ═══════════ ٧: اسأل عن مساحتك ═══════════ */

async function onAsk() {
  const caller = await aiReady();
  if (!caller) return toast(t('t_noAI'));
  const question = $('#askInput').value.trim();
  if (!question) return toast(t('t_writeQuestion'));
  if (!state.plan) return toast(t('t_calcFirst'));

  loading(true, t('thinking'));
  try {
    $('#askAnswer').textContent = t('thinking');
    $('#askAnswer').classList.remove('hidden');
    const answer = await askAboutSpace({
      question, plan: state.plan, mode: isBag() ? 'bag' : 'surface', caller, lang: getLang(),
      onText: ({ text }) => { $('#askAnswer').textContent = text; },
    });
    $('#askAnswer').textContent = answer.trim() || t('t_noAnswer');
  } catch (err) {
    toast(err.message);
  } finally {
    loading(false);
  }
}

init();

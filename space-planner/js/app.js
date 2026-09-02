/**
 * app.js — الربط بين الكاميرا، الذكاء، الحساب، والرسم.
 */
import { SCALE_REFERENCES, scaleRefGroups, toCm, normalizeBox, computeScale, boxToCm, perspectiveCorrect, scaleConfidence, round1 } from './geometry.js';
import { pack3D, packingOrder } from './packing.js';
import { layoutSurface } from './surface.js';
import { renderDeskPlan, renderBagPlan, renderLegend } from './render.js';
import { aiReady, canSendImages, analyzeScene, adaptProfile, explainPlan, askAboutSpace, renderAfterImage, fileToBase64Resized, CAN_RENDER_IMAGE } from './ai.js';
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
  // إيد المستخدم اللي الموديل استنتجها من الصورة — null يعني اختياره هو اللي ساري
  handDetected: null,
  // المرجع اللي الموديل لقاه بنفسه في وضع «لاقيها إنت»
  autoRef: null,
  // إحنا اللي عدّينا المراجعة؟ الشريط في شاشة النتيجة بيتعلق على ده
  autoAccepted: false,
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

  // القوايم بتتبني من بيانات، فبتتعاد — والاختيار الحالي بيرجع مكانه
  const keepRef = $('#scaleRef').value;
  $('#scaleRef').innerHTML = scaleRefGroups().map((g) => `<optgroup label="${esc(t(g.group))}">${
    g.items.map((r) => `<option value="${r.id}">${esc(tx(r.labelAr))}</option>`).join('')
  }</optgroup>`).join('');
  $('#scaleRef').value = keepRef || store.getPrefs().scaleRef || 'card';

  // نوع المساحة بيبدأ دايماً «اكتشف تلقائياً» — مش بيتخزن من مرة للتانية
  const keepType = $('#spaceType').value;
  $('#spaceType').innerHTML =
    `<option value="auto">${esc(t('autoDetect'))}</option>` +
    profileOptions().map((g) => `<optgroup label="${esc(t(g.group))}">${
      g.items.map((p) => `<option value="${p.id}">${esc(tx(p.labelAr))}</option>`).join('')
    }</optgroup>`).join('');
  $('#spaceType').value = keepType || 'auto';
  updateHints();
  updateSizeMethod();

  // اللي معروض دلوقتي يتعاد رسمه باللغة الجديدة
  if (state.profile) renderDetectedSpace();
  if (state.items.length) renderItems();
  if (state.plan) (isBag() ? renderBagResult : renderDeskResult)();
}

function updateHints() {
  const picked = $('#spaceType').value;
  $('#spaceTypeHint').textContent = t(picked === 'auto' ? 'autoHint' : 'pickedHint');
  // الارتفاع بيتسأل عنه بس لو المستخدم قال بنفسه إن دي حاجة بترص جواها.
  // قبل ما نشوف الصورة مفيش حاجة اسمها «شنطة» — فمفيش مقاسات طيران هنا.
  const container = picked !== 'auto' && isContainer(getProfile(picked));
  $('#sizeH').classList.toggle('hidden', !container);
}

/** تلات طرق للمقاس: الموديل يلاقي المسطرة، حاجة إحنا مختارينها، أو مقاس المساحة نفسها. */
function updateSizeMethod() {
  const method = $('#sizeMethod').value;
  $('#sizeMethodHint').textContent = t(
    method === 'auto' ? 'methodAutoHint' : method === 'ref' ? 'methodRefHint' : 'methodKnownHint');
  $('#refWrap').classList.toggle('hidden', method !== 'ref');
  $('#knownWrap').classList.toggle('hidden', method !== 'known');
  $('#spanWrap').classList.toggle('hidden', $('#sizeUnit').value !== 'span');
  store.setPrefs({ sizeMethod: method });
}

/** بيقرا المقاس اللي المستخدم كتبه ويحوّله لسنتيمترات مهما كانت وحدته. */
function readKnownSize() {
  const unit = $('#sizeUnit').value;
  const span = parseFloat($('#spanCm').value) || 22;
  const w = toCm($('#sizeW').value, unit, span);
  const d = toCm($('#sizeD').value, unit, span);
  const h = toCm($('#sizeH').value, unit, span);
  return { widthCm: w, depthCm: d, heightCm: h };
}

/* ═══════════ التهيئة ═══════════ */
function init() {
  initLang();
  const prefs = store.getPrefs();
  applyLang();
  $('#dominantHand').value = prefs.dominantHand || 'right';
  // «لاقيها إنت» هي الافتراضي — أقل خطوة على المستخدم
  $('#sizeMethod').value = prefs.sizeMethod || 'auto';
  $('#optAutoSkip').checked = autoSkipOn();
  $('#sizeUnit').value = prefs.sizeUnit || 'cm';
  $('#spanCm').value = prefs.spanCm || 22;
  updateSizeMethod();
  syncActionBar('capture');
  onScaleRefChange();
  renderSaved();

  $('#btnLang').addEventListener('click', () => {
    setLang(getLang() === 'ar' ? 'en' : 'ar');
    applyLang();
  });

  $$('[data-goto]').forEach((b) => b.addEventListener('click', () => showScreen(b.dataset.goto)));
  $('#scaleRef').addEventListener('change', onScaleRefChange);
  $('#sizeMethod').addEventListener('change', updateSizeMethod);
  $('#sizeUnit').addEventListener('change', () => {
    store.setPrefs({ sizeUnit: $('#sizeUnit').value });
    updateSizeMethod();
  });
  $('#spanCm').addEventListener('change', () => store.setPrefs({ spanCm: +$('#spanCm').value || 22 }));
  $('#btnPick').addEventListener('click', () => $('#fileInput').click());
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

  $('#btnSettings').addEventListener('click', () => $('#settingsDialog').showModal());
  setupInstall();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* بيشتغل عادي من غيره */ });
  }
}

function onScaleRefChange() {
  const ref = SCALE_REFERENCES[$('#scaleRef').value] || SCALE_REFERENCES.card;
  $('#customRefWrap').classList.toggle('hidden', ref.id !== 'custom');
  // بنقول للمستخدم إن المرجع ده تقريبي بدل ما ندّعي دقة مش موجودة
  $('#scaleHint').textContent = ref.id === 'custom' ? tx(ref.hintAr)
    : `${tx(ref.hintAr)}${ref.approx ? ' · ' + t('approxNote') : ''}`;
  store.setPrefs({ scaleRef: ref.id });
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
    $('#btnAnalyze').disabled = false;
  } catch (err) {
    toast(err.message);
  }
}

/* ═══════════ التحليل ═══════════ */
async function onAnalyze() {
  const sample = await aiReady();
  if (!sample) return toast(t('t_noAIphoto'));
  if (!state.image) return toast(t('t_pickPhoto'));
  if (!(await canSendImages(sample))) return toast(t('t_noImages'));

  const method = $('#sizeMethod').value;
  const refId = $('#scaleRef').value;
  const ref = SCALE_REFERENCES[refId] || SCALE_REFERENCES.card;
  const customCm = parseFloat($('#customRefCm').value);
  const customName = $('#customRefName').value.trim();
  const known = readKnownSize();

  // وضع «لاقيها إنت» مش بياخد مدخلات — الموديل هو اللي هيدوّر
  if (method === 'ref' && refId === 'custom' && !(customCm > 0)) return toast(t('t_needRefCm'));
  if (method === 'known' && !(known.widthCm > 0 && known.depthCm > 0)) return toast(t('t_needKnownSize'));

  store.setPrefs({ dominantHand: $('#dominantHand').value, customRefCm: customCm || 0 });

  loading(true, t('t_analyzing'));
  try {
    const chosen = $('#spaceType').value;
    const intent = $('#intent').value.trim();
    // لو المستخدم اختار نوع، بنستخدم قواعده الجاهزة. لو "اكتشف تلقائياً"، الموديل هيولّدها.
    const chosenProfile = chosen !== 'auto' ? getProfile(chosen) : null;

    const analysis = await analyzeScene({
      image: state.image,
      mode: isBag() ? 'bag' : 'surface',
      scaleRefLabel: method === 'auto'
        ? ''
        : method === 'known'
          ? `the space itself (${known.widthCm} cm wide)`
          : refId === 'custom'
            ? `${customName || 'reference object'} (${customCm} cm wide)`
            : tx(ref.labelAr),
      profile: chosenProfile,
      intent,
      sample,
      lang: getLang(),
      sizeMethod: method,
    });

    // البروفايل المولّد بيتفلتر قبل ما يوصل للخوارزمية.
    // الموديل بيقول كمان هل دي حاجة بترتب عليها ولا بترص جواها.
    if (chosenProfile) {
      state.profile = chosenProfile;
    } else if (analysis.generatedProfile) {
      const kind = analysis.generatedProfile.spaceKind;
      state.profile = normalizeProfile(analysis.generatedProfile,
        kind === 'container' ? GENERIC_CONTAINER : GENERIC_PROFILE);
    } else {
      state.profile = GENERIC_PROFILE;
    }

    // نقطة المعايرة: يا حاجة معروفة في الصورة، يا المساحة نفسها اللي المستخدم قاسها.
    // في الحالتين الرياضة واحدة — اللي بيختلف هو مين المسطرة.
    const surfBox = analysis.surface?.box ? normalizeBox(analysis.surface.box) : null;
    let scale, refBox;
    // مدخلات حساب الثقة الإجمالية بعدين
    let scaleScore = 1, approxRef = false;

    if (method === 'known') {
      if (!surfBox) throw new Error(t('t_spaceNotFound'));
      // العرض بس — العمق في الصورة مايل فما ينفعش يعاير عليه
      const k = known.widthCm / surfBox.w;
      scale = { cmPerUnitX: k, cmPerUnitY: k, rotated: false, aspectError: 0 };
      refBox = surfBox;
      state.userSize = { ...known };
      // المقاس ده من المستخدم نفسه، مش من الصورة — مفيش خصم ثقة عليه
      state.autoRef = null;
      $('#scaleBanner').className = 'banner ok';
      $('#scaleBanner').textContent = t('b_known', { w: known.widthCm, d: known.depthCm });
    } else {
      refBox = analysis.scaleReference?.found ? normalizeBox(analysis.scaleReference.box) : null;

      // «لاقيها إنت»: الموديل بيقول لقى إيه وفين بس. المقاس بالسنتيمتر بييجي من
      // SCALE_REFERENCES — مش من كلامه. حاجة مش في الكتالوج = مبنقيسش عليها خالص.
      let usedRef = ref;
      if (method === 'auto') {
        const rid = analysis.scaleReference?.refId;
        const picked = typeof rid === 'string' && rid !== 'custom' ? SCALE_REFERENCES[rid] : null;
        if (!refBox) throw new Error(t('t_autoRefNone'));
        if (!picked) throw new Error(t('t_autoRefUnknown', { what: analysis.scaleReference?.whatAr || '—' }));
        usedRef = picked;
        state.autoRef = picked;
      } else {
        state.autoRef = null;
        if (!refBox) {
          throw new Error(t('t_refNotFound', {
            what: refId === 'custom' ? (customName || t('scaleRef')) : tx(ref.labelAr),
          }));
        }
      }

      if (method === 'ref' && refId === 'custom') {
        const k = customCm / refBox.w;
        scale = { cmPerUnitX: k, cmPerUnitY: k, rotated: false, aspectError: 0 };
        // مرجع كتبه المستخدم بنفسه مش مواصفة موثّقة — بيتعامل كتقريبي
        approxRef = true;
      } else {
        scale = computeScale(refBox, usedRef.widthCm, usedRef.heightCm);
        approxRef = !!usedRef.approx;
      }
      state.userSize = null;

      const conf = scaleConfidence(scale, refBox);
      scaleScore = conf.score;
      $('#scaleBanner').className = `banner ${conf.score > 0.45 ? 'ok' : 'warn'}`;
      const level = t(conf.score > 0.75 ? 'conf_high' : conf.score > 0.45 ? 'conf_mid' : 'conf_low');
      // في وضع «لاقيها إنت» بنقول للمستخدم إن الموديل هو اللي اختار المرجع،
      // وهل ده مقاس قياسي موثّق ولا حاجة يومية تقريبية.
      $('#scaleBanner').innerHTML = method === 'auto'
        ? t('b_scaleAuto', {
          what: esc(tx(usedRef.labelAr)),
          kind: t(usedRef.approx ? 'refApprox' : 'refExact'),
          level,
        })
        : conf.score > 0.45
          ? t('b_scaleOk', { what: esc(analysis.scaleReference.whatAr || tx(ref.labelAr)), level })
          : t('b_scaleWarn', { level });
    }
    state.scale = scale;

    // مقاس المساحة: اللي المستخدم كتبه بيغلب أي تقدير من الصورة
    if (state.userSize) {
      const def = state.profile?.defaultSizeCm || {};
      state.surface = {
        widthCm: known.widthCm,
        depthCm: known.depthCm,
        heightCm: known.heightCm || def.height || 30,
      };
    } else if (surfBox && !isBag()) {
      const d = boxToCm(surfBox, scale);
      state.surface = {
        widthCm: clampCm(d.widthCm, 40, 400),
        depthCm: clampCm(d.depthCm, 30, 200),
        heightCm: state.profile?.defaultSizeCm?.height || 30,
      };
    } else {
      applyProfileSize();
    }
    if (analysis.windowSide) store.setPrefs({ windowSide: analysis.windowSide });

    // إيد المستخدم: بنقبل "right" أو "left" بس. "unknown" أو أي حاجة تانية
    // معناها سيب اختياره زي ما هو — التخمين هنا بيقلب الترتيب كله.
    const hand = analysis.dominantHand;
    state.handDetected = hand === 'right' || hand === 'left' ? hand : null;
    if (state.handDetected) {
      const changed = $('#dominantHand').value !== state.handDetected;
      $('#dominantHand').value = state.handDetected;
      store.setPrefs({ dominantHand: state.handDetected });
      // ممنوع نغيّر اختياره من ورا ضهره — لو اتغيّر فعلاً بنقوله على طول،
      // والملاحظة بتفضل ظاهرة في المراجعة كمان
      if (changed) toast(t('handDetected', { hand: t(state.handDetected) }));
    }

    // الحاجات: الموديل حدد المربعات، والرياضة حسبت السنتيمترات
    state.items = analysis.objects.map((o, i) => {
      const box = normalizeBox(o.box);
      const dims = boxToCm(box, scale);
      const corr = perspectiveCorrect(box, refBox);
      return {
        id: `it${i}`,
        nameAr: o.nameAr || t('newItem'),
        category: o.category || 'other',
        widthCm: clampCm(dims.widthCm * corr, 0.5, 300),
        depthCm: clampCm(dims.depthCm * corr, 0.5, 300),
        heightCm: clampCm(Number(o.heightCm) || 5, 0.2, 200),
        // الوزن رقم من الموديل زي أي رقم تاني — بيتقصّ قبل ما يوصل لحد الطيران
        weightKg: clampCm(o.weightKg, 0, 30),
        frequency: o.frequency || 'medium',
        fragile: !!o.fragile,
        confidence: Math.max(0, Math.min(1, Number(o.confidence) || 0.6)),
      };
    });

    if (!state.items.length) throw new Error(t('t_noObjects'));

    renderDetectedSpace();
    renderItems();

    // ثقة عالية = مفيش داعي نوقّفه على المراجعة. وفي وضع «لاقيها إنت» زيادة:
    // لو الموديل نفسه مش واثق إنه عرف المرجع صح، بنراجع مهما كان الباقي.
    const refSure = method !== 'auto' || (Number(analysis.scaleReference?.confidence) || 0) >= 0.6;
    state.autoAccepted = autoSkipOn() && refSure &&
      overallConfidence({ scaleScore, approxRef, items: state.items }) >= AUTO_SKIP_THRESHOLD;
    if (state.autoAccepted && await onPlan()) return;
    state.autoAccepted = false;
    showScreen('review');
  } catch (err) {
    toast(err.message);
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
  state.autoRef = null;
  state.autoAccepted = false;
  const chosen = $('#spaceType').value;
  state.profile = chosen === 'auto' ? BUILT_IN_PROFILES.desk : getProfile(chosen);
  // لو كتب المقاس في خطوة المقاس، منستهبلش ونرجّعه للمقاس النموذجي
  const known = $('#sizeMethod').value === 'known' ? readKnownSize() : null;
  state.userSize = known && known.widthCm > 0 && known.depthCm > 0 ? known : null;
  applyProfileSize();
  addItem();
  renderDetectedSpace();
  $('#scaleBanner').className = 'banner warn';
  $('#scaleBanner').textContent = t('b_manual');
  renderItems();
  showScreen('review');
}

const clampCm = (v, lo, hi) => round1(Math.max(lo, Math.min(hi, Number(v) || lo)));

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

  const spaceEditor = `
    <div class="item space-size">
      <div>
        <strong>${esc(bag ? t('spaceSize') : t('surfaceSize'))}</strong>
        <p class="hint">${esc(bag ? t('containerSizeHint') : t('surfaceSizeHint'))}</p>
        <div class="item-dims">
          <label>${esc(t('width'))}<input type="number" data-surface="widthCm" value="${state.surface.widthCm}" step="1" min="1"></label>
          <label>${esc(t('depth'))}<input type="number" data-surface="depthCm" value="${state.surface.depthCm}" step="1" min="1"></label>
          ${bag ? `<label>${esc(t('height'))}<input type="number" data-surface="heightCm" value="${state.surface.heightCm || 30}" step="1" min="1"></label>` : ''}
          ${airline}
        </div>
      </div>
    </div>`;

  $('#itemsList').innerHTML = spaceEditor + weightHint + state.items.map((it) => `
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
  $('#itemsList').onchange = (e) => {
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
  $('#planView').innerHTML = renderBagPlan(state.bin, p.placed);
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
  const sample = await aiReady();
  if (!sample) return;
  try {
    const text = await explainPlan({ mode: isBag() ? 'bag' : 'surface', plan: state.plan, sample, lang: getLang() });
    if (text.trim()) {
      $('#aiNote').textContent = text.trim();
      $('#aiNote').classList.remove('hidden');
    }
  } catch { /* الشرح رفاهية — المخطط هو الأساس */ }
}

async function onAfterImage() {
  const sample = await aiReady();
  if (!state.image) return toast(t('t_noOriginal'));
  loading(true, t('t_drawing'));
  try {
    const url = await renderAfterImage({ image: state.image, plan: state.plan, sample });
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

/* ═══════════ ٦: التوجيه بالكلام ═══════════ */

async function onAdaptProfile() {
  const sample = await aiReady();
  if (!sample) return toast(t('t_noAI'));
  const intent = $('#adaptIntent').value.trim();
  if (!intent) return toast(t('t_writeIntent'));
  if (!state.profile) return toast(t('t_needSpace'));

  loading(true, t('t_rewriting'));
  try {
    const adapted = await adaptProfile({ profile: state.profile, intent, sample, lang: getLang() });
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
  const sample = await aiReady();
  if (!sample) return toast(t('t_noAI'));
  const question = $('#askInput').value.trim();
  if (!question) return toast(t('t_writeQuestion'));
  if (!state.plan) return toast(t('t_calcFirst'));

  loading(true, t('thinking'));
  try {
    $('#askAnswer').textContent = t('thinking');
    $('#askAnswer').classList.remove('hidden');
    const answer = await askAboutSpace({
      question, plan: state.plan, mode: isBag() ? 'bag' : 'surface', sample, lang: getLang(),
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

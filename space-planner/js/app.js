/**
 * app.js — الربط بين الكاميرا، الذكاء، الحساب، والرسم.
 */
import { SCALE_REFERENCES, normalizeBox, computeScale, boxToCm, perspectiveCorrect, scaleConfidence, round1 } from './geometry.js';
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
  plan: null,
  bin: null,
};

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

  // القوايم بتتبني من بيانات، فبتتعاد
  $('#scaleRef').innerHTML = Object.values(SCALE_REFERENCES)
    .map((r) => `<option value="${r.id}">${esc(r.labelAr)}</option>`).join('');
  $('#scaleRef').value = store.getPrefs().scaleRef || 'card';
  const groups = profileOptions();
  $('#spaceType').innerHTML =
    `<option value="auto">${esc(t('autoDetect'))}</option>` +
    groups.map((g) => `<optgroup label="${esc(t(g.group))}">${
      g.items.map((p) => `<option value="${p.id}">${esc(tx(p.labelAr))}</option>`).join('')
    }</optgroup>`).join('');
  $('#spaceType').value = store.getPrefs().spaceType || 'auto';
  $('#bagPreset').innerHTML = CABIN_BAGS
    .map((b) => `<option value="${b.id}">${esc(b.nameAr)}${b.w ? ` — ${b.w}×${b.d}×${b.h}` : ''}</option>`).join('');
  updateHints();

  // اللي معروض دلوقتي يتعاد رسمه باللغة الجديدة
  if (state.profile) renderDetectedSpace();
  if (state.items.length) renderItems();
  if (state.plan) (isBag() ? renderBagResult : renderDeskResult)();
}

function updateHints() {
  const picked = $('#spaceType').value;
  $('#spaceTypeHint').textContent = t(picked === 'auto' ? 'autoHint' : 'pickedHint');
  // مقاسات الحاوية محتاجة ارتفاع كمان
  const container = picked !== 'auto' && isContainer(getProfile(picked));
  $('#bagOpts').classList.toggle('hidden', !container);
  $('#deskOpts').classList.remove('hidden');
}

/* ═══════════ التهيئة ═══════════ */
function init() {
  initLang();
  const prefs = store.getPrefs();
  applyLang();
  $('#dominantHand').value = prefs.dominantHand || 'right';
  syncActionBar('capture');
  onScaleRefChange();
  renderSaved();

  $('#btnLang').addEventListener('click', () => {
    setLang(getLang() === 'ar' ? 'en' : 'ar');
    applyLang();
  });

  $$('[data-goto]').forEach((b) => b.addEventListener('click', () => showScreen(b.dataset.goto)));
  $('#scaleRef').addEventListener('change', onScaleRefChange);
  $('#bagPreset').addEventListener('change', () => {
    $('#customBagWrap').classList.toggle('hidden', $('#bagPreset').value !== 'custom');
  });
  $('#btnPick').addEventListener('click', () => $('#fileInput').click());
  $('#fileInput').addEventListener('change', onFilePicked);
  $('#btnAnalyze').addEventListener('click', onAnalyze);
  $('#btnManual').addEventListener('click', onManual);
  $('#spaceType').addEventListener('change', () => {
    store.setPrefs({ spaceType: $('#spaceType').value });
    updateHints();
  });
  $('#btnChangeSpace').addEventListener('click', () => $('#changeSpaceWrap').classList.toggle('hidden'));
  $('#btnAdapt').addEventListener('click', onAdaptProfile);
  $('#btnAsk').addEventListener('click', onAsk);
  $('#btnAddItem').addEventListener('click', () => { addItem(); renderItems(); });
  $('#btnPlan').addEventListener('click', onPlan);
  $('#btnAfterImage').addEventListener('click', onAfterImage);
  $('#btnSave').addEventListener('click', onSave);

  $('#btnSettings').addEventListener('click', () => $('#settingsDialog').showModal());
  setupInstall();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* بيشتغل عادي من غيره */ });
  }
}

function onScaleRefChange() {
  const isCustom = $('#scaleRef').value === 'custom';
  $('#customRefWrap').classList.toggle('hidden', !isCustom);
  store.setPrefs({ scaleRef: $('#scaleRef').value });
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

  const refId = $('#scaleRef').value;
  const ref = SCALE_REFERENCES[refId];
  const customCm = parseFloat($('#customRefCm').value);
  if (refId === 'custom' && !(customCm > 0)) return toast(t('t_needRefCm'));

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
      scaleRefLabel: refId === 'custom' ? `${customCm} cm wide object` : ref.labelAr,
      profile: chosenProfile,
      intent,
      sample,
      lang: getLang(),
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

    const refBox = analysis.scaleReference?.found ? normalizeBox(analysis.scaleReference.box) : null;
    if (!refBox) {
      throw new Error(t('t_refNotFound', { what: refId === 'custom' ? t('scaleRef') : ref.labelAr }));
    }

    // من غير مرجع، المقاسات تخمين. مع المرجع، دي رياضة.
    let scale;
    if (refId === 'custom') {
      const k = customCm / refBox.w;
      scale = { cmPerUnitX: k, cmPerUnitY: k, rotated: false, aspectError: 0 };
    } else {
      scale = computeScale(refBox, ref.widthCm, ref.heightCm);
    }
    state.scale = scale;

    const conf = scaleConfidence(scale, refBox);
    $('#scaleBanner').className = `banner ${conf.score > 0.45 ? 'ok' : 'warn'}`;
    const level = t(conf.score > 0.75 ? 'conf_high' : conf.score > 0.45 ? 'conf_mid' : 'conf_low');
    $('#scaleBanner').innerHTML = conf.score > 0.45
      ? t('b_scaleOk', { what: esc(analysis.scaleReference.whatAr || ref.labelAr), level })
      : t('b_scaleWarn', { level });

    // سطح الشغل
    if (!isBag() && analysis.surface?.box) {
      const sBox = normalizeBox(analysis.surface.box);
      if (sBox) {
        const d = boxToCm(sBox, scale);
        state.surface = { widthCm: clampCm(d.widthCm, 40, 400), depthCm: clampCm(d.depthCm, 30, 200) };
      }
    } else {
      applyProfileSize();
    }
    if (analysis.windowSide) store.setPrefs({ windowSide: analysis.windowSide });

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
        frequency: o.frequency || 'medium',
        fragile: !!o.fragile,
        confidence: Number(o.confidence) || 0.6,
      };
    });

    if (!state.items.length) throw new Error(t('t_noObjects'));

    renderDetectedSpace();
    renderItems();
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
  const chosen = $('#spaceType').value;
  state.profile = chosen === 'auto' ? BUILT_IN_PROFILES.desk : getProfile(chosen);
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
    widthCm: 10, depthCm: 10, heightCm: 10,
    frequency: 'medium', fragile: false, confidence: 1,
  });
}

function renderItems() {
  const cats = state.profile?.categories || GENERIC_PROFILE.categories;
  const catOptions = Object.entries(cats).map(([k, v]) => [k, tx(v.labelAr)]);

  const surfaceEditor = !isBag() ? `
    <div class="item">
      <div>
        <strong>${esc(t('surfaceSize'))}</strong>
        <p class="hint">${esc(t('surfaceSizeHint'))}</p>
        <div class="item-dims">
          <label>${esc(t('width'))}<input type="number" data-surface="widthCm" value="${state.surface.widthCm}" step="1"></label>
          <label>${esc(t('depth'))}<input type="number" data-surface="depthCm" value="${state.surface.depthCm}" step="1"></label>
        </div>
      </div>
    </div>` : '';

  $('#itemsList').innerHTML = surfaceEditor + state.items.map((it) => `
    <div class="item ${it.confidence < 0.5 ? 'conf-low' : ''}" data-id="${it.id}">
      <div>
        <input class="item-name" data-f="nameAr" value="${esc(it.nameAr)}" aria-label="${esc(t('itemName'))}">
        <div class="item-dims">
          <label>${esc(t('width'))}<input type="number" data-f="widthCm" value="${it.widthCm}" step="0.5" min="0.5"></label>
          <label>${esc(t('depth'))}<input type="number" data-f="depthCm" value="${it.depthCm}" step="0.5" min="0.5"></label>
          <label>${esc(t('height'))}<input type="number" data-f="heightCm" value="${it.heightCm}" step="0.5" min="0.2"></label>
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
    if (surfaceField) { state.surface[surfaceField] = Number(e.target.value) || 0; return; }
    const row = e.target.closest('[data-id]');
    const f = e.target.dataset.f;
    if (!row || !f) return;
    const it = state.items.find((x) => x.id === row.dataset.id);
    if (!it) return;
    it[f] = ['widthCm', 'depthCm', 'heightCm'].includes(f) ? Number(e.target.value) || 0 : e.target.value;
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
    // مقاس الحاوية: من قائمة الطيران لو شنطة سفر، وإلا من البروفايل أو من المستخدم
    const preset = state.profile.usesAirlinePresets ? CABIN_BAGS.find((b) => b.id === $('#bagPreset').value) : null;
    const custom = { widthCm: +$('#bagW').value, depthCm: +$('#bagD').value, heightCm: +$('#bagH').value };
    const def = state.profile.defaultSizeCm || {};
    const bin = preset && preset.id !== 'custom'
      ? { widthCm: preset.w, depthCm: preset.d, heightCm: preset.h, maxWeightKg: preset.kg }
      : {
          widthCm: custom.widthCm || def.width,
          depthCm: custom.depthCm || def.depth,
          heightCm: custom.heightCm || def.height,
          maxWeightKg: 0,
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
  showScreen('result');
  maybeExplain();
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
    ${p.stats.totalWeightKg ? `<div class="stat"><b>${p.stats.totalWeightKg}${weightWarn}</b><span>${esc(t('statKg'))}</span></div>` : ''}`;
  $('#planView').innerHTML = renderBagPlan(state.bin, p.placed);
  $('#legendView').innerHTML = renderLegend(p.placed);
  $('#notesView').innerHTML = p.stats.overWeight
    ? `<div class="note warn"><span>⚠️</span><span>${esc(t('n_overweight'))}</span></div>` : '';
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
  if (size?.width > 0 && size?.depth > 0) {
    state.surface = { widthCm: size.width, depthCm: size.depth, heightCm: size.height || 30 };
    if (isBag()) {
      $('#bagW').value = size.width; $('#bagD').value = size.depth; $('#bagH').value = size.height || 30;
    }
  }
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

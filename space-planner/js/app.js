/**
 * app.js — الربط بين الكاميرا، الذكاء، الحساب، والرسم.
 */
import { SCALE_REFERENCES, normalizeBox, computeScale, boxToCm, perspectiveCorrect, scaleConfidence, round1 } from './geometry.js';
import { pack3D, packingOrder } from './packing.js';
import { layoutSurface } from './surface.js';
import { renderDeskPlan, renderBagPlan, renderLegend } from './render.js';
import { aiReady, canSendImages, analyzeScene, adaptProfile, explainPlan, askAboutSpace, renderAfterImage, fileToBase64Resized, CAN_RENDER_IMAGE } from './ai.js';
import { BUILT_IN_PROFILES, GENERIC_PROFILE, normalizeProfile, profileOptions, getProfile, ZONES } from './profiles.js';
import { CABIN_BAGS, BAG_CATEGORIES } from '../data/bags.js';
import { store } from './store.js';

const FREQ_LABELS = { high:'بستخدمها كتير', medium:'أحياناً', low:'نادراً' };

const state = {
  mode: 'surface',
  profile: null,      // بروفايل المساحة — جاهز أو مولّد بالـAI
  image: null,
  items: [],
  scale: null,
  surface: { widthCm: 140, depthCm: 70 },
  plan: null,
  bin: null,
};

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

/* ═══════════ أدوات واجهة ═══════════ */
function showScreen(name) {
  $$('.screen').forEach((s) => s.classList.toggle('active', s.dataset.screen === name));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function toast(msg, ms = 3600) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add('hidden'), ms);
}
function loading(on, text = 'بحلل...') {
  $('#loaderText').textContent = text;
  $('#loader').classList.toggle('hidden', !on);
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

/* ═══════════ التهيئة ═══════════ */
function init() {
  // مراجع القياس
  $('#scaleRef').innerHTML = Object.values(SCALE_REFERENCES)
    .map((r) => `<option value="${r.id}">${r.labelAr}</option>`).join('');
  // الشنط
  $('#bagPreset').innerHTML = CABIN_BAGS
    .map((b) => `<option value="${b.id}">${b.nameAr}${b.w ? ` — ${b.w}×${b.d}×${b.h} سم` : ''}</option>`).join('');

  $('#spaceType').innerHTML =
    '<option value="auto">🤖 اكتشف تلقائياً من الصورة</option>' +
    profileOptions().map((p) => `<option value="${p.id}">${p.labelAr}</option>`).join('');

  const prefs = store.getPrefs();
  $('#spaceType').value = prefs.spaceType || 'auto';
  $('#scaleRef').value = prefs.scaleRef || 'card';
  $('#dominantHand').value = prefs.dominantHand || 'right';
  onScaleRefChange();
  renderSaved();

  $$('.mode-card').forEach((c) => c.addEventListener('click', () => {
    state.mode = c.dataset.mode;
    $('#captureTitle').textContent = state.mode === 'surface' ? 'صوّر المساحة' : 'صوّر الحاجات اللي هتشيلها';
    $('#deskOpts').classList.toggle('hidden', state.mode !== 'surface');
    $('#bagOpts').classList.toggle('hidden', state.mode !== 'bag');
    $('#scaleHint').textContent = state.mode === 'surface'
      ? 'حط الحاجة دي على المكتب جنب باقي الحاجات، وصوّر من فوق قدر الإمكان:'
      : 'حط الحاجة دي جنب الحاجات اللي هتترص، وافردهم على الأرض وصوّرهم من فوق:';
    showScreen('capture');
  }));

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
    $('#spaceTypeHint').textContent = $('#spaceType').value === 'auto'
      ? 'لو سيبتها على «اكتشف تلقائياً»، الموديل هيبص على الصورة ويعرف هي إيه ويكتب قواعد ترتيبها بنفسه.'
      : 'اخترت النوع بنفسك — الموديل هيستخدم قواعد جاهزة ومجرّبة للمساحة دي.';
  });
  $('#btnChangeSpace').addEventListener('click', () => $('#changeSpaceWrap').classList.toggle('hidden'));
  $('#btnAdapt').addEventListener('click', onAdaptProfile);
  $('#btnAsk').addEventListener('click', onAsk);
  $('#btnAddItem').addEventListener('click', () => { addItem(); renderItems(); });
  $('#btnPlan').addEventListener('click', onPlan);
  $('#btnAfterImage').addEventListener('click', onAfterImage);
  $('#btnSave').addEventListener('click', onSave);

  $('#btnSettings').addEventListener('click', () => $('#settingsDialog').showModal());

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
  if (!sample) return toast('تحليل الصور مش متاح هنا — استخدم «أدخل الحاجات بنفسك»');
  if (!state.image) return toast('اختار صورة الأول');
  if (!(await canSendImages(sample))) return toast('العرض ده مش بيسمح ببعت صور — استخدم «أدخل الحاجات بنفسك»');

  const refId = $('#scaleRef').value;
  const ref = SCALE_REFERENCES[refId];
  const customCm = parseFloat($('#customRefCm').value);
  if (refId === 'custom' && !(customCm > 0)) return toast('اكتب عرض مرجع القياس بالسنتيمتر');

  store.setPrefs({ dominantHand: $('#dominantHand').value, customRefCm: customCm || 0 });

  loading(true, 'الموديل بيبص على الصورة...');
  try {
    const chosen = $('#spaceType').value;
    const intent = $('#intent').value.trim();
    // لو المستخدم اختار نوع، بنستخدم قواعده الجاهزة. لو "اكتشف تلقائياً"، الموديل هيولّدها.
    const chosenProfile = state.mode === 'surface' && chosen !== 'auto' ? getProfile(chosen) : null;

    const analysis = await analyzeScene({
      image: state.image,
      mode: state.mode,
      scaleRefLabel: refId === 'custom' ? `حاجة عرضها ${customCm} سم` : ref.labelAr,
      profile: chosenProfile,
      intent,
      sample,
    });

    if (state.mode === 'surface') {
      // البروفايل المولّد بيتفلتر قبل ما يوصل للخوارزمية
      state.profile = chosenProfile
        || (analysis.generatedProfile ? normalizeProfile(analysis.generatedProfile) : GENERIC_PROFILE);
    }

    const refBox = analysis.scaleReference?.found ? normalizeBox(analysis.scaleReference.box) : null;
    if (!refBox) {
      throw new Error(`مالقيناش ${refId === 'custom' ? 'مرجع القياس' : ref.labelAr} في الصورة. حطه في مكان واضح وصوّر تاني.`);
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
    $('#scaleBanner').innerHTML = conf.score > 0.45
      ? `✅ لقينا مرجع القياس (${esc(analysis.scaleReference.whatAr || ref.labelAr)}). دقة القياس: <b>${conf.labelAr}</b>`
      : `⚠️ دقة القياس <b>${conf.labelAr}</b> — المرجع صغير أو متصوّر بزاوية مايلة. راجع الأرقام كويس أو صوّر تاني من فوق.`;

    // سطح الشغل
    if (state.mode === 'surface' && analysis.surface?.box) {
      const sBox = normalizeBox(analysis.surface.box);
      if (sBox) {
        const d = boxToCm(sBox, scale);
        state.surface = { widthCm: clampCm(d.widthCm, 40, 400), depthCm: clampCm(d.depthCm, 30, 200) };
      }
    } else if (state.mode === 'surface') {
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
        nameAr: o.nameAr || 'حاجة',
        category: o.category || 'other',
        widthCm: clampCm(dims.widthCm * corr, 0.5, 300),
        depthCm: clampCm(dims.depthCm * corr, 0.5, 300),
        heightCm: clampCm(Number(o.heightCm) || 5, 0.2, 200),
        frequency: o.frequency || 'medium',
        fragile: !!o.fragile,
        confidence: Number(o.confidence) || 0.6,
      };
    });

    if (!state.items.length) throw new Error('مالقيناش حاجات في الصورة. جرب صورة أوضح أو ضيف الحاجات بنفسك.');

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
  if (state.mode === 'surface') {
    state.profile = chosen === 'auto' ? BUILT_IN_PROFILES.desk : getProfile(chosen);
    applyProfileSize();
  } else {
    state.profile = null;
  }
  addItem();
  renderDetectedSpace();
  $('#scaleBanner').className = 'banner warn';
  $('#scaleBanner').innerHTML = '✍️ إدخال يدوي — اكتب المقاسات بنفسك بالمسطرة. الحساب والترتيب هيشتغلوا عادي من غير أي AI.';
  renderItems();
  showScreen('review');
}

const clampCm = (v, lo, hi) => round1(Math.max(lo, Math.min(hi, Number(v) || lo)));

/* ═══════════ مراجعة الحاجات ═══════════ */
function addItem() {
  state.items.push({
    id: `it${Date.now()}`, nameAr: 'حاجة جديدة',
    category: 'other',
    widthCm: 10, depthCm: 10, heightCm: 10,
    frequency: 'medium', fragile: false, confidence: 1,
  });
}

function renderItems() {
  const catOptions = state.mode === 'surface'
    ? Object.entries(state.profile?.categories || GENERIC_PROFILE.categories).map(([k, v]) => [k, v.labelAr])
    : Object.entries(BAG_CATEGORIES).map(([k, v]) => [k, v.labelAr]);

  const surfaceEditor = state.mode === 'surface' ? `
    <div class="item">
      <div>
        <strong>📏 مقاس السطح نفسه</strong>
        <p class="hint">التقدير ده من الصورة، والصورة بزاوية فبيقل عن الحقيقة. لو تعرف مقاس السطح اكتبه — ده أهم رقم في الحسبة.</p>
        <div class="item-dims">
          <label>عرض<input type="number" data-surface="widthCm" value="${state.surface.widthCm}" step="1"></label>
          <label>عمق<input type="number" data-surface="depthCm" value="${state.surface.depthCm}" step="1"></label>
        </div>
      </div>
    </div>` : '';

  $('#itemsList').innerHTML = surfaceEditor + state.items.map((it) => `
    <div class="item ${it.confidence < 0.5 ? 'conf-low' : ''}" data-id="${it.id}">
      <div>
        <input class="item-name" data-f="nameAr" value="${esc(it.nameAr)}" aria-label="اسم الحاجة">
        <div class="item-dims">
          <label>عرض<input type="number" data-f="widthCm" value="${it.widthCm}" step="0.5" min="0.5"></label>
          <label>عمق<input type="number" data-f="depthCm" value="${it.depthCm}" step="0.5" min="0.5"></label>
          <label>ارتفاع<input type="number" data-f="heightCm" value="${it.heightCm}" step="0.5" min="0.2"></label>
        </div>
        <select data-f="category" aria-label="النوع">
          ${catOptions.map(([k, v]) => `<option value="${k}" ${it.category === k ? 'selected' : ''}>${v}</option>`).join('')}
        </select>
        ${state.mode === 'surface' ? `
        <select data-f="frequency" aria-label="معدل الاستخدام">
          ${Object.entries(FREQ_LABELS).map(([k, v]) => `<option value="${k}" ${it.frequency === k ? 'selected' : ''}>${v}</option>`).join('')}
        </select>` : ''}
      </div>
      <button class="item-del" data-del="${it.id}" aria-label="امسح">×</button>
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

/* ═══════════ الحساب ═══════════ */
async function onPlan() {
  const valid = state.items.filter((i) => i.widthCm > 0 && i.depthCm > 0 && i.heightCm > 0);
  if (!valid.length) return toast('محتاجين حاجة واحدة على الأقل بمقاسات صحيحة');

  if (state.mode === 'surface') {
    if (!(state.surface.widthCm > 20 && state.surface.depthCm > 20)) return toast('اكتب مقاس السطح الأول');
    const prefs = store.getPrefs();
    state.plan = layoutSurface(state.surface, valid, state.profile || GENERIC_PROFILE, {
      dominantHand: $('#dominantHand').value,
      windowSide: prefs.windowSide || 'none',
    });
    renderDeskResult();
  } else {
    const preset = CABIN_BAGS.find((b) => b.id === $('#bagPreset').value);
    const bin = preset.id === 'custom'
      ? { widthCm: +$('#bagW').value, depthCm: +$('#bagD').value, heightCm: +$('#bagH').value, maxWeightKg: 0 }
      : { widthCm: preset.w, depthCm: preset.d, heightCm: preset.h, maxWeightKg: preset.kg };
    if (!(bin.widthCm > 0 && bin.depthCm > 0 && bin.heightCm > 0)) return toast('اكتب مقاس الشنطة');
    state.bin = bin;

    const items = valid.map((i) => {
      const meta = BAG_CATEGORIES[i.category] || BAG_CATEGORIES.other;
      return { ...i, keepUpright: meta.keepUpright, fragile: i.fragile || meta.fragile, compressible: !!meta.compressible };
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
  $('#resultTitle').textContent = 'ترتيب ' + (p.profileAr || 'المساحة');
  $('#statsRow').innerHTML = `
    <div class="stat"><b>${p.stats.onDesk}</b><span>حاجة على السطح</span></div>
    <div class="stat"><b>${p.stats.freePercent}%</b><span>مساحة فاضية</span></div>
    <div class="stat"><b>${p.stats.removed}</b><span>اتشالت</span></div>`;
  $('#planView').innerHTML = renderDeskPlan(p);
  $('#legendView').innerHTML = renderLegend(p.placed);
  $('#notesView').innerHTML = p.notes.map((n) =>
    `<div class="note ${n.level}"><span>${n.level === 'warn' ? '⚠️' : n.level === 'ok' ? '✅' : '💡'}</span><span>${esc(n.textAr)}</span></div>`).join('');
  $('#stepsView').innerHTML = `
    <h3>كل حاجة وليه اتحطت هنا</h3>
    <ol>${p.placed.map((i) => `<li><b>${esc(i.nameAr)}</b><br><span class="pos">${esc(i.reasonAr)}</span></li>`).join('')}</ol>
    ${p.offDesk.length ? `<div class="off-desk"><h3>شيل دول من على السطح</h3><ul>${
      p.offDesk.map((i) => `<li><b>${esc(i.nameAr)}</b> — ${esc(i.reasonAr)}</li>`).join('')}</ul></div>` : ''}`;
  $('#btnAfterImage').classList.toggle('hidden', !CAN_RENDER_IMAGE);
}

function renderBagResult() {
  const p = state.plan;
  $('#resultTitle').textContent = 'رص الشنطة';
  const weightWarn = p.stats.overWeight ? ' ⚠️' : '';
  $('#statsRow').innerHTML = `
    <div class="stat"><b>${p.stats.placedCount}</b><span>هتدخل</span></div>
    <div class="stat"><b>${p.stats.unplacedCount}</b><span>مش هتدخل</span></div>
    <div class="stat"><b>${p.stats.fillPercent}%</b><span>امتلاء</span></div>
    ${p.stats.totalWeightKg ? `<div class="stat"><b>${p.stats.totalWeightKg}${weightWarn}</b><span>كجم</span></div>` : ''}`;
  $('#planView').innerHTML = renderBagPlan(state.bin, p.placed);
  $('#legendView').innerHTML = renderLegend(p.placed);
  $('#notesView').innerHTML = p.stats.overWeight
    ? `<div class="note warn"><span>⚠️</span><span>الوزن عدّى الحد المسموح للشنطة دي.</span></div>` : '';
  $('#stepsView').innerHTML = `
    <h3>رصّها بالترتيب ده</h3>
    <ol>${p.steps.map((s) => `<li><b>${esc(s.nameAr)}</b>${s.rotated ? ' <span class="pos">(لفّها)</span>' : ''}${s.fragile ? ' ⚠️' : ''}<br><span class="pos">${esc(s.positionAr)}</span></li>`).join('')}</ol>
    ${p.unplaced.length ? `<div class="off-desk"><h3>دول مش هيدخلوا</h3><ul>${
      p.unplaced.map((i) => `<li><b>${esc(i.nameAr)}</b> — ${esc(i.reasonAr)}</li>`).join('')}</ul></div>` : ''}`;
  // صورة "بعد" ليها معنى في المكتب بس
  $('#btnAfterImage').classList.add('hidden');
}

/* ═══════════ إضافات الـAI ═══════════ */
async function maybeExplain() {
  $('#aiNote').classList.add('hidden');
  const sample = await aiReady();
  if (!sample) return;
  try {
    const text = await explainPlan({ mode: state.mode, plan: state.plan, sample });
    if (text.trim()) {
      $('#aiNote').textContent = text.trim();
      $('#aiNote').classList.remove('hidden');
    }
  } catch { /* الشرح رفاهية — المخطط هو الأساس */ }
}

async function onAfterImage() {
  const sample = await aiReady();
  if (!state.image) return toast('مفيش صورة أصلية');
  loading(true, 'برسم صورة "بعد الترتيب"...');
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
    mode: state.mode,
    title: state.mode === 'surface'
      ? `${state.profile?.spaceTypeAr || 'مساحة'} ${Math.round(state.surface.widthCm)}×${Math.round(state.surface.depthCm)}`
      : 'رص شنطة',
    items: state.items,
    surface: state.surface,
    profile: state.profile,
    bin: state.bin,
  });
  toast(ok ? 'اتحفظ في متصفحك ✅' : 'مساحة المتصفح مليانة — امسح محفوظات قديمة');
  renderSaved();
}

function renderSaved() {
  const scans = store.getScans();
  $('#savedScans').classList.toggle('hidden', !scans.length);
  $('#savedList').innerHTML = scans.map((s) => `
    <li>
      <span>${esc(s.title)} <span class="muted">— ${new Date(s.savedAt).toLocaleDateString('ar-EG')}</span></span>
      <span>
        <button data-load="${s.savedAt}">افتح</button>
        <button data-drop="${s.savedAt}">مسح</button>
      </span>
    </li>`).join('');
  $('#savedList').onclick = (e) => {
    const load = e.target.dataset.load, drop = e.target.dataset.drop;
    if (drop) { store.deleteScan(+drop); renderSaved(); return; }
    if (!load) return;
    const s = store.getScans().find((x) => x.savedAt === +load);
    if (!s) return;
    state.mode = s.mode; state.items = s.items; state.surface = s.surface || state.surface; state.profile = s.profile; state.bin = s.bin;
    $('#deskOpts').classList.toggle('hidden', state.mode !== 'surface');
    $('#bagOpts').classList.toggle('hidden', state.mode !== 'bag');
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
    state.surface = { widthCm: size.width, depthCm: size.depth };
  }
}

/** بيعرض نوع المساحة والقواعد اللي هتتنفّذ — عشان تشوفها قبل الحساب. */
function renderDetectedSpace() {
  const box = $('#detectedSpace');
  if (state.mode !== 'surface' || !state.profile) { box.classList.add('hidden'); return; }

  box.classList.remove('hidden');
  const src = state.profile.source === 'ai' ? ' 🤖' : '';
  $('#detectedName').textContent = state.profile.spaceTypeAr + src;

  // ملخص القواعد: كل فئة رايحة فين
  $('#rulesList').innerHTML = Object.values(state.profile.categories)
    .filter((c) => c.zone)
    .slice(0, 14)
    .map((c) => {
      const zone = ZONES[c.zone]?.labelAr || c.zone;
      const flags = [c.keepDry && '💧', c.avoidLight && '🌑', c.wantsLight && '☀️', c.hot && '🔥', c.anchor && '📌']
        .filter(Boolean).join('');
      return `<li>${esc(c.labelAr)} → ${esc(zone)} ${flags}</li>`;
    }).join('');
}

/* ═══════════ ٦: التوجيه بالكلام ═══════════ */

async function onAdaptProfile() {
  const sample = await aiReady();
  if (!sample) return toast('الميزة دي محتاجة Claude — مش متاحة في العرض ده');
  const intent = $('#adaptIntent').value.trim();
  if (!intent) return toast('اكتب عايز إيه من المساحة');
  if (!state.profile) return toast('محتاجين نعرف المساحة الأول');

  loading(true, 'بكتب القواعد من تاني...');
  try {
    const adapted = await adaptProfile({ profile: state.profile, intent, sample });
    if (!adapted) throw new Error('الموديل مرجعش قواعد صالحة — جرب صياغة تانية');
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
    toast('القواعد اتغيرت ✅ اضغط «احسب الترتيب»');
  } catch (err) {
    toast(err.message);
  } finally {
    loading(false);
  }
}

/* ═══════════ ٧: اسأل عن مساحتك ═══════════ */

async function onAsk() {
  const sample = await aiReady();
  if (!sample) return toast('الميزة دي محتاجة Claude — مش متاحة في العرض ده');
  const question = $('#askInput').value.trim();
  if (!question) return toast('اكتب سؤالك');
  if (!state.plan) return toast('احسب الترتيب الأول');

  loading(true, 'بفكر...');
  try {
    $('#askAnswer').textContent = 'بفكر...';
    $('#askAnswer').classList.remove('hidden');
    const answer = await askAboutSpace({
      question, plan: state.plan, mode: state.mode, sample,
      onText: ({ text }) => { $('#askAnswer').textContent = text; },
    });
    $('#askAnswer').textContent = answer.trim() || 'مالقيتش إجابة — جرب صياغة تانية';
  } catch (err) {
    toast(err.message);
  } finally {
    loading(false);
  }
}

init();

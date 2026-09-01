/**
 * app.js — الربط بين الكاميرا، الذكاء، الحساب، والرسم.
 */
import { SCALE_REFERENCES, normalizeBox, computeScale, boxToCm, perspectiveCorrect, scaleConfidence, round1 } from './geometry.js';
import { pack3D, packingOrder } from './packing.js';
import { layoutDesk } from './desk.js';
import { renderDeskPlan, renderBagPlan, renderLegend } from './render.js';
import { analyzeScene, explainPlan, renderAfterImage, fileToBase64Resized } from './vision.js';
import { CABIN_BAGS, BAG_CATEGORIES } from '../data/bags.js';
import { store } from './store.js';

const DESK_CATEGORY_LABELS = {
  monitor:'شاشة', laptop:'لابتوب', keyboard:'كيبورد', mouse:'ماوس', drink:'مشروب',
  phone:'موبايل', notebook:'نوتة/ورق', pens:'أقلام', lamp:'أباجورة', speaker:'سماعة',
  headphones:'سماعة راس', plant:'نبتة', books:'كتب', storage:'تخزين', decor:'ديكور', other:'حاجة تانية',
};
const FREQ_LABELS = { high:'بستخدمها كتير', medium:'أحياناً', low:'نادراً' };

const state = {
  mode: 'desk',
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

  const prefs = store.getPrefs();
  $('#scaleRef').value = prefs.scaleRef || 'card';
  $('#dominantHand').value = prefs.dominantHand || 'right';
  $('#apiKey').value = store.getApiKey();
  onScaleRefChange();
  renderSaved();

  $$('.mode-card').forEach((c) => c.addEventListener('click', () => {
    state.mode = c.dataset.mode;
    $('#captureTitle').textContent = state.mode === 'desk' ? 'صوّر المكتب' : 'صوّر الحاجات اللي هتشيلها';
    $('#deskOpts').classList.toggle('hidden', state.mode !== 'desk');
    $('#bagOpts').classList.toggle('hidden', state.mode !== 'bag');
    $('#scaleHint').textContent = state.mode === 'desk'
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
  $('#btnAddItem').addEventListener('click', () => { addItem(); renderItems(); });
  $('#btnPlan').addEventListener('click', onPlan);
  $('#btnAfterImage').addEventListener('click', onAfterImage);
  $('#btnSave').addEventListener('click', onSave);

  $('#btnSettings').addEventListener('click', () => $('#settingsDialog').showModal());
  $('#settingsDialog').addEventListener('close', (e) => {
    if ($('#settingsDialog').returnValue === 'save') {
      store.setApiKey($('#apiKey').value.trim());
      toast('اتحفظ ✅');
    } else {
      $('#apiKey').value = store.getApiKey();
    }
  });

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
  const apiKey = store.getApiKey();
  if (!apiKey) { $('#settingsDialog').showModal(); return toast('محتاج مفتاح Gemini الأول'); }
  if (!state.image) return toast('اختار صورة الأول');

  const refId = $('#scaleRef').value;
  const ref = SCALE_REFERENCES[refId];
  const customCm = parseFloat($('#customRefCm').value);
  if (refId === 'custom' && !(customCm > 0)) return toast('اكتب عرض مرجع القياس بالسنتيمتر');

  store.setPrefs({ dominantHand: $('#dominantHand').value, customRefCm: customCm || 0 });

  loading(true, 'الموديل بيبص على الصورة...');
  try {
    const analysis = await analyzeScene({
      base64: state.image.base64,
      mode: state.mode,
      scaleRefLabel: refId === 'custom' ? `حاجة عرضها ${customCm} سم` : ref.labelAr,
      apiKey,
    });

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
    if (state.mode === 'desk' && analysis.surface?.box) {
      const sBox = normalizeBox(analysis.surface.box);
      if (sBox) {
        const d = boxToCm(sBox, scale);
        state.surface = { widthCm: clampCm(d.widthCm, 40, 400), depthCm: clampCm(d.depthCm, 30, 200) };
      }
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
  addItem();
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
    category: state.mode === 'desk' ? 'other' : 'other',
    widthCm: 10, depthCm: 10, heightCm: 10,
    frequency: 'medium', fragile: false, confidence: 1,
  });
}

function renderItems() {
  const catOptions = state.mode === 'desk'
    ? Object.entries(DESK_CATEGORY_LABELS)
    : Object.entries(BAG_CATEGORIES).map(([k, v]) => [k, v.labelAr]);

  const surfaceEditor = state.mode === 'desk' ? `
    <div class="item">
      <div>
        <strong>📏 مقاس المكتب نفسه</strong>
        <p class="hint">التقدير ده من الصورة، والصورة بزاوية فبيقل عن الحقيقة. لو تعرف مقاس مكتبك اكتبه — ده أهم رقم في الحسبة.</p>
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
        ${state.mode === 'desk' ? `
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

  if (state.mode === 'desk') {
    if (!(state.surface.widthCm > 20 && state.surface.depthCm > 20)) return toast('اكتب مقاس المكتب الأول');
    const prefs = store.getPrefs();
    state.plan = layoutDesk(state.surface, valid, {
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

  showScreen('result');
  maybeExplain();
}

function renderDeskResult() {
  const p = state.plan;
  $('#resultTitle').textContent = 'ترتيب المكتب';
  $('#statsRow').innerHTML = `
    <div class="stat"><b>${p.stats.onDesk}</b><span>حاجة على المكتب</span></div>
    <div class="stat"><b>${p.stats.freePercent}%</b><span>مساحة فاضية</span></div>
    <div class="stat"><b>${p.stats.removed}</b><span>اتشالت</span></div>`;
  $('#planView').innerHTML = renderDeskPlan(p);
  $('#legendView').innerHTML = renderLegend(p.placed);
  $('#notesView').innerHTML = p.notes.map((n) =>
    `<div class="note ${n.level}"><span>${n.level === 'warn' ? '⚠️' : n.level === 'ok' ? '✅' : '💡'}</span><span>${esc(n.textAr)}</span></div>`).join('');
  $('#stepsView').innerHTML = `
    <h3>كل حاجة وليه اتحطت هنا</h3>
    <ol>${p.placed.map((i) => `<li><b>${esc(i.nameAr)}</b><br><span class="pos">${esc(i.reasonAr)}</span></li>`).join('')}</ol>
    ${p.offDesk.length ? `<div class="off-desk"><h3>شيل دول من على المكتب</h3><ul>${
      p.offDesk.map((i) => `<li><b>${esc(i.nameAr)}</b> — ${esc(i.reasonAr)}</li>`).join('')}</ul></div>` : ''}`;
  $('#btnAfterImage').classList.remove('hidden');
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
  const apiKey = store.getApiKey();
  if (!apiKey) return;
  $('#aiNote').classList.add('hidden');
  try {
    const text = await explainPlan({ mode: state.mode, plan: state.plan, apiKey });
    if (text.trim()) {
      $('#aiNote').textContent = text.trim();
      $('#aiNote').classList.remove('hidden');
    }
  } catch { /* الشرح رفاهية — المخطط هو الأساس */ }
}

async function onAfterImage() {
  const apiKey = store.getApiKey();
  if (!apiKey) return toast('محتاج مفتاح Gemini');
  if (!state.image) return toast('مفيش صورة أصلية');
  loading(true, 'برسم صورة "بعد الترتيب"...');
  try {
    const url = await renderAfterImage({ base64: state.image.base64, mode: state.mode, plan: state.plan, apiKey });
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
    title: state.mode === 'desk' ? `مكتب ${Math.round(state.surface.widthCm)}×${Math.round(state.surface.depthCm)}` : 'رص شنطة',
    items: state.items,
    surface: state.surface,
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
    state.mode = s.mode; state.items = s.items; state.surface = s.surface || state.surface; state.bin = s.bin;
    $('#deskOpts').classList.toggle('hidden', state.mode !== 'desk');
    $('#bagOpts').classList.toggle('hidden', state.mode !== 'bag');
    renderItems();
    showScreen('review');
  };
}

init();

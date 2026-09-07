/**
 * realimage.js — صورة واقعية للمساحة بعد ما تترتب.
 *
 * ليه ده موجود: المخطط والأشكال بيقولوا «الدباسة هنا والأقلام هنا»،
 * وده صح ومحسوب — بس محدش بيتخيّل مساحته منه. الصورة الواقعية بتخلّي
 * الترتيب حاجة تشوفها بدل حاجة تقراها.
 *
 * بيشتغل من خلال كونيكتور توليد الصور بتاع المستخدم نفسه، بحسابه هو
 * وبكريدت منه. لو مش موصّل، الزرار مبيظهرش أصلاً.
 *
 * الحد اللي لازم يفضل واضح: **دي مش صورتك متعدّلة، دي صورة جديدة**
 * مبنية على وصف مساحتك والترتيب المحسوب. الأرقام والمخطط هما الدقيق،
 * ودي للتخيّل. عشان كده الوصف بيتبني من نفس الأرقام اللي الخوارزمية
 * طلعتها، مش من كلام مخترع.
 */

const SERVER = 'higgsfield';
const MODEL = 'nano_banana_pro';

/** بيرجّع نطاق الكونيكتور، أو null لو العرض ده مش شايفه. */
export async function imageGenReady() {
  try {
    return (await window.claude?.use?.('mcp')) || null;
  } catch {
    return null;
  }
}

/** وصف مكان الحاجة بالإنجليزي — الموديل بيفهمه أحسن من الإحداثيات. */
function whereOf(p, W, D) {
  const cx = (p.x + (p.w || 0) / 2) / (W || 1);
  const cy = (p.y + (p.d || 0) / 2) / (D || 1);
  const side = cx < 0.34 ? 'on the left' : cx > 0.66 ? 'on the right' : 'in the middle';
  const depth = cy < 0.34 ? 'at the front' : cy > 0.66 ? 'at the back' : '';
  return [side, depth].filter(Boolean).join(', ');
}

/**
 * بيبني الوصف من الترتيب المحسوب.
 *
 * كل جملة هنا مصدرها رقم من الخوارزمية — الاسم، المقاس، والمكان.
 * مفيش حاجة بتتزوّد من عندنا عشان الصورة تطلع حلوة.
 */
export function buildPrompt({ profile, surface, placed, isContainer, spaceNote = '' }) {
  const W = surface?.widthCm || 0;
  const D = surface?.depthCm || 0;
  const H = surface?.heightCm || 0;

  const items = (placed || []).slice(0, 14).map((p) => {
    const w = Math.round(p.w ?? p.widthCm ?? 0);
    const d = Math.round(p.d ?? p.depthCm ?? 0);
    const h = Math.round(p.h ?? p.heightCm ?? 0);
    return `${p.nameAr} (about ${w}x${d}x${h} cm) ${whereOf(p, W, D)}`;
  });

  const what = spaceNote || 'a storage space';
  const kind = isContainer
    ? `Looking down into ${what}, about ${Math.round(W)} cm wide, ${Math.round(D)} cm deep and ${Math.round(H)} cm tall,`
    : `${what}, about ${Math.round(W)} cm wide and ${Math.round(D)} cm deep, seen from a natural angle,`;

  return `A realistic photograph. ${kind} neatly arranged and tidy.

${isContainer ? 'Inside it' : 'On it'}, exactly these things and nothing else:
${items.map((s) => `- ${s}`).join('\n')}

Everyday real objects, true to those sizes and those positions relative to each other.
Natural indoor lighting, sharp focus, clean uncluttered background, no text, no labels,
no people, no hands. Photographic, not an illustration or a diagram.`;
}

/**
 * بيطلب الصورة ويستنى لحد ما تخلص.
 *
 * التوليد بياخد وقت، فالكونيكتور بيرجّع رقم شغلانة الأول وبنسأل عليها.
 * كل نداء انتظار سقفه ١٥ ثانية، فبنكرر لحد ما تخلص أو نوصل للمهلة.
 *
 * @param {(s:string)=>void} onStage بينده مع كل مرحلة عشان الواجهة تطمّن المستخدم
 */
export async function makeRealImage({ mcp, prompt, onStage, maxWaitMs = 180000 }) {
  onStage?.('sending');

  const started = await mcp.callTool(SERVER, 'generate_image', {
    params: { model: MODEL, prompt, count: 1, use_unlim: false },
  });

  const job = started?.payload?.results?.[0];
  if (!job?.id) throw new Error('no_job');

  // لو خلصت من أول رد (كاش مثلاً) مش هنستنى على الفاضي
  if (job.status === 'completed' && job.result_url) return job.result_url;

  onStage?.('drawing');
  const until = Date.now() + maxWaitMs;
  while (Date.now() < until) {
    const waited = await mcp.callTool(SERVER, 'jobs_wait', {
      jobs: [{ index: 0, job_id: job.id }],
      timeout_seconds: 15,
    });
    const row = waited?.payload?.jobs?.[0];
    if (row?.status === 'completed' && row.result_url) return row.result_url;
    if (row?.status === 'failed' || waited?.payload?.summary?.failed) throw new Error('failed');
    if (waited?.payload?.all_terminal && !row?.result_url) throw new Error('failed');
  }
  throw new Error('timeout');
}

/**
 * بيحوّل خطأ الكونيكتور لجملة المستخدم يفهمها.
 * الأكواد دي من مواصفة القدرة — كل واحد ليه رد مختلف صح.
 */
export function imageError(err, t) {
  const code = err?.code || err?.message;
  if (code === 'not_granted') return t('img_notGranted');
  if (code === 'server_not_connected') return t('img_noConnector');
  if (code === 'needs_reauth') return t('img_reauth');
  if (code === 'blocked_by_policy' || code === 'approval_required') return t('img_blocked');
  if (code === 'rate_limited') return t('img_busy');
  if (code === 'timeout') return t('img_timeout');
  return t('img_failed');
}

/**
 * ai.js — الناقل: قدرة `sample` بتاعة Artifacts.
 *
 * الصفحة بتسأل Claude مباشرة من غير أي مفتاح API، والمستخدم مش محتاج
 * يعمل حاجة. المقابل إن ده شغال جوه claude.ai بس، ومفيش توليد صور،
 * فميزة «صورة بعد الترتيب» مخفية في النسخة دي.
 *
 * كل كلام الموديل في ai-core.js. الملف ده بيوصّل بس.
 */

import { friendlyError } from './ai-core.js';

export {
  analyzeScene, adaptProfile, explainPlan, askAboutSpace,
  profileFromModel, fileToBase64Resized, friendlyError,
} from './ai-core.js';

/**
 * بيرجّع الـcaller أو null لو القدرة مش متاحة في العرض ده.
 * قدرة sample أصلاً بنفس شكل الواجهة اللي النواة بتنتظرها
 * (بتتنده كدالة، وليها .json و.limits)، فبنرجّعها زي ما هي.
 */
export async function aiReady() {
  try {
    return (await window.claude?.use?.('sample')) || null;
  } catch {
    return null;
  }
}

/** هل العرض ده يقدر يبعت صور أصلاً؟ */
export async function canSendImages(caller) {
  try {
    const limits = await caller.limits();
    return !!limits?.images;
  } catch {
    return false;
  }
}

/* ═══════════ صورة "بعد الترتيب" — مش متاحة في نسخة الآرتيفاكت ═══════════ */

/** الناقل ده مش محتاج مفتاح — الصفحة بتسأل Claude مباشرة. */
export const NEEDS_KEY = false;

export const CAN_RENDER_IMAGE = false;

export async function renderAfterImage() {
  throw friendlyError(new Error('توليد الصور مش متاح في النسخة دي — المخطط المرسوم هو الدقيق أصلاً'));
}

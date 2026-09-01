/**
 * store.js — كل حاجة محلية في متصفحك. مفيش سيرفر ومفيش حساب.
 * مفتاح الـAPI بتاعك بيتخزن عندك بس، وبيتبعت لجوجل مباشرة من متصفحك.
 */
const KEY_API = 'sp.apiKey';
const KEY_PREFS = 'sp.prefs';
const KEY_SCANS = 'sp.scans';

function safeGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const store = {
  getApiKey: () => safeGet(KEY_API, ''),
  setApiKey: (k) => safeSet(KEY_API, k || ''),
  clearApiKey: () => localStorage.removeItem(KEY_API),

  getPrefs: () => safeGet(KEY_PREFS, {
    dominantHand: 'right',
    windowSide: 'none',
    scaleRef: 'card',
    customRefCm: 0,
  }),
  setPrefs: (p) => safeSet(KEY_PREFS, { ...store.getPrefs(), ...p }),

  getScans: () => safeGet(KEY_SCANS, []),
  saveScan: (scan) => {
    const all = safeGet(KEY_SCANS, []);
    all.unshift({ ...scan, savedAt: Date.now() });
    return safeSet(KEY_SCANS, all.slice(0, 10)); // آخر ١٠ بس عشان مساحة المتصفح
  },
  deleteScan: (savedAt) => safeSet(KEY_SCANS, safeGet(KEY_SCANS, []).filter((s) => s.savedAt !== savedAt)),
};

/**
 * build.mjs — بيجمع المشروع في ملف HTML واحد قائم بذاته.
 *
 * ليه: النشر بيتم برفع الملفات واحدة واحدة، وده بيخلي احتمال نسيان
 * ملف كبير. ملف واحد = نشر مضمون.
 *
 * المصدر يفضل متقسم لموديولات للتطوير — ده مجرد ناتج بناء.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const ORDER = [
  'js/geometry.js', 'js/profiles.js', 'js/packing.js', 'js/surface.js',
  'js/render.js', 'js/store.js', 'data/bags.js', 'js/vision.js', 'js/app.js',
];

// تصادمات الأسماء بين الموديولات — لازم تتحل قبل الدمج
const RENAMES = {
  'js/vision.js': [
    // ليستة أسماء فئات الشنطة في vision.js بتتصادم مع كائن الفئات في bags.js
    [/\bBAG_CATEGORIES\b/g, 'BAG_CATS_LIST'],
  ],
  'js/app.js': [
    // esc معرّفة في render.js كـ function وفي app.js كـ const
    [/\bconst esc = /, 'const escHtml = '],
    [/\besc\(/g, 'escHtml('],
    [/const escHtml = \(s\) => String/, 'const escHtml = (s) => String'],
  ],
};

let bundle = '';
for (const file of ORDER) {
  let src = readFileSync(file, 'utf8');

  for (const [pattern, replacement] of RENAMES[file] || []) {
    src = src.replace(pattern, replacement);
  }

  src = src
    .replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')  // الاستيرادات
    .replace(/^export\s+(const|function|async function|class|let)\s/gm, '$1 ')
    .replace(/^export\s*\{[^}]*\};?\s*$/gm, '');

  bundle += `\n/* ══════════ ${file} ══════════ */\n${src.trim()}\n`;
}

const css = readFileSync('css/app.css', 'utf8');
const html = readFileSync('index.html', 'utf8');

// مهم: الاستبدال بدالة مش بنص. النص بيفسّر $$ على إنها $ واحدة،
// وده كان بيحوّل `const $$ =` لـ `const $ =` ويكسر الملف كله.
const out = html
  .replace('<link rel="stylesheet" href="css/app.css">', () => `<style>\n${css}\n</style>`)
  .replace('<script type="module" src="js/app.js"></script>', () => `<script>\n${bundle}\n</script>`)
  // الملف الواحد مالوش service worker منفصل
  .replace('<link rel="manifest" href="manifest.json">', '');

writeFileSync('dist.html', out);
console.log(`dist.html: ${(out.length / 1024).toFixed(1)} KB`);

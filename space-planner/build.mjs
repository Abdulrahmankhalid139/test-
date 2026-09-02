/**
 * build.mjs — بيجمع المشروع في ملف HTML واحد قائم بذاته.
 *
 * ليه: النشر بيتم برفع الملفات واحدة واحدة، وده بيخلي احتمال نسيان
 * ملف كبير. ملف واحد = نشر مضمون.
 *
 * المصدر يفضل متقسم لموديولات للتطوير — ده مجرد ناتج بناء.
 */
import { readFileSync, writeFileSync } from 'node:fs';

// --gemini: النسخة اللي بتستخدم مفتاح Gemini (للاستضافة العادية)
// الافتراضي: النسخة اللي بتسأل Claude عبر قدرة sample (للآرتيفاكت)
const AI_MODULE = process.argv.includes('--gemini') ? 'js/ai-gemini.js' : 'js/ai.js';

const ORDER = [
  'js/i18n.js', 'js/geometry.js', 'js/profiles.js', 'js/packing.js', 'js/surface.js',
  'js/homography.js', 'js/render.js', 'js/overlay.js', 'js/edit.js', 'js/multispace.js',
  'js/store.js', 'data/bags.js', AI_MODULE, 'js/app.js',
];

// تصادمات الأسماء بين الموديولات — لازم تتحل قبل الدمج
const RENAMES = {
  'js/ai-gemini.js': [
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

/**
 * بيشيل السطور اللي كلها تعليق بس — مش بيلمس أي سطر فيه كود،
 * عشان مايخربش رابط جوه نص (زي https://) أو محتوى template literal.
 */
function stripFullLineComments(code) {
  const out = [];
  let inBlock = false;
  for (const line of code.split('\n')) {
    const t = line.trim();
    if (inBlock) {
      if (t.endsWith('*/')) inBlock = false;
      continue;
    }
    if (t.startsWith('/*')) {
      if (!t.endsWith('*/')) inBlock = true;
      continue;
    }
    if (t.startsWith('//')) continue;
    if (t === '') continue;
    out.push(line);
  }
  return out.join('\n');
}

const MINIFY = process.argv.includes('--min');

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

  if (MINIFY) {
    src = stripFullLineComments(src);
    // شيل المسافة البادئة بس — أي حاجة تانية ممكن تكسر نص جوه template literal
    src = src.split('\n').map((l) => l.replace(/^[ \t]+/, '')).join('\n');
  }
  bundle += `\n/* ${file} */\n${src.trim()}\n`;
}

let css = readFileSync('css/app.css', 'utf8');
if (MINIFY) css = stripFullLineComments(css).split('\n').map((l) => l.trim()).join('\n');
const html = readFileSync('index.html', 'utf8');

// مهم: الاستبدال بدالة مش بنص. النص بيفسّر $$ على إنها $ واحدة،
// وده كان بيحوّل `const $$ =` لـ `const $ =` ويكسر الملف كله.
const out = html
  .replace('<link rel="stylesheet" href="css/app.css">', () => `<style>\n${css}\n</style>`)
  .replace('<script type="module" src="js/app.js"></script>', () => `<script>\n${bundle}\n</script>`)
  // الملف الواحد مالوش service worker منفصل
  .replace('<link rel="manifest" href="manifest.json">', '');

writeFileSync('dist.html', out);

// --artifact: الآرتيفاكت بيلفّ الصفحة في هيكل <html><head></head><body> بنفسه،
// فبنطلّع المحتوى بس: العنوان، الخط، الستايل، الجسم، السكريبت.
if (process.argv.includes('--artifact')) {
  const title = html.match(/<title>([\s\S]*?)<\/title>/)[1];
  const fonts = [...html.matchAll(/<link[^>]*fonts\.(?:googleapis|gstatic)[^>]*>/g)].map((m) => m[0]).join('\n');
  const body = html.slice(html.indexOf('<body>') + '<body>'.length, html.lastIndexOf('</body>'))
    .replace(/<script type="module"[^>]*><\/script>/, '');

  const artifact = [
    `<title>${title}</title>`,
    fonts,
    `<style>\n${css}\n</style>`,
    body.trim(),
    `<script>\n${bundle}\n</script>`,
  ].join('\n');

  writeFileSync('artifact.html', artifact);
  console.log(`artifact.html: ${(artifact.length / 1024).toFixed(1)} KB`);
}

// --terser: يمرّر الـJS على مصغّر حقيقي وينتج dist.min.html
if (process.argv.includes('--terser')) {
  const { execFileSync } = await import('node:child_process');
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');

  const dir = mkdtempSync(join(tmpdir(), 'sp-'));
  const inJs = join(dir, 'in.js');
  const outJs = join(dir, 'out.js');
  writeFileSync(inJs, bundle);
  execFileSync('npx', ['--yes', 'terser', inJs, '-c', '-m', '--format', 'ascii_only=false,max_line_len=180', '-o', outJs], { stdio: 'inherit' });
  const minJs = readFileSync(outJs, 'utf8');
  rmSync(dir, { recursive: true, force: true });

  const minCss = css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s*([{}:;,>])\s*/g, '$1')
    .replace(/;}/g, '}')
    .replace(/\n+/g, '')
    .trim();

  const minOut = out
    .replace(/<style>[\s\S]*?<\/style>/, () => `<style>${minCss}</style>`)
    .replace(/<script>[\s\S]*?<\/script>/, () => `<script>${minJs}</script>`);

  writeFileSync('dist.min.html', minOut);
  console.log(`dist.min.html: ${(minOut.length / 1024).toFixed(1)} KB`);
}
console.log(`dist.html: ${(out.length / 1024).toFixed(1)} KB${MINIFY ? ' (بدون تعليقات)' : ''}`);

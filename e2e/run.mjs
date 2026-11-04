// End-to-end check in a real browser (Chromium via Playwright).
// Verifies that every skeleton block lines up with the element it replaces.
//
//   npm run build && npm run test:e2e
//   SCREENSHOTS=./out npm run test:e2e   # also writes screenshots
//   REACT_DIR=/path/with/node_modules npm run test:e2e   # test another React version
import { build } from 'esbuild';
import { existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

let chromium;
try {
  // `require` also resolves a globally installed Playwright (NODE_PATH).
  ({ chromium } = createRequire(import.meta.url)('playwright'));
} catch {
  console.error('Playwright is required: npm i -D playwright && npx playwright install chromium');
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const screenshots = process.env.SCREENSHOTS ? resolve(process.env.SCREENSHOTS) : null;

// Optionally resolve react/react-dom from another install, to test older React versions.
const reactDir = process.env.REACT_DIR ? resolve(process.env.REACT_DIR) : null;
const reactFrom = {
  name: 'react-from',
  setup(b) {
    if (!reactDir) return;
    const requireFrom = createRequire(join(reactDir, 'noop.js'));
    b.onResolve({ filter: /^react(-dom)?(\/.*)?$/ }, ({ path }) => {
      const domDir = dirname(requireFrom.resolve('react-dom/package.json'));
      if (path === 'react-dom/client' && !existsSync(join(domDir, 'client.js'))) {
        return { path: join(here, 'legacy-root.js') }; // React 17 has no createRoot
      }
      return { path: requireFrom.resolve(path) };
    });
  },
};

const bundle = await build({
  entryPoints: [join(here, 'app.jsx')],
  bundle: true,
  write: false,
  format: 'iife',
  jsx: 'automatic',
  plugins: [reactFrom],
  define: { 'process.env.NODE_ENV': '"development"' },
  logLevel: 'silent',
});

const css = `
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px; font: 15px/1.5 system-ui, sans-serif; background: #f4f5f7; color: #1d1d1f; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 24px; align-items: start; }
  .card { background: #fff; border: 1px solid #e3e5e8; border-radius: 16px; padding: 20px; box-shadow: 0 4px 16px rgba(0,0,0,.06); }
  .head { display: flex; gap: 16px; align-items: center; }
  .avatar { border-radius: 50%; display: block; }
  .name { margin: 0; font-size: 20px; line-height: 1.3; }
  .handle { margin: 2px 0 0; color: #6b6f76; font-size: 14px; }
  .bio { margin: 16px 0; }
  .tags { display: flex; gap: 8px; flex-wrap: wrap; }
  .tag { background: #eef0ff; color: #4b3fd8; border-radius: 999px; padding: 2px 10px; font-size: 13px; }
  .actions { display: flex; gap: 8px; margin-top: 16px; }
  button { border: 0; border-radius: 10px; background: #4b3fd8; color: #fff; padding: 8px 18px; font: inherit; }
  input { flex: 1; min-width: 0; border: 1px solid #d0d3d8; border-radius: 10px; padding: 8px 12px; font: inherit; }
`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head>
<body><div id="root"></div><script>${bundle.outputFiles[0].text}</script></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1180, height: 900 } });
const problems = [];
page.on('console', (msg) => {
  if (msg.type() === 'error' || msg.type() === 'warning') problems.push(`console.${msg.type()}: ${msg.text()}`);
});
page.on('pageerror', (err) => problems.push(`page error: ${err.message}`));

const reactPkg = createRequire(join(reactDir || here, 'noop.js'))('react/package.json');
console.log(`React ${reactPkg.version}\n`);
await page.setContent(html);
await page.waitForSelector('[data-auto-skeleton-block]');
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(200);

/** Runs in the page: compares skeleton blocks with the real layout. */
function inspect(ids) {
  const near = (a, b) => Math.abs(a - b) <= 1.01;
  const sameRect = (a, b) => near(a.left, b.left) && near(a.top, b.top) && near(a.width, b.width) && near(a.height, b.height);
  const contains = (outer, inner) =>
    inner.left >= outer.left - 1 && inner.top >= outer.top - 1 && inner.right <= outer.right + 1 && inner.bottom <= outer.bottom + 1;

  const report = {};
  for (const id of ids) {
    const root = document.getElementById(id);
    const errors = [];
    const overlay = root.querySelector('[data-auto-skeleton-overlay]');
    if (root.getAttribute('data-auto-skeleton') !== 'loading') errors.push('root not marked as loading');
    if (!overlay) {
      report[id] = { errors: ['no overlay'] };
      continue;
    }
    const blocks = Array.from(overlay.querySelectorAll('[data-auto-skeleton-block]')).map((el) => ({
      kind: el.getAttribute('data-auto-skeleton-block'),
      rect: el.getBoundingClientRect(),
      radius: getComputedStyle(el).borderRadius,
      background: getComputedStyle(el).backgroundColor,
    }));
    const of = (kind) => blocks.filter((b) => b.kind === kind);

    for (const el of root.querySelectorAll('img, button, input')) {
      const rect = el.getBoundingClientRect();
      const match = of('block').find((b) => sameRect(b.rect, rect));
      if (!match) errors.push(`no block for <${el.localName}>`);
      else if (el.localName === 'img' && match.radius !== '50%') errors.push(`avatar radius ${match.radius}`);
    }

    const card = root.querySelector('.card');
    if (card) {
      const surface = of('surface').find((b) => sameRect(b.rect, card.getBoundingClientRect()));
      if (!surface) errors.push('no surface for the card');
      else if (surface.background !== 'rgb(255, 255, 255)') errors.push(`card surface background ${surface.background}`);
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let lines = 0;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (overlay.contains(node) || !node.nodeValue.trim()) continue;
      if (node.parentElement.closest('button, script, style')) continue;
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        if (rect.width < 1) continue;
        lines++;
        if (!of('text').some((b) => contains(b.rect, rect))) {
          errors.push(`text "${node.nodeValue.trim().slice(0, 20)}" not covered`);
        }
      }
    }

    for (const child of root.children) {
      if (child === overlay) continue;
      if (getComputedStyle(child).opacity !== '0') errors.push(`<${child.localName}> still visible`);
      if (!child.hasAttribute('inert')) errors.push(`<${child.localName}> not inert`);
    }
    if (overlay.getAttribute('data-direction') !== getComputedStyle(root).direction) errors.push('wrong direction');

    report[id] = { errors, blocks: blocks.length, textLines: lines, textBlocks: of('text').length };
  }
  return report;
}

const ids = ['ltr', 'rtl', 'scaled', 'vanilla', 'inline'];
let failures = 0;
const check = async (label) => {
  const report = await page.evaluate(inspect, ids);
  for (const id of ids) {
    const { errors, ...stats } = report[id];
    const ok = errors.length === 0;
    if (!ok) failures++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} [${label}] #${id} ${JSON.stringify(stats)}${ok ? '' : `\n     ${errors.join('\n     ')}`}`);
  }
};

const shot = async (name) => {
  if (!screenshots) return;
  mkdirSync(screenshots, { recursive: true });
  await page.screenshot({ path: join(screenshots, `${name}.png`), fullPage: true });
};

await check('initial');
await shot('loading');

// Layout changes (text reflow) must be picked up automatically.
await page.setViewportSize({ width: 760, height: 900 });
await page.waitForTimeout(300);
await check('after resize');
await shot('loading-narrow');

// Turning loading off restores the real content.
await page.evaluate(() => window.__setLoading(false));
await page.waitForTimeout(100);
const restored = await page.evaluate(() => ({
  overlays: document.querySelectorAll('[data-auto-skeleton-overlay]').length,
  inert: document.querySelectorAll('[inert]').length,
  opacity: getComputedStyle(document.querySelector('#ltr > .card')).opacity,
  vanillaOpacity: getComputedStyle(document.querySelector('#vanilla > .card')).opacity,
  busy: document.querySelectorAll('[aria-busy]').length,
}));
const restoredOk = restored.overlays === 0 && restored.inert === 0 && restored.opacity === '1' && restored.vanillaOpacity === '1' && restored.busy === 0;
if (!restoredOk) failures++;
console.log(`${restoredOk ? 'ok  ' : 'FAIL'} [loaded] ${JSON.stringify(restored)}`);
await shot('loaded');

// And back on again.
await page.setViewportSize({ width: 1180, height: 900 });
await page.evaluate(() => window.__setLoading(true));
await page.waitForTimeout(200);
await check('loading again');

if (problems.length) {
  failures += problems.length;
  console.log(`FAIL console output:\n  ${problems.join('\n  ')}`);
}

await browser.close();
if (failures) {
  console.error(`\n${failures} e2e check(s) failed`);
  process.exit(1);
}
console.log('\nAll e2e checks passed');

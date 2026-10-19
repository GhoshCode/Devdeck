// Bookmarks panel + Tree View, inside the real extension. Usage: node qa-bookmarks.mjs <dark|light>
import { chromium } from 'playwright';
import fs from 'fs';
import os from 'os';
import path from 'path';
const theme = process.argv[2] ?? 'dark';
const OUT = 'screenshots/qa-bookmarks/'; // run from the repo root after npm run build
fs.mkdirSync(OUT, { recursive: true });
const dist = path.resolve('dist');
const log = [];
const note = (s, ok, d = '') => {
  log.push({ s, ok, d });
  console.log(`${ok === true ? 'PASS' : ok === false ? 'FAIL' : 'NOTE'} | ${s}${d ? ' | ' + d : ''}`);
};
let n = 0;
const shot = (name, loc) => (loc ?? p).screenshot({ path: `${OUT}${theme}-${String(++n).padStart(2, '0')}-${name}.png` });

const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'ddbm-')), {
  channel: 'chromium',
  headless: true,
  viewport: { width: 1600, height: 950 },
  args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
});
const worker = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
const id = new URL(worker.url()).host;
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => m.type() === 'error' && !/favicon|Failed to load resource|ERR_|net::/i.test(m.text()) && errors.push(m.text()));
p.setDefaultTimeout(8000);
await p.goto(`chrome-extension://${id}/index.html`);
await p.locator('[data-category-id]').first().waitFor({ timeout: 15000 });
await p.evaluate((theme) => {
  const raw = JSON.parse(localStorage.getItem('devdeck') ?? '{"state":{"settings":{}}}');
  if (raw.state?.settings) Object.assign(raw.state.settings, { themeMode: theme, presetTheme: theme === 'light' ? 'default-light' : 'default-dark' });
  localStorage.setItem('devdeck', JSON.stringify(raw));
}, theme);

// Seed: Bookmarks bar ▸ Work ▸ Frontend ▸ Frameworks ▸ (sites) ; Reading ; loose sites
const seed = await p.evaluate(async () => {
  const b = chrome.bookmarks;
  const bar = '1';
  const work = await b.create({ parentId: bar, title: 'Work' });
  const fe = await b.create({ parentId: work.id, title: 'Frontend' });
  const fw = await b.create({ parentId: fe.id, title: 'Frameworks' });
  for (const [t, u] of [['React', 'https://react.dev'], ['Vue', 'https://vuejs.org'], ['Svelte', 'https://svelte.dev']]) await b.create({ parentId: fw.id, title: t, url: u });
  for (const [t, u] of [['MDN', 'https://developer.mozilla.org'], ['web.dev', 'https://web.dev']]) await b.create({ parentId: fe.id, title: t, url: u });
  const be = await b.create({ parentId: work.id, title: 'Backend' });
  for (const [t, u] of [['Node.js', 'https://nodejs.org'], ['Deno', 'https://deno.com']]) await b.create({ parentId: be.id, title: t, url: u });
  const reading = await b.create({ parentId: bar, title: 'Reading' });
  for (let i = 1; i <= 11; i++) await b.create({ parentId: reading.id, title: `Article ${i}`, url: `https://example.com/a${i}` });
  await b.create({ parentId: bar, title: 'Hacker News', url: 'https://news.ycombinator.com' });
  await b.create({ parentId: '2', title: 'Other one', url: 'https://example.org' });
  return { work: work.id, fe: fe.id, fw: fw.id, be: be.id, reading: reading.id };
});
await p.reload();
await p.locator('[data-category-id]').first().waitFor({ timeout: 15000 });
const tree = () => p.evaluate(async () => (await chrome.bookmarks.getTree())[0]);
const parentOf = async (title) => p.evaluate(async (t) => {
  const [n] = await chrome.bookmarks.search({ title: t });
  if (!n) return null;
  const [par] = await chrome.bookmarks.get(n.parentId);
  return par.title;
}, title);

// ---- panel ----
await p.getByRole('button', { name: 'Browser bookmarks' }).click();
const panel = p.getByRole('dialog', { name: 'Browser bookmarks' });
await panel.waitFor();
await p.waitForTimeout(500);
note('Panel lists Bookmarks bar with seeded folders', await panel.getByText('Work', { exact: true }).isVisible());
await shot('panel-open', panel);

// expand deep levels
await panel.getByRole('button', { name: 'Expand Work' }).click();
await panel.getByRole('button', { name: 'Expand Frontend' }).click();
await panel.getByRole('button', { name: 'Expand Frameworks' }).click();
note('4 levels deep: React visible', await panel.getByRole('link', { name: 'React' }).isVisible());
await shot('panel-deep', panel);

// "+" sits left of edit, tooltip says "Add sub folder"
const row = panel.locator('.bm-row', { has: p.getByRole('button', { name: 'Expand Backend' }).or(p.getByRole('button', { name: 'Collapse Backend' })) }).first();
await row.hover();
const plus = row.getByRole('button', { name: 'Add sub folder to Backend' });
note('"+" tooltip reads "Add sub folder"', (await plus.getAttribute('title')) === 'Add sub folder');
const order = await row.locator('.bm-actions button').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
note('"+" is just left of Edit, then Delete', /^Add sub folder/.test(order[0]) && /^Edit/.test(order[1]) && /^Delete/.test(order[2]), order.join(' | '));
await plus.click();
await panel.getByLabel('Sub folder name').fill('APIs');
await panel.getByLabel('Sub folder name').press('Enter');
await p.waitForTimeout(400);
note('Sub folder created in the browser', (await parentOf('APIs')) === 'Backend');

// rename
await row.hover();
await row.getByRole('button', { name: 'Edit Backend' }).click();
await panel.getByLabel('Folder name').fill('Server side');
await panel.getByLabel('Folder name').press('Enter');
await p.waitForTimeout(400);
note('Rename writes to the browser', (await p.evaluate(async (id) => (await chrome.bookmarks.get(id))[0].title, seed.be)) === 'Server side');

// top-level folder
await panel.getByRole('button', { name: '+ Add folder' }).click();
await panel.getByLabel('New folder name').fill('Tools');
await panel.getByLabel('New folder name').press('Enter');
await p.waitForTimeout(400);
note('"+ Add folder" makes a first-level folder in Bookmarks bar', (await parentOf('Tools')) === 'Bookmarks bar');

// filter
await panel.getByLabel('Filter bookmarks').fill('svelte');
await p.waitForTimeout(250);
note('Filter shows the match with its path', (await panel.getByRole('link', { name: 'Svelte' }).isVisible()) && !(await panel.getByRole('link', { name: 'Vue' }).isVisible()));
await shot('panel-filter', panel);
await panel.getByLabel('Filter bookmarks').fill('');

// delete non-empty folder → confirm → undo
const fwRow = panel.locator('.bm-row', { has: p.getByRole('button', { name: /(Expand|Collapse) Frameworks/ }) }).first();
await fwRow.hover();
await fwRow.getByRole('button', { name: 'Delete Frameworks' }).click();
const confirm = panel.getByRole('alertdialog');
note('Deleting a non-empty folder asks first', await confirm.isVisible(), (await confirm.textContent())?.trim());
await shot('panel-confirm', panel);
await confirm.getByRole('button', { name: 'Delete' }).click();
await p.waitForTimeout(500);
note('Folder removed from the browser', (await parentOf('Svelte')) === null);
const bar = p.getByTestId('undo-bar');
note('Undo bar shown', await bar.isVisible(), await bar.textContent());
await bar.getByRole('button', { name: 'Undo' }).click();
await p.waitForTimeout(800);
note('Undo restores the folder and its sites', (await parentOf('Svelte')) === 'Frameworks' && (await parentOf('Frameworks')) === 'Frontend');

// external change shows up live
await p.evaluate(async (id) => chrome.bookmarks.create({ parentId: id, title: 'Live added', url: 'https://example.net' }), seed.fe);
await p.waitForTimeout(500);
note('A change made in the browser appears live', await panel.getByRole('link', { name: 'Live added' }).isVisible());

// ---- Tree View ----
await panel.getByRole('button', { name: 'Tree View' }).click();
const tv = p.getByRole('dialog', { name: 'Bookmarks tree view' });
await tv.waitFor();
await p.waitForTimeout(700);
await shot('tree-fit');
note('Tree View shows root boxes', (await tv.locator('.bm-box.is-root').count()) >= 2);
await tv.getByRole('button', { name: 'Expand all' }).click();
await tv.getByRole('button', { name: 'Fit' }).click();
await p.waitForTimeout(500);

const box = (t) => tv.locator('.bm-box', { has: p.locator('span', { hasText: new RegExp(`^${t}$`) }) }).first();
const center = async (loc) => {
  const b = await loc.boundingBox();
  return { x: b.x + b.width / 2, y: b.y + Math.min(b.height / 2, 20) };
};
const realDrag = async (from, to, steps = 18) => {
  const a = await center(from);
  const z = await center(to);
  await p.mouse.move(a.x, a.y);
  await p.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await p.mouse.move(a.x + ((z.x - a.x) * i) / steps, a.y + ((z.y - a.y) * i) / steps);
    await p.waitForTimeout(16);
  }
  await p.waitForTimeout(80);
};

// site → another folder
const t0 = Date.now();
await realDrag(tv.locator('.bm-site', { hasText: 'Deno' }), box('Reading'));
note('Ghost follows the pointer while dragging', await p.locator('.bm-ghost').isVisible());
note('Target folder highlights', (await tv.locator('.bm-box.is-over').count()) === 1);
await shot('tree-dragging');
await p.mouse.up();
await p.waitForTimeout(600);
note('Site moved in the browser', (await parentOf('Deno')) === 'Reading', `${Date.now() - t0} ms`);

// folder → another folder
await realDrag(box('Frameworks').locator('[data-bm-item]').first(), box('Reading'));
await p.mouse.up();
await p.waitForTimeout(700);
note('Folder (with its sites) moved', (await parentOf('Frameworks')) === 'Reading' && (await parentOf('React')) === 'Frameworks');

// folder into its own child → blocked
await realDrag(box('Work').locator('[data-bm-item]').first(), box('Server side'));
note('Dropping a folder into its own sub folder is blocked', (await tv.locator('.bm-box.is-blocked').count()) === 1);
await shot('tree-blocked');
await p.mouse.up();
await p.waitForTimeout(500);
note('...and nothing moved', (await parentOf('Work')) === 'Bookmarks bar');

// Esc cancels a drag
await realDrag(tv.locator('.bm-site', { hasText: 'MDN' }), box('Tools'));
await p.keyboard.press('Escape');
await p.mouse.up();
await p.waitForTimeout(400);
note('Esc cancels a drag', (await parentOf('MDN')) === 'Frontend' && (await tv.isVisible()));

// rapid drags back and forth (smoothness / errors)
for (let i = 0; i < 6; i++) {
  await realDrag(tv.locator('.bm-site', { hasText: 'Hacker News' }), box(i % 2 ? 'Bookmarks bar' : 'Tools'), 10);
  await p.mouse.up();
  await p.waitForTimeout(250);
}
note('6 rapid moves back and forth end in the right place', (await parentOf('Hacker News')) === 'Bookmarks bar');

// pan + zoom
const vp = tv.locator('.bm-canvas');
const vb = await vp.boundingBox();
await p.mouse.move(vb.x + 30, vb.y + vb.height - 30);
await p.mouse.down();
await p.mouse.move(vb.x + 230, vb.y + vb.height - 80, { steps: 8 });
await p.mouse.up();
await p.mouse.wheel(0, -300);
await p.waitForTimeout(300);
note('Pan and zoom work without errors', errors.length === 0);
await shot('tree-panned');
// "+N more" in Reading (11+ sites)
const more = box('Reading').locator('.bm-more');
note('Long folders fold behind "+N more"', (await more.count()) > 0, await more.first().textContent().catch(() => ''));

await p.keyboard.press('Escape');
await p.waitForTimeout(300);
note('Esc closes Tree View first, panel stays', !(await tv.isVisible()) && (await panel.isVisible()));
note('Console / page errors', errors.length === 0, errors.slice(0, 4).join(' || '));
fs.writeFileSync(`${OUT}${theme}-log.json`, JSON.stringify(log, null, 2));
await ctx.close();

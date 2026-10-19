// Manual-style QA walk-through of the Site Map lifecycle. Usage: node qa-sitemap.mjs <dark|light>
import { chromium } from 'file:///C:/GhoshCode%20WorkSpace/DevDeck/node_modules/playwright/index.mjs';
import fs from 'fs';
const theme = process.argv[2] ?? 'dark';
const OUT = new URL('./qa/', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
fs.mkdirSync(OUT, { recursive: true });
const log = [];
const note = (step, ok, detail = '') => {
  log.push({ step, ok, detail });
  console.log(`${ok === true ? 'PASS' : ok === false ? 'FAIL' : 'NOTE'} | ${step}${detail ? ' | ' + detail : ''}`);
};
let n = 0;
const shot = async (name, loc) => {
  const file = `${OUT}${theme}-${String(++n).padStart(2, '0')}-${name}.png`;
  if (loc) await loc.screenshot({ path: file });
  else await p.screenshot({ path: file });
  return file;
};

const b = await chromium.launch({ channel: 'msedge' });
const p = await b.newPage({ viewport: { width: 1920, height: 1000 } });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => m.type() === 'error' && !/Failed to load resource|net::|favicon|CORS|ERR_/i.test(m.text()) && errors.push(m.text()));

await p.goto('http://localhost:5180/');
await p.locator('[data-category-id]').first().waitFor();
await p.getByRole('button', { name: /mode$/ }).first().click();
await p.getByRole('button', { name: /mode$/ }).first().click();
await p.evaluate((theme) => {
  const raw = JSON.parse(localStorage.getItem('devdeck'));
  Object.assign(raw.state.settings, { themeMode: theme, presetTheme: theme === 'light' ? 'default-light' : 'default-dark', greetingName: 'QA' });
  raw.state.trash = { sites: [], processing: [] };
  localStorage.setItem('devdeck', JSON.stringify(raw));
}, theme);
await p.reload();
await p.locator('[data-category-id]').first().waitFor();
await p.waitForTimeout(800);
const state = () => p.evaluate(() => JSON.parse(localStorage.getItem('devdeck')).state);

const CAT = 'QA Testing';
const SUBS = ['Docs', 'Tools', 'Blogs'];
const SITES = {
  Docs: [['https://developer.mozilla.org', 'MDN'], ['https://web.dev', 'web.dev']],
  Tools: [['https://regex101.com', 'Regex101'], ['https://caniuse.com', 'Can I Use'], ['https://bundlephobia.com', 'Bundlephobia']],
  Blogs: [['https://css-tricks.com', 'CSS-Tricks'], ['https://www.smashingmagazine.com', 'Smashing']],
};
const dialog = p.getByRole('dialog', { name: 'Site Map & Hierarchy' });
const card = () => dialog.locator(`section[aria-label="${CAT}"]`);
const openMap = async () => {
  if (await dialog.isVisible()) return;
  await p.getByRole('button', { name: 'Site Map & Hierarchy' }).click();
  await dialog.waitFor();
  await p.waitForTimeout(400);
};
// HTML5 drag: one DataTransfer carried through dragstart → dragenter/over → drop → dragend
const dragDrop = async (src, dst) => {
  const dt = await p.evaluateHandle(() => new DataTransfer());
  const h = await src.elementHandle();
  await h.dispatchEvent('dragstart', { dataTransfer: dt });
  await dst.dispatchEvent('dragenter', { dataTransfer: dt });
  await dst.dispatchEvent('dragover', { dataTransfer: dt });
  await p.waitForTimeout(120);
  await dst.dispatchEvent('drop', { dataTransfer: dt });
  await h.dispatchEvent('dragend', { dataTransfer: dt }).catch(() => {});
};
p.setDefaultTimeout(8000);
const step = async (name, fn) => {
  try {
    await fn();
  } catch (e) {
    note(name, false, 'threw: ' + e.message.split('\n')[0]);
    await shot('error-' + name.replace(/\W+/g, '-').slice(0, 30));
  }
};

// 1. New category from the Site Map
await step('Create category', async () => {
  await openMap();
  await dialog.getByRole('button', { name: '+ New Category' }).click();
  const color = await dialog.getByLabel('Category colour').inputValue();
  const used = (await state()).categories.map((c) => c.color.toLowerCase());
  note('New category: colour preset is unused', !used.includes(color.toLowerCase()), color);
  await shot('new-category-form', dialog.locator('header, .sitemap-panel > div').first());
  await dialog.getByLabel('New category name').fill(CAT);
  await dialog.getByLabel('New category name').press('Enter');
  await card().waitFor({ timeout: 3000 });
  await card().scrollIntoViewIfNeeded();
  const cat = (await state()).categories.find((c) => c.name === CAT);
  note('Category created with the chosen colour', !!cat && cat.color.toLowerCase() === color.toLowerCase(), cat?.color);
  await shot('category-created', card());
});

// 2. Subcategories (+ a blur-cancel check)
await step('Add subcategories', async () => {
  for (const s of SUBS) {
    await card().getByRole('button', { name: `Add a subcategory to ${CAT}` }).click();
    const input = card().getByLabel('New subcategory name');
    await input.fill(s);
    await input.press('Enter');
    await p.waitForTimeout(150);
  }
  await card().getByRole('button', { name: `Add a subcategory to ${CAT}` }).click();
  await card().getByLabel('New subcategory name').fill('Ghost');
  await dialog.locator('h2, p').first().click(); // click outside the field
  await p.waitForTimeout(200);
  const st = await state();
  const cat = st.categories.find((c) => c.name === CAT);
  const names = st.subcategories.filter((x) => x.categoryId === cat.id).map((x) => x.name);
  note('Three subcategories created', SUBS.every((s) => names.includes(s)), names.join(', '));
  note('Click-outside does not create "Ghost"', !names.includes('Ghost'));
  await shot('subcategories', card());
});

// 3. Sites into each subcategory through the shared Add Site window
const addSite = async (url, name, sub) => {
  await card().getByRole('button', { name: '+ Add site' }).click();
  const form = p.getByRole('dialog', { name: 'Add new site' });
  await form.waitFor();
  await form.getByLabel('Site URL').fill(url);
  await form.getByLabel('Display name').fill(name);
  const catBox = form.getByRole('combobox', { name: 'Category', exact: true });
  const catText = (await catBox.textContent())?.trim();
  if (!catText?.includes(CAT)) note(`Add site: category preset to the card's category`, false, `showed "${catText}"`);
  await form.getByRole('combobox', { name: 'Subcategory', exact: true }).click();
  await p.getByRole('option', { name: sub, exact: true }).click();
  await form.getByRole('button', { name: 'Add to DevDeck' }).click();
  await form.waitFor({ state: 'detached' });
};
await step('Add sites', async () => {
  for (const sub of SUBS) for (const [url, name] of SITES[sub]) await addSite(url, name, sub);
  const st = await state();
  const cat = st.categories.find((c) => c.name === CAT);
  const subId = (nm) => st.subcategories.find((x) => x.categoryId === cat.id && x.name === nm)?.id;
  for (const sub of SUBS) {
    const got = st.sites.filter((s) => s.subcategoryId === subId(sub)).map((s) => s.name);
    note(`Sites in ${sub}`, SITES[sub].every(([, nm]) => got.includes(nm)), got.join(', '));
  }
  await card().scrollIntoViewIfNeeded();
  await shot('sites-added', card());
  // deck: the new category card shows up too
  note('Deck shows the new category card', (await p.locator(`[data-category-id="${cat.id}"]`).count()) > 0);
});

// 4. Delete every site in Tools by dragging onto the card's bin
await step('Delete Tools sites via bin', async () => {
  const bin = card().getByTestId('sitemap-bin');
  for (const [, name] of SITES.Tools) {
    const chip = card().locator(`a[title^="${name} —"]`);
    await dragDrop(chip, bin);
    await p.waitForTimeout(250);
    const bar = p.getByTestId('undo-bar').filter({ hasText: `Deleted ${name}` });
    note(`Bin drop: undo bar for ${name}`, (await bar.count()) > 0, await bar.first().textContent().catch(() => ''));
  }
  await shot('tools-emptied', card());
  const st = await state();
  note('Tools sites are in the recycle bin', SITES.Tools.every(([, nm]) => st.trash.sites.some((t) => t.name === nm)));
});

// 5. Delete the (now empty) Tools subcategory: no prompt, undo bar
await step('Delete Tools subcategory', async () => {
  await card().getByRole('button', { name: /Delete section Tools/ }).click();
  await p.waitForTimeout(250);
  const prompt = await card().getByRole('alertdialog').count();
  note('No confirmation prompt for a subcategory', prompt === 0);
  const bar = p.getByTestId('undo-bar');
  note('Undo bar after subcategory delete', await bar.isVisible(), await bar.textContent());
  await shot('tools-deleted', card());
  const st = await state();
  note('Tools subcategory removed', !st.subcategories.some((x) => x.name === 'Tools'));
});

// 5b. Extra: delete Blogs WITH sites, then Undo inside 5 s
await step('Delete Blogs with sites, then Undo', async () => {
  await card().getByRole('button', { name: /Delete section Blogs/ }).click();
  await p.waitForTimeout(200);
  let st = await state();
  note('Blogs sites went to the bin (not General)', SITES.Blogs.every(([, nm]) => st.trash.sites.some((t) => t.name === nm)) && !st.sites.some((s) => s.name === 'CSS-Tricks' && s.url.includes('css-tricks.com') && st.categories.some((c) => c.id === s.categoryId && c.name === CAT)));
  const bar = p.getByTestId('undo-bar');
  note('Undo bar text', true, await bar.textContent());
  await shot('blogs-deleted-undo-bar', p.locator('body'));
  await bar.getByRole('button', { name: 'Undo' }).click();
  await p.waitForTimeout(300);
  st = await state();
  const blogs = st.subcategories.find((x) => x.name === 'Blogs');
  const back = st.sites.filter((s) => s.subcategoryId === blogs?.id).map((s) => s.name);
  note('Undo restores Blogs and both sites into it', !!blogs && SITES.Blogs.every(([, nm]) => back.includes(nm)), back.join(', '));
  note('Undo empties those sites from the bin', !st.trash.sites.some((t) => t.name === 'CSS-Tricks' || t.name === 'Smashing'));
  await shot('blogs-undone', card());
});

// 5c. Undo bar times out by itself (~5 s)
await step('Undo bar timeout', async () => {
  await card().getByRole('button', { name: `Add a subcategory to ${CAT}` }).click();
  await card().getByLabel('New subcategory name').fill('Temp');
  await card().getByLabel('New subcategory name').press('Enter');
  await card().getByRole('button', { name: /Delete section Temp/ }).click();
  await p.mouse.move(5, 5);
  await p.waitForTimeout(5600);
  note('Undo bar gone after ~5 s', !(await p.getByTestId('undo-bar').isVisible()));
});

// 6. Add the Tools sites back from the recycle bin (Restore ×2, Add to URL ×1)
await step('Re-add Tools sites', async () => {
  await card().getByRole('button', { name: '+ Add site' }).click();
  const form = p.getByRole('dialog', { name: 'Add new site' });
  await form.getByRole('button', { name: /Deleted \/ archived sites/ }).click();
  await form.getByLabel('Search deleted sites').fill('');
  await p.waitForTimeout(200);
  const rowText = await form.locator('li', { hasText: 'Regex101' }).first().textContent();
  note('Bin row shows the restore destination (subcategory gone → General)', /Restores to QA Testing › General/.test(rowText ?? ''), rowText?.replace(/\s+/g, ' ').trim());
  await shot('bin-rows', form);
  await form.getByRole('button', { name: 'Restore Regex101' }).click();
  await form.getByRole('button', { name: 'Restore Can I Use' }).click();
  await form.getByRole('button', { name: 'Put Bundlephobia in the URL field' }).click();
  const url = await form.getByLabel('Site URL').inputValue();
  const name = await form.getByLabel('Display name').inputValue();
  note('Add to URL fills URL and name', url.includes('bundlephobia.com') && name === 'Bundlephobia', `${url} / ${name}`);
  await shot('add-to-url-filled', form);
  await form.getByRole('button', { name: 'Add to DevDeck' }).click();
  await form.waitFor({ state: 'detached' });
  const st = await state();
  const cat = st.categories.find((c) => c.name === CAT);
  const general = st.sites.filter((s) => s.categoryId === cat.id && s.subcategoryId === null).map((s) => s.name);
  note('Restored Tools sites land in General', ['Regex101', 'Can I Use'].every((x) => general.includes(x)), general.join(', '));
  const bp = st.sites.filter((s) => s.name === 'Bundlephobia' && s.categoryId === cat.id);
  note('Add-to-URL site added once', bp.length === 1, bp.map((s) => `${s.categoryId === cat.id ? CAT : s.categoryId}/${s.subcategoryId ?? 'General'}`).join(' '));
  note('Add-to-URL leaves the old copy in the bin', st.trash.sites.some((t) => t.name === 'Bundlephobia') ? null : true, 'stays in bin by design');
  await card().scrollIntoViewIfNeeded();
  await shot('tools-readded', card());
});

// 7. Delete the whole category: confirmation, sites to the bin
await step('Delete category', async () => {
  const before = (await state()).sites.filter((s) => s.categoryId === (/** @type any */ (null))).length;
  await card().getByRole('button', { name: `Delete category ${CAT}` }).click();
  const confirm = card().getByRole('alertdialog');
  note('Category delete asks for confirmation', await confirm.isVisible(), (await confirm.textContent())?.replace(/\s+/g, ' '));
  await shot('category-confirm', card());
  const ids = (await state()).sites.filter((s) => s.categoryId === (/** @type any */ (null))).map((s) => s.id);
  const st0 = await state();
  const cat = st0.categories.find((c) => c.name === CAT);
  const siteNames = st0.sites.filter((s) => s.categoryId === cat.id).map((s) => s.name);
  await confirm.getByRole('button', { name: 'Delete category' }).click();
  await p.waitForTimeout(300);
  const st = await state();
  note('Category and its subcategories removed', !st.categories.some((c) => c.name === CAT) && !st.subcategories.some((x) => x.categoryId === cat.id));
  note('All its sites moved to the bin', siteNames.every((nm) => st.trash.sites.some((t) => t.name === nm)), siteNames.join(', '));
  globalThis.qaSites = siteNames;
  void before;
  void ids;
});

// 8. Add all the deleted category's sites back → Uncategorized
await step('Restore deleted category sites', async () => {
  const anyCard = dialog.locator('section[data-sitemap-category]').first();
  await anyCard.scrollIntoViewIfNeeded();
  await anyCard.getByRole('button', { name: '+ Add site' }).click();
  const form = p.getByRole('dialog', { name: 'Add new site' });
  await form.getByRole('button', { name: /Deleted \/ archived sites/ }).click();
  const row = form.locator('li', { hasText: 'MDN' }).first();
  const txt = (await row.textContent())?.replace(/\s+/g, ' ').trim();
  note('Row for a deleted-category site: no "Restores to", shows Uncategorized', !/Restores to/.test(txt ?? '') && /Uncategorized/.test(txt ?? ''), txt);
  await shot('bin-category-gone', form);
  for (const nm of globalThis.qaSites) {
    const btn = form.getByRole('button', { name: `Restore ${nm}`, exact: true });
    if (await btn.count()) await btn.first().click();
  }
  // the Bundlephobia copy that "Add to URL" left behind is still there; restore it too to see the duplicate
  const dup = form.getByRole('button', { name: 'Restore Bundlephobia', exact: true });
  note('Leftover Bundlephobia copy still in the bin (from Add to URL)', (await dup.count()) > 0);
  await form.getByRole('button', { name: 'Cancel' }).click();
  const st = await state();
  const loose = st.sites.filter((s) => s.categoryId === '').map((s) => s.name);
  note('Restored sites are Uncategorized', globalThis.qaSites.every((nm) => loose.includes(nm)), loose.join(', '));
  const unc = dialog.getByTestId('sitemap-uncategorized');
  await unc.scrollIntoViewIfNeeded();
  note('Site Map shows the Uncategorized / None card', await unc.isVisible());
  await shot('sitemap-uncategorized', unc);
});

// 9. Where they show: deck (last page), Site Map, Settings → Sitemap, search
await step('Deck + search + settings sitemap', async () => {
  await p.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {});
  const active = await p.evaluate(() => document.activeElement?.tagName + ' ' + (document.activeElement?.getAttribute('aria-label') ?? ''));
  note('Esc closes the Site Map after the Add Site window was cancelled', !(await dialog.isVisible()), 'focus was on ' + active);
  if (await dialog.isVisible()) await dialog.getByRole('button', { name: /Close/ }).first().click();
  const dots = p.getByTestId('cards-pager').getByRole('tab');
  const count = await dots.count();
  if (count) await dots.nth(count - 1).click();
  await p.waitForTimeout(900);
  const tiles = p.locator('[data-uncategorized]');
  note('Deck: Uncategorized tiles after the last card', (await tiles.count()) > 0 && (await tiles.isVisible()));
  await shot('deck-last-page', p.locator('[data-categories-container], main').first());
  // search finds an uncategorized site
  const search = p.getByPlaceholder(/Search your sites/);
  await search.click();
  await search.fill('Regex101');
  await p.waitForTimeout(500);
  await shot('search-regex101', p.locator('[data-widget="search"]'));
  await search.fill('');
  await p.keyboard.press('Escape');
  // settings sitemap graph
  await p.getByRole('button', { name: 'Settings' }).click();
  const sm = p.getByRole('button', { name: /Sitemap/ });
  if (await sm.count()) {
    await sm.first().click();
    await p.waitForTimeout(1200);
    const node = p.getByText('Uncategorized / None').first();
    note('Settings → Sitemap shows the Uncategorized node', await node.isVisible().catch(() => false));
    await shot('settings-sitemap');
  } else note('Settings → Sitemap tab', null, 'tab not found by name');
});

note('Console / page errors', errors.length === 0, errors.slice(0, 5).join(' || '));
fs.writeFileSync(`${OUT}${theme}-log.json`, JSON.stringify(log, null, 2));
await b.close();

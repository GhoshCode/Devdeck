import { test, expect } from '@playwright/test';

// Countdown timers, the category overview, site pins, the scrollbar-only
// card row, AI ambience and the greeting styles.

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('[data-category-id]').first().waitFor({ state: 'visible' });
});

test('a to-do timer counts down: days left, then a ticking clock', async ({ page }) => {
  await page.getByRole('tab', { name: /^To-do/ }).click();
  const input = page.getByRole('textbox', { name: 'New task' });
  await input.fill('Ship the beta');
  await page.getByRole('button', { name: 'Attach due date' }).click();
  const picker = page.getByRole('dialog', { name: 'Due date and time' });
  await picker.getByRole('tab', { name: 'Timer' }).click();
  await picker.getByRole('button', { name: '4 days', exact: true }).click();
  await picker.getByRole('button', { name: 'Done' }).click();
  await input.press('Enter');
  const row = page.locator('[data-todo-id]', { hasText: 'Ship the beta' });
  await expect(row.getByTestId('countdown')).toHaveText('4 days left');

  // Switch it to 25 minutes from the chip: hh:mm:ss that ticks.
  await row.getByTestId('countdown').click();
  await picker.getByRole('button', { name: '25 min', exact: true }).click();
  await picker.getByRole('button', { name: 'Done' }).click();
  const first = await row.getByTestId('countdown').textContent();
  expect(first).toMatch(/^00:2[45]:\d\d$/);
  await expect(row.getByTestId('countdown')).not.toHaveText(first!, { timeout: 3000 });
});

test('a Focus site timer shows months left', async ({ page }) => {
  await page.getByRole('button', { name: '+ Add a site' }).click();
  await page.getByRole('tab', { name: 'From your sites' }).click();
  await page.getByRole('textbox', { name: 'Add a site to Currently Processing' }).fill('https://react.dev');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  const row = page.locator('[data-processing-item]').first();
  await row.hover();
  await row.getByRole('button', { name: /^Set a timer for/ }).click();
  await page.getByRole('radio', { name: 'Months' }).click();
  await page.getByRole('button', { name: 'More', exact: true }).click(); // 2 months
  await expect(row.getByTestId('countdown')).toHaveText('2 months left');
});

test('category overview lists every category and jumps to one', async ({ page }) => {
  // the overview replaces the cards, so count them before opening it
  const count = await page.locator('[data-category-id]').count();
  expect(count).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'All categories' }).click();
  const overview = page.getByTestId('category-overview');
  await expect(overview).toBeVisible();
  await expect(overview.getByRole('button', { name: /sites — jump to card$/ })).toHaveCount(count);
  await overview.getByText('Security & Auth', { exact: true }).click(); // the name, not a site icon inside the tile
  await expect(overview).toHaveCount(0);
  await expect.poll(() => page.locator('[data-cards-track]').evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
});

test('pinning a site adds it to the top row; unpinning removes it', async ({ page }) => {
  const card = page.locator('[data-category-id]').nth(1);
  const rail = card.locator('[aria-label="Primary sites rail"] a');
  const before = await rail.count();
  const pin = card.getByRole('button', { name: /^Add .* to the top row$/ }).first();
  const name = (await pin.getAttribute('aria-label'))!.replace(/^Add | to the top row$/g, '');
  await pin.click({ force: true });
  await expect(rail).toHaveCount(before + 1);
  // unpinning is done from the site's row (the tiles carry no badge)
  await expect(card.getByRole('button', { name: `Remove ${name} from the top row` })).toHaveCount(1);
  await card.getByRole('button', { name: `Remove ${name} from the top row` }).first().click({ force: true });
  await expect(rail).toHaveCount(before);
});

test('the card row moves only with its scrollbar — no grab, no wheel', async ({ page }) => {
  const track = page.locator('[data-cards-track]');
  await expect.poll(() => track.evaluate((el) => getComputedStyle(el).cursor)).not.toBe('grab');
  const box = (await track.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height - 8);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 300, box.y + box.height - 8, { steps: 6 });
  await page.mouse.up();
  expect(await track.evaluate((el) => el.scrollLeft)).toBe(0);
});

test('AI mode tints the search bar with the chosen AI', async ({ page }) => {
  await page.getByRole('button', { name: 'Gemini mode' }).click(); // saves settings once
  await page.getByRole('button', { name: 'Gemini mode' }).click();
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('devdeck')!);
    raw.state.settings.aiProvider = 'claude';
    localStorage.setItem('devdeck', JSON.stringify(raw));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Claude mode' }).click();
  await expect(page.locator('[data-ai="claude"].gemini-ring')).toBeVisible();
});

test('greeting styles colour the words, not the name', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'DevDeck Settings' });
  await modal.getByRole('button', { name: /You & greeting/ }).click();
  await modal.getByRole('textbox', { name: 'Greeting name' }).fill('Ada');
  await modal.getByRole('radio', { name: 'Accent greeting' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('greet-words')).toHaveClass(/greet-accent/);
  await expect(page.getByTestId('greet-name')).not.toHaveClass(/greet-accent/);
});

test('dropdowns are themed comboboxes with keyboard support', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'DevDeck Settings' });
  await modal.getByRole('button', { name: /News & jobs/ }).first().click();
  await expect(modal.locator('select')).toHaveCount(0);
  const combo = modal.getByRole('combobox', { name: 'Feed panel' });
  await combo.focus();
  await page.keyboard.press('ArrowDown'); // opens
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(combo).toHaveText('Jobs');
  await expect(modal).toBeVisible();
});

test('deleting a to-do shows an undo bar that brings it back', async ({ page }) => {
  await page.getByRole('tab', { name: /^To-do/ }).click();
  await page.getByRole('textbox', { name: 'New task' }).fill('Write the changelog');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Expand', exact: true }).click();
  await page.getByRole('button', { name: 'Delete "Write the changelog"' }).last().click();
  const bar = page.getByTestId('undo-bar');
  await expect(bar).toContainText('Write the changelog');
  await bar.getByRole('button', { name: 'Undo' }).click();
  await expect(bar).toHaveCount(0);
  await expect(page.locator('[data-todo-id]', { hasText: 'Write the changelog' }).first()).toBeVisible();
});

test('removing a Focus site can be undone; the bar times out on its own', async ({ page }) => {
  await page.getByRole('button', { name: '+ Add a site' }).click();
  await page.getByRole('tab', { name: 'From your sites' }).click();
  await page.getByRole('textbox', { name: 'Add a site to Currently Processing' }).fill('https://react.dev');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: /^Remove (?!.* top row$)/ }).first().click();
  const bar = page.getByTestId('undo-bar');
  await expect(bar).toContainText(/Removed .* from Currently processing/);
  await bar.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('button', { name: /^Remove (?!.* top row$)/ })).toHaveCount(1);
  await page.getByRole('button', { name: /^Remove (?!.* top row$)/ }).first().click();
  await expect(bar).toBeVisible();
  await expect(bar).toHaveCount(0, { timeout: 8000 }); // 5 s, then gone for good
  await expect(page.getByRole('button', { name: /^Remove (?!.* top row$)/ })).toHaveCount(0);
});

test('Focus reminders can repeat weekly or monthly', async ({ page }) => {
  await page.getByRole('button', { name: '+ Add a site' }).click();
  await page.getByRole('tab', { name: 'From your sites' }).click();
  await page.getByRole('textbox', { name: 'Add a site to Currently Processing' }).fill('https://react.dev');
  await page.keyboard.press('Enter');
  const card = page.locator('li[data-processing-id]').first(); // the added site's card (the add side has the same controls)
  await card.getByRole('radio', { name: 'Weekly' }).click();
  await card.getByRole('combobox', { name: 'Repeat every' }).click();
  await page.getByRole('option', { name: 'Every 2 weeks' }).click();
  await expect(page.getByText(/Every 2 weeks at/).first()).toBeVisible();
  await card.getByRole('radio', { name: 'Monthly' }).click();
  await card.getByRole('combobox', { name: 'Day of the month' }).click();
  await page.getByRole('option', { name: 'Last day' }).click();
  await expect(page.getByText(/Monthly on the last day at/).first()).toBeVisible();
  await expect(card.getByRole('group', { name: 'Days of the week' })).toHaveCount(0); // not used monthly
});

test('sites reorder in the Site Map by dropping onto another site', async ({ page }) => {
  await page.getByRole('button', { name: 'Site Map & Hierarchy' }).click();
  const dialog = page.getByRole('dialog', { name: 'Site Map & Hierarchy' });
  const section = dialog.locator('[data-sitemap-section$="/general"]').first(); // Frontend · General (10 sites)
  const chips = section.locator('[data-sitemap-site]');
  const before = await chips.allTextContents();
  await chips.nth(2).dragTo(chips.nth(0));
  const after = await chips.allTextContents();
  expect(after[0]).toBe(before[2]);
  expect(after.slice(1)).toEqual([before[0], before[1], ...before.slice(3)]);
});


test('opens in a balanced two-card mode; edge tabs cycle 2 → 1 → 3 → 2; the handles resize freely', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  await settle(page);
  const cockpit = page.locator('[data-zone="cockpit"]');
  const cols = () => cockpit.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').map(parseFloat));
  const extra = async () => {
    const c = await cols();
    return [c[0] - 250, c[4] - 300]; // over each side's base
  };
  const cards = () => page.locator('[data-cards-track] > *').first().evaluate((card) => {
    const centre = document.querySelector('[data-zone="center"]')!.getBoundingClientRect();
    return Math.round(centre.width / card.getBoundingClientRect().width);
  });
  const tab = page.locator('[data-edge-tab="left"]');
  await expect(tab).toHaveAttribute('aria-label', 'Show 1 card'); // starts with two
  let [l, r] = await extra();
  expect(Math.abs(l - r)).toBeLessThanOrEqual(1); // balanced
  expect(await cards()).toBe(2);

  await tab.click(); // 2 → 1
  await expect(tab).toHaveAttribute('aria-label', 'Show 3 cards');
  [l, r] = await extra();
  expect(Math.abs(l - r)).toBeLessThanOrEqual(1);
  await page.locator('[data-edge-tab="right"]').click(); // either tab: 1 → 3
  await expect(tab).toHaveAttribute('aria-label', 'Show 2 cards');
  await expect.poll(async () => (await cols())[0]).toBeLessThan(290); // close to the base widths
  await tab.click(); // 3 → 2
  await expect(tab).toHaveAttribute('aria-label', 'Show 1 card');

  // the outside handle moves px by px
  await page.waitForTimeout(450); // let the column animation finish
  const start = (await cols())[0];
  const handle = page.locator('[data-snap-handle="left"]');
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => (await cols())[0]).toBe(start + 100);
  await handle.dblclick(); // back to the card mode
  await expect.poll(async () => (await cols())[0]).toBe(start);
});

test('edge tabs sit inside the cards box, carry a grip and drag by whole cards both ways', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  await settle(page);
  const tab = page.locator('[data-edge-tab="left"]');
  await expect(tab.locator('.edge-grip')).toHaveCount(3);
  const box = (await page.locator('[data-cards-track]').locator('..').boundingBox())!;
  const t = (await tab.boundingBox())!;
  expect(t.x).toBeGreaterThanOrEqual(box.x - 0.5); // inside the box's left edge
  expect(t.x + t.width).toBeLessThanOrEqual(box.x + 24);

  const label = () => tab.getAttribute('aria-label');
  const drag = async (dx: number) => {
    await settle(page); // the tab moves with the columns: grab it once they stop
    const b = (await tab.boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 + dx, b.y + b.height / 2, { steps: 10 });
    await page.mouse.up();
  };
  await drag(450); // in: two → one card
  await expect.poll(label).toBe('Show 3 cards');
  await drag(-900); // out two cards: three
  await expect.poll(label).toBe('Show 2 cards');
  await drag(450); // in again: two
  await expect.poll(label).toBe('Show 1 card');
});

test('the links bar starts under the search row and fills up to the terminal, whatever mode the cards are in', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  await settle(page);
  const span = async () => {
    const s = (await page.locator('[data-search-row]').boundingBox())!;
    const l = (await page.locator('[data-zone="links-row"]').boundingBox())!;
    const h = (await page.getByTestId('top-split-handle').boundingBox())!;
    return [Math.round(l.x - s.x), Math.round(h.x - (l.x + l.width))];
  };
  expect(await span()).toEqual([0, 12]);
  await page.locator('[data-edge-tab="left"]').click(); // one card
  await page.waitForTimeout(400);
  expect(await span()).toEqual([0, 12]);
});

test('the links / terminal handle sits midway, and a shrunk links bar still scrolls to every chip', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  await settle(page);
  const strip = page.getByTestId('links-strip');
  const handle = page.getByTestId('top-split-handle');
  const s = (await strip.boundingBox())!;
  const h = (await handle.boundingBox())!;
  const term = (await page.locator('[data-zone="right-top"]').boundingBox())!;
  expect(Math.abs(h.x - (s.x + s.width) - (term.x - (h.x + h.width)))).toBeLessThanOrEqual(1);

  // shrink the links bar
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x - 700, h.y + h.height / 2, { steps: 8 });
  await page.mouse.up();
  const scroller = page.locator('[data-strip="scroll"]');
  await expect.poll(() => scroller.evaluate((el) => el.scrollWidth > el.clientWidth + 20)).toBe(true);
  const sb = (await scroller.boundingBox())!;
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
  await page.mouse.wheel(0, 2000);
  await expect.poll(() => scroller.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  // the last chip can be brought into view
  const last = strip.locator('[data-chip]').last();
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeInViewport();
});

test('long search text: the bar keeps one line with "…" and a wider panel below holds it all', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  await settle(page);
  const input = page.getByRole('combobox', { name: 'Search' });
  await input.fill('short');
  await expect(page.getByTestId('search-panel')).toHaveCount(0);
  await input.fill('a very long prompt that keeps going and going well past the width of the search bar '.repeat(60));
  const panel = page.getByTestId('search-panel');
  await expect(panel).toBeVisible();
  const bar = (await page.locator('[data-composer]').boundingBox())!;
  const p = (await panel.boundingBox())!;
  expect(bar.height).toBe(52); // the icons don't move
  expect(Math.abs(p.width - bar.width * 1.5)).toBeLessThanOrEqual(2);
  expect(Math.abs(p.x - bar.x)).toBeLessThanOrEqual(2); // starts at the bar's left edge, runs on to the right
  await expect.poll(() => panel.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  await expect(page.getByTestId('search-preview')).toHaveCSS('text-overflow', 'ellipsis');
  await page.keyboard.type(' tail');
  await expect(input).toHaveValue(/ tail$/); // typing continues in the panel
});

test('the links / terminal handle stays beside the terminal when it is resized', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  await settle(page);
  const handle = page.getByTestId('top-split-handle');
  const gap = async () => {
    const h = (await handle.boundingBox())!;
    const t = (await page.locator('[data-zone="right-top"]').boundingBox())!;
    return Math.round(t.x - (h.x + h.width));
  };
  expect(await gap()).toBe(12);
  const h = (await handle.boundingBox())!;
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + 200, h.y + h.height / 2, { steps: 6 }); // narrower terminal
  await page.mouse.up();
  await expect.poll(gap).toBe(12); // still right beside it, not floating in the gap
  // and the links bar grew to fill the room
  const l = (await page.locator('[data-zone="links-row"]').boundingBox())!;
  const h2 = (await handle.boundingBox())!;
  expect(Math.round(h2.x - (l.x + l.width))).toBe(12);
});

// Waits until the cockpit's columns stop changing (cards measured, layout applied).
async function settle(page: import('@playwright/test').Page) {
  const cols = () => page.locator('[data-zone="cockpit"]').evaluate((el) => getComputedStyle(el).gridTemplateColumns);
  await page.locator('[data-cards-track] > *').first().waitFor();
  let last = '';
  await expect
    .poll(async () => {
      const now = await cols();
      const same = now === last;
      last = now;
      return same;
    }, { intervals: [250] })
    .toBe(true);
}

test('quick-links panel: drag the grip down to pull it open, drag its edge up to fold it; no duplicates', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  await settle(page);
  const grip = page.getByTestId('links-expand');
  const panel = page.getByTestId('links-panel');
  const shown = () => panel.evaluate((el) => 1 - parseFloat(getComputedStyle(el).clipPath.match(/inset\(\S+ \S+ ([\d.]+)%/)![1]) / 100);

  // drag down: the panel follows the pointer, then springs fully open
  const g = (await grip.boundingBox())!;
  await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
  await page.mouse.down();
  await page.mouse.move(g.x + g.width / 2, g.y + 50, { steps: 5 });
  const part = await shown();
  expect(part).toBeGreaterThan(0.05);
  expect(part).toBeLessThan(0.9); // mid-drag: partly unrolled, tracking the pointer
  await page.mouse.move(g.x + g.width / 2, g.y + 160, { steps: 5 });
  await page.mouse.up();
  await expect.poll(shown).toBeGreaterThan(0.99);

  // the bar keeps only the fixed sites; the panel has the rest, none twice
  await expect(page.locator('[data-strip="scroll"]')).toHaveCount(0);
  const bar = await page.getByTestId('links-strip').locator('[data-chip]').allTextContents();
  const inPanel = await panel.locator('[data-chip]').allTextContents();
  expect(inPanel.length).toBeGreaterThan(0);
  expect(inPanel.length).toBeLessThanOrEqual(15);
  for (const name of bar) expect(inPanel.some((t) => t.startsWith(name.trim()))).toBe(false);

  // dragging inside the panel does nothing; dragging its bottom edge up folds it
  const chip = (await panel.locator('[data-chip]').first().boundingBox())!;
  await page.mouse.move(chip.x + 5, chip.y + chip.height + 2);
  await page.mouse.down();
  await page.mouse.move(chip.x + 5, chip.y - 120, { steps: 5 });
  await page.mouse.up();
  await expect.poll(shown).toBeGreaterThan(0.99);
  const e = (await page.getByTestId('links-panel-edge').boundingBox())!;
  await page.mouse.move(e.x + e.width / 2, e.y + e.height / 2);
  await page.mouse.down();
  await page.mouse.move(e.x + e.width / 2, e.y - 160, { steps: 6 });
  await page.mouse.up();
  await expect(panel).toHaveCount(0);
  await expect(page.locator('[data-strip="scroll"]')).toHaveCount(1);

  // a click on the grip opens it too
  await grip.click();
  await expect.poll(shown).toBeGreaterThan(0.99);
});

test('quick-links panel: scroll down on the grip opens it, scrolling inside it folds it', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  await settle(page);
  const g = (await page.getByTestId('links-expand').boundingBox())!;
  await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
  await page.mouse.wheel(0, 120);
  const panel = page.getByTestId('links-panel');
  await expect(panel).toBeVisible();
  await expect.poll(() => panel.evaluate((el) => getComputedStyle(el).clipPath)).toMatch(/inset\(0px 0px 0%|inset\(0px\)|none/);
  const p = (await panel.boundingBox())!;
  await page.mouse.move(p.x + p.width / 2, p.y + p.height / 2);
  await page.mouse.wheel(0, 80);
  await expect(panel).toHaveCount(0);
});

test('quick-links panel: scrolling on the bar (but not on a link) opens it', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  await settle(page);
  const bar = (await page.getByTestId('links-strip').boundingBox())!;
  // over a link: nothing opens
  const chip = (await page.getByTestId('links-strip').locator('[data-chip]').first().boundingBox())!;
  await page.mouse.move(chip.x + chip.width / 2, chip.y + chip.height / 2);
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(300);
  await expect(page.getByTestId('links-panel')).toHaveCount(0);
  // the bar's own padding: opens
  await page.mouse.move(bar.x + 5, bar.y + bar.height / 2);
  await page.mouse.wheel(0, 120);
  await expect(page.getByTestId('links-panel')).toBeVisible();
  // any scroll inside the panel folds it
  const p = (await page.getByTestId('links-panel').boundingBox())!;
  await page.mouse.move(p.x + p.width / 2, p.y + p.height / 2);
  await page.mouse.wheel(0, -60);
  await expect(page.getByTestId('links-panel')).toHaveCount(0);
});

test('alert floods stay calm: ×N repeats, one group card, held while a panel is open, Clear all on top', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  await settle(page);
  const push = (alerts: Array<{ key: string; kind: string; title: string; itemId?: string }>) =>
    page.evaluate(async (list) => {
      // the very module instance the page uses (the dev server may version its URL)
      const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/alertStore.ts')) ?? '/src/components/ui/alertStore.ts';
      const m = await import(/* @vite-ignore */ url);
      for (const a of list) m.pushAlert(a as never, true);
    }, alerts);

  // the same site three times: one card, ×3
  await push([1, 2, 3].map((n) => ({ key: `processing:kotlin:${n}`, kind: 'processing', title: 'Kotlin', itemId: 'kotlin' })));
  await expect(page.getByRole('alert')).toHaveCount(1);
  await expect(page.getByTestId('alert-repeat')).toHaveText('×3');

  // two more sites: three reminders up → one group card that opens into the list
  await push([
    { key: 'queue:grafana:1', kind: 'queue', title: 'Grafana', itemId: 'grafana' },
    { key: 'queue:bitbucket:1', kind: 'queue', title: 'Bitbucket', itemId: 'bitbucket' },
  ]);
  const group = page.getByTestId('alert-group');
  await expect(group).toContainText('3 reminders now');
  await group.getByRole('button', { name: 'Show' }).click();
  await expect(group.getByRole('list', { name: 'Reminders' }).getByRole('listitem')).toHaveCount(3);

  // Clear all sits above the cards
  const clear = page.getByTestId('alerts-clear-all');
  expect((await clear.boundingBox())!.y).toBeLessThan((await group.boundingBox())!.y);

  // a panel opens: the stack waits behind the bell; the bell shows it again
  await page.getByTitle(/Add\/remove sites in the queue/).click();
  await expect(page.getByTestId('alerts-waiting')).toContainText('3 reminders waiting');
  await expect(page.getByTestId('alert-group')).toHaveCount(0);
  await page.getByTestId('alerts-waiting').click();
  await expect(page.getByTestId('alert-group')).toBeVisible();
  await page.getByTestId('alerts-clear-all').click();
  await expect(page.getByTestId('alert-group')).toHaveCount(0);
});

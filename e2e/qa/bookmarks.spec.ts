import { chromium, expect, test, type Page } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// Browser bookmarks panel + Tree View, inside the built extension (chrome.bookmarks
// only exists there). Run `npm run build` first. A fuller visual walk-through
// with screenshots lives in e2e/qa/bookmarks.manual.mjs.

test.use({ video: 'off', trace: 'off' });

declare const chrome: {
  bookmarks: {
    create(b: { parentId?: string; title: string; url?: string }): Promise<{ id: string }>;
    search(q: { title: string }): Promise<Array<{ parentId?: string }>>;
    get(id: string): Promise<Array<{ title: string }>>;
  };
};

const parentOf = (p: Page, title: string) =>
  p.evaluate(async (t) => {
    const [n] = await chrome.bookmarks.search({ title: t });
    if (!n?.parentId) return null;
    return (await chrome.bookmarks.get(n.parentId))[0].title;
  }, title);

test('bookmarks: live panel, folder actions, Tree View drag — no console errors', async () => {
  test.setTimeout(90_000);
  const dist = resolve('dist');
  const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'devdeck-bm-')), {
    channel: 'chromium',
    headless: true,
    viewport: { width: 1600, height: 950 },
    args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
  });
  try {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    const id = new URL(worker.url()).host;
    const p = await context.newPage();
    const errors: string[] = [];
    p.on('pageerror', (e) => errors.push(e.message));
    p.on('console', (m) => m.type() === 'error' && !/favicon|Failed to load resource|ERR_|net::/i.test(m.text()) && errors.push(m.text()));
    await p.goto(`chrome-extension://${id}/index.html`);
    await p.locator('[data-category-id]').first().waitFor({ timeout: 15_000 });
    await p.evaluate(async () => {
      const b = chrome.bookmarks;
      const work = await b.create({ parentId: '1', title: 'Work' });
      const fe = await b.create({ parentId: work.id, title: 'Frontend' });
      await b.create({ parentId: fe.id, title: 'React', url: 'https://react.dev' });
      const be = await b.create({ parentId: work.id, title: 'Backend' });
      await b.create({ parentId: be.id, title: 'Deno', url: 'https://deno.com' });
      await b.create({ parentId: '1', title: 'Reading' });
    });

    await p.getByRole('button', { name: 'Browser bookmarks' }).click();
    const panel = p.getByRole('dialog', { name: 'Browser bookmarks' });
    await expect(panel.getByText('Work', { exact: true })).toBeVisible();

    // + sub folder (left of Edit), rename, live external change
    await panel.getByRole('button', { name: 'Expand Work' }).click();
    const row = panel.locator('.bm-row', { has: p.getByRole('button', { name: /(Expand|Collapse) Backend/ }) }).first();
    await row.hover();
    await expect(row.getByRole('button', { name: 'Add sub folder to Backend' })).toHaveAttribute('title', 'Add sub folder');
    await row.getByRole('button', { name: 'Add sub folder to Backend' }).click();
    await panel.getByLabel('Sub folder name').fill('APIs');
    await panel.getByLabel('Sub folder name').press('Enter');
    await expect.poll(() => parentOf(p, 'APIs')).toBe('Backend');

    // delete a non-empty folder: confirm, then Undo brings it back
    await row.hover();
    await row.getByRole('button', { name: 'Delete Backend' }).click();
    await panel.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await expect.poll(() => parentOf(p, 'Deno')).toBeNull();
    await p.getByTestId('undo-bar').getByRole('button', { name: 'Undo' }).click();
    await expect.poll(() => parentOf(p, 'Deno')).toBe('Backend');

    // Tree View: drag a site and a folder with the real mouse
    await panel.getByRole('button', { name: 'Tree View' }).click();
    const tv = p.getByRole('dialog', { name: 'Bookmarks tree view' });
    await tv.getByRole('button', { name: 'Expand all' }).click();
    await tv.getByRole('button', { name: 'Fit' }).click();
    const box = (t: string) => tv.locator('.bm-box', { has: p.locator('span', { hasText: new RegExp(`^${t}$`) }) }).first();
    const drag = async (from: ReturnType<Page['locator']>, to: ReturnType<Page['locator']>) => {
      const a = (await from.boundingBox())!;
      const z = (await to.boundingBox())!;
      await p.mouse.move(a.x + a.width / 2, a.y + Math.min(a.height / 2, 18));
      await p.mouse.down();
      await p.mouse.move(z.x + z.width / 2, z.y + 18, { steps: 14 });
      await p.mouse.up();
    };
    await drag(tv.locator('.bm-site', { hasText: 'Deno' }), box('Reading'));
    await expect.poll(() => parentOf(p, 'Deno')).toBe('Reading');
    await drag(box('Frontend').locator('[data-bm-item]').first(), box('Reading'));
    await expect.poll(() => parentOf(p, 'Frontend')).toBe('Reading');
    // a folder can't go into its own sub folder
    await drag(box('Work').locator('[data-bm-item]').first(), box('APIs'));
    await expect.poll(() => parentOf(p, 'Work')).toBe('Bookmarks bar');

    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

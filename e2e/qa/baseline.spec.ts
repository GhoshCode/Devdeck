import { expect, test } from '@playwright/test';
import { contrastAudit, measureFrames, measureLoad, report, seedDeck, step, watchConsole } from './qa';

// Baseline manual-QA pass over v7.0, so every upcoming UI change can be
// compared against it. Metrics are recorded; only hard breakage fails a test.

test.describe.configure({ mode: 'serial' });

test('loading — every component appears, no layout jumps, no console errors', async ({ page }, info) => {
  const errors = watchConsole(page);
  const load = await measureLoad(page, '/', {
    clock: '[role="timer"]',
    weather: '[data-testid="weather-uv"]',
    todo: '[data-testid="todo-widget"]',
    git: '[data-testid="git-widget"]',
    search: '[role="combobox"][aria-label="Search"]',
    linksStrip: '[data-testid="links-strip"]',
    firstCard: '[data-category-id]',
    processing: '[aria-label="Processing: Currently processing"]',
    news: '[aria-label="Tech news"] [data-feed-item]',
  });
  await step(page, info, 'page fully loaded', async () => {});
  await report(info, 'load', load);
  expect(Object.values(load.componentsMs)).not.toContain('missing');
  expect(errors, errors.join('\n')).toEqual([]);
});

for (const theme of ['dark', 'light'] as const) {
  test(`${theme} — settings tabs switch smoothly`, async ({ page }, info) => {
    await seedDeck(page, { theme });
    await step(page, info, 'dashboard', async () => {});
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const modal = page.getByRole('dialog', { name: 'DevDeck Settings' });
    await expect(modal).toBeVisible();

    const results: Record<string, unknown> = {};
    for (const tab of ['Library', 'Sitemap', 'Quick Links', 'Appearance', 'Profile', 'Processing', 'Scraping', 'Data']) {
      const stats = await measureFrames(page, () => modal.getByRole('button', { name: new RegExp(tab) }).first().click());
      results[tab] = stats;
      await step(page, info, `settings tab ${tab}`, async () => {});
    }
    await report(info, 'tab switching', results);
  });

  test(`${theme} — scrolling cards, links and feeds`, async ({ page }, info) => {
    await seedDeck(page, { theme });
    const row = page.getByRole('region', { name: 'Scrollable category cards' });
    const box = (await row.boundingBox())!;

    const cardRow = await measureFrames(page, async () => {
      await page.mouse.move(box.x + box.width / 2, box.y + 8);
      for (let i = 0; i < 12; i++) {
        await page.mouse.wheel(0, 160);
        await page.waitForTimeout(40);
      }
    });
    await step(page, info, 'card row scrolled', async () => {});

    const strip = page.locator('[data-strip-scroller]');
    const sBox = (await strip.boundingBox())!;
    const links = await measureFrames(page, async () => {
      await page.mouse.move(sBox.x + sBox.width / 2, sBox.y + sBox.height / 2);
      for (let i = 0; i < 8; i++) {
        await page.mouse.wheel(0, 120);
        await page.waitForTimeout(40);
      }
    });
    await step(page, info, 'links strip scrolled', async () => {});

    const card = page.locator('[data-category-id]').first();
    const cBox = (await card.boundingBox())!;
    const inside = await measureFrames(page, async () => {
      await page.mouse.move(cBox.x + cBox.width / 2, cBox.y + cBox.height * 0.75);
      for (let i = 0; i < 8; i++) {
        await page.mouse.wheel(0, 120);
        await page.waitForTimeout(40);
      }
    });
    await step(page, info, 'inside a card scrolled', async () => {});
    await report(info, 'scrolling', { cardRow, links, inside });
  });

  test(`${theme} — colour contrast (WCAG AA)`, async ({ page }, info) => {
    await seedDeck(page, { theme });
    await page.waitForTimeout(1500);
    await step(page, info, 'audited view', async () => {});
    const issues = await contrastAudit(page);
    await report(info, 'contrast', { violations: issues.length, issues: issues.slice(0, 40) });
  });
}

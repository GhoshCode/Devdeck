import { chromium, expect, test } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// The built extension must keep the console spotless while browsing:
// no errors, no warnings and no failed requests (e.g. missing favicons).
// Run `npm run build` first.

test.use({ video: 'off', trace: 'off' });

test('console stays clean: subcategory chips on every card, Site Map open/scroll', async () => {
  test.setTimeout(120_000);
  const dist = resolve('dist');
  const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'devdeck-console-')), {
    channel: 'chromium',
    headless: true,
    viewport: { width: 1920, height: 1000 },
    args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
  });
  try {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    const id = new URL(worker.url()).host;
    const p = await context.newPage();
    const issues: string[] = [];
    p.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && issues.push(`[${m.type()}] ${m.text()}`));
    p.on('pageerror', (e) => issues.push(`[pageerror] ${e.message}`));
    p.on('response', (r) => r.status() >= 400 && issues.push(`[http ${r.status()}] ${r.url()}`));
    await p.goto(`chrome-extension://${id}/index.html`);
    await p.locator('[data-category-id]').first().waitFor({ timeout: 15_000 });

    const dots = p.getByTestId('cards-pager').getByRole('tab');
    const pages = await dots.count();
    for (let pg = 0; pg < pages; pg++) {
      await dots.nth(pg).click();
      await p.waitForTimeout(450);
      const cards = p.locator('[data-category-id]');
      for (let c = 0; c < (await cards.count()); c++) {
        const card = cards.nth(c);
        if (!(await card.isVisible())) continue;
        const pills = card.locator('button').filter({ hasText: /\s\d+$/ });
        const n = Math.min(await pills.count(), 8);
        for (let i = 0; i < n; i++) await pills.nth(i).click({ timeout: 1500 }).catch(() => {});
      }
    }

    for (let i = 0; i < 2; i++) {
      await p.getByRole('button', { name: 'Site Map & Hierarchy' }).click();
      const map = p.getByRole('dialog', { name: 'Site Map & Hierarchy' });
      await map.waitFor();
      for (let k = 0; k < 6; k++) {
        await p.mouse.move(960, 600);
        await p.mouse.wheel(0, 900);
        await p.waitForTimeout(200);
      }
      await p.keyboard.press('Escape');
      await map.waitFor({ state: 'hidden' });
    }
    await p.waitForTimeout(800);
    expect(issues).toEqual([]);
  } finally {
    await context.close();
  }
});

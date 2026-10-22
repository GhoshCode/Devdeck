import { chromium, expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Chrome Web Store readiness: load the built dist/ as an unpacked MV3
// extension in Chromium and check what reviewers and users will hit first.
// Run `npm run build` before this spec.

test.use({ video: 'off', trace: 'off' });

test('built extension — new tab, service worker, reminders, no console errors', async () => {
  const dist = resolve('dist');
  const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'devdeck-ext-')), {
    channel: 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
  });
  try {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    const extensionId = new URL(worker.url()).host;
    expect(worker.url()).toMatch(/background\.js$/);

    // New-tab override serves DevDeck.
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/favicon|404|ERR_NAME_NOT_RESOLVED|Failed to load resource/i.test(m.text())) errors.push(m.text());
    });
    await page.goto(`chrome-extension://${extensionId}/index.html`);
    await page.locator('[data-category-id]').first().waitFor({ timeout: 15_000 });
    expect(await page.evaluate(() => typeof (globalThis as { chrome?: { runtime?: { id?: string } } }).chrome?.runtime?.id)).toBe('string');

    // A scheduled processing item is mirrored to chrome.storage and becomes an alarm.
    await page.getByRole('button', { name: 'Manage currently processing' }).click();
    const dialog = page.getByRole('dialog', { name: 'Manage currently processing' });
    await dialog.getByRole('tab', { name: 'From your sites' }).click();
    await dialog.getByRole('textbox', { name: 'Add a site to Currently Processing' }).fill('github');
    await dialog.getByRole('textbox', { name: 'Add a site to Currently Processing' }).press('Enter');
    const card = dialog.locator('li[data-processing-id]').first(); // the added site (the add side has the same controls)
    await card.getByRole('radio', { name: 'Hourly' }).click();
    for (const day of ['Su', 'Sa']) {
      const btn = card.getByRole('button', { name: day, exact: true });
      if ((await btn.getAttribute('aria-pressed')) === 'false') await btn.click();
    }
    await expect
      .poll(() => worker.evaluate(async () => (await chrome.alarms.getAll()).map((a) => a.name)), { timeout: 10_000 })
      .toEqual([expect.stringMatching(/^devdeck:/)]);

    await page.screenshot({ path: 'qa-artifacts/extension-new-tab.png' });
    expect(errors, errors.join('\n')).toEqual([]);
  } finally {
    await context.close();
  }
});

declare const chrome: { alarms: { getAll(): Promise<Array<{ name: string }>> } };

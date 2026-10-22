import { test, expect } from '@playwright/test';

// G1 browser-bookmarks button (website behaviour) and the E/F links strip.

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('[data-category-id]').first().waitFor({ state: 'visible' });
});

test.describe('G1 browser bookmarks panel', () => {
  // The browser's bookmarks need the extension (chrome.bookmarks); the full
  // panel + Tree View behaviour is covered in e2e/qa/bookmarks.spec.ts.
  test('on the website it explains that bookmarks need the extension; Esc closes', async ({ page }) => {
    await page.getByRole('button', { name: 'Browser bookmarks' }).click();
    const panel = page.getByRole('dialog', { name: 'Browser bookmarks' });
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('Browser bookmarks need the DevDeck extension');
    await expect(panel.getByRole('button', { name: 'Tree View' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
  });
});

test.describe('Links strip (E/F)', () => {
  test('quick links and recent chips share one scroller and never overlap', async ({ page }) => {
    const strip = page.getByTestId('links-strip');
    const fixed = strip.locator('[data-chip=fixed]');
    await expect(fixed).toHaveCount(4);
    await expect(fixed.first()).toHaveText('Mail');

    // every chip sits after the one before it (no overlap, no cut-off fixed chips)
    const xs = await strip.locator('[data-chip]').evaluateAll((els) => els.map((e) => [e.getBoundingClientRect().left, e.getBoundingClientRect().right]));
    for (let i = 1; i < xs.length; i++) expect(xs[i][0]).toBeGreaterThanOrEqual(xs[i - 1][1]);

    const before = (await fixed.first().boundingBox())!.x;
    const scroller = strip.locator('[data-strip=scroll]');
    await scroller.evaluate((el) => (el.scrollLeft = 400));
    await expect.poll(() => scroller.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
    expect((await fixed.first().boundingBox())!.x).toBeLessThan(before); // everything scrolls together
  });

  test('opening a site puts it at the head of the Recent strip', async ({ page }) => {
    // Stub the destination so following the link stays offline.
    await page.context().route('https://redis.io/**', (route) => route.fulfill({ body: 'redis' }));
    await page.getByRole('button', { name: 'Site Map & Hierarchy' }).click();
    const map = page.getByRole('dialog', { name: 'Site Map & Hierarchy' });
    await map.getByRole('combobox', { name: 'Search the site map' }).fill('redis');
    // DevDeck stays put; the site opens in a new tab.
    const [tab] = await Promise.all([page.waitForEvent('popup'), map.getByRole('combobox', { name: 'Search the site map' }).press('Enter')]);
    await tab.waitForURL(/redis\.io/);
    await tab.close();

    await page.goto('/');
    const recent = page.getByTestId('links-strip').locator('[data-chip=recent]');
    await expect(recent.first()).toContainText('Redis');
  });
});

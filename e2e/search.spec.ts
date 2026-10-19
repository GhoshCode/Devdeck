import { test, expect } from '@playwright/test';

// v2 Phase 2: G1 bookmarks drawer (site map) and the E/F links strip.

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('[data-category-id]').first().waitFor({ state: 'visible' });
});

test.describe('G1 bookmarks drawer', () => {
  test('opens, filters across nested folders, and closes with Escape', async ({ page }) => {
    await page.getByRole('button', { name: 'Bookmarks and site map' }).click();
    const drawer = page.getByRole('dialog', { name: 'Bookmarks and site map' });
    await expect(drawer).toBeVisible();

    await drawer.getByRole('textbox', { name: 'Filter bookmarks' }).fill('postgres');
    await expect(drawer.getByRole('treeitem', { name: 'PostgreSQL' })).toBeVisible();
    await expect(drawer.getByRole('treeitem', { name: 'Frontend' })).toHaveCount(0);

    await page.keyboard.press('Escape');
    await expect(drawer).toHaveCount(0);
  });

  test('adds, renames and deletes a folder', async ({ page }) => {
    await page.getByRole('button', { name: 'Bookmarks and site map' }).click();
    const drawer = page.getByRole('dialog', { name: 'Bookmarks and site map' });

    await drawer.getByRole('button', { name: '+ Folder' }).click();
    await drawer.getByRole('textbox', { name: 'New folder name' }).fill('Scratch');
    await page.keyboard.press('Enter');
    const folder = drawer.getByRole('treeitem', { name: 'Scratch' });
    await expect(folder).toBeVisible();

    await folder.hover();
    await folder.getByRole('button', { name: 'Rename Scratch' }).click();
    await folder.getByRole('textbox').fill('Playground');
    await page.keyboard.press('Enter');
    const renamed = drawer.getByRole('treeitem', { name: 'Playground' });
    await expect(renamed).toBeVisible();

    await renamed.hover();
    await renamed.getByRole('button', { name: 'Delete Playground' }).click();
    await renamed.getByRole('alert').getByRole('button', { name: 'Delete' }).click();
    await expect(drawer.getByRole('treeitem', { name: 'Playground' })).toHaveCount(0);
  });

  test('dragging a site onto a folder moves it there', async ({ page }) => {
    await page.getByRole('button', { name: 'Bookmarks and site map' }).click();
    const drawer = page.getByRole('dialog', { name: 'Bookmarks and site map' });
    await drawer.getByRole('textbox', { name: 'Filter bookmarks' }).fill('remix');

    const leaf = drawer.locator('[data-site-leaf]').filter({ hasText: 'Remix' }).locator('a');
    const target = drawer.locator('[data-folder-id]').first().locator(':scope > div');
    const [from, to] = [await leaf.boundingBox(), await target.boundingBox()];
    await page.mouse.move(from!.x + 30, from!.y + from!.height / 2);
    await page.mouse.down();
    await page.mouse.move(from!.x + 40, from!.y - 10, { steps: 5 });
    await page.mouse.move(to!.x + 100, to!.y + to!.height / 2, { steps: 10 });
    await page.mouse.up();

    const remix = await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('devdeck')!).state;
      return state.sites.find((s: { name: string }) => s.name === 'Remix');
    });
    expect(remix.subcategoryId).toBeNull(); // moved from Frameworks to the folder's General group
  });
});

test.describe('Links strip (E/F)', () => {
  test('first 4 quick links are fixed and do not scroll', async ({ page }) => {
    const strip = page.getByTestId('links-strip');
    const fixed = strip.locator('[data-chip=fixed]');
    await expect(fixed).toHaveCount(4);
    await expect(fixed.first()).toHaveText('Mail');

    const before = await fixed.first().boundingBox();
    await strip.locator('[data-strip=scroll]').evaluate((el) => (el.scrollLeft = 400));
    const after = await fixed.first().boundingBox();
    expect(after!.x).toBe(before!.x);
  });

  test('opening a site puts it at the head of the Recent strip', async ({ page }) => {
    // Stub the destination so following the link stays offline.
    await page.context().route('https://redis.io/**', (route) => route.fulfill({ body: 'redis' }));
    await page.getByRole('button', { name: 'Bookmarks and site map' }).click();
    const drawer = page.getByRole('dialog', { name: 'Bookmarks and site map' });
    await drawer.getByRole('textbox', { name: 'Filter bookmarks' }).fill('redis');
    // DevDeck stays put; the site opens in a new tab.
    const [tab] = await Promise.all([page.waitForEvent('popup'), drawer.getByRole('treeitem', { name: 'Redis' }).getByRole('link').click()]);
    await tab.waitForURL(/redis\.io/);
    await tab.close();

    await page.goto('/');
    const recent = page.getByTestId('links-strip').locator('[data-chip=recent]');
    await expect(recent.first()).toContainText('Redis');
  });
});

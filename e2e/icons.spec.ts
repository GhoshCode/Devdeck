import { test, expect } from '@playwright/test';

test.describe('Icons & Favicons Visibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Clear storage and start fresh with seed data
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.locator('[data-category-id]').first().waitFor({ state: 'visible' });
  });

  test('Quick links render visible favicons', async ({ page }) => {
    // Quick links row contains 4 seed links
    const quickLinks = page.locator('[data-testid=links-strip] [data-chip=fixed]');
    await expect(quickLinks).toHaveCount(4);

    // Each quick link must contain either an <img> favicon or fallback initial badge
    for (let i = 0; i < 4; i++) {
      const link = quickLinks.nth(i);
      const icon = link.locator('img, div[aria-hidden="true"]');
      await expect(icon).toBeVisible();

      // Check the icon has non-zero size
      const box = await icon.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThan(0);
      expect(box!.height).toBeGreaterThan(0);
    }
  });

  test('Primary row site tiles render visible favicons', async ({ page }) => {
    // Primary row site tiles in CategoryCard
    const primaryTiles = page.locator('[aria-label="Primary sites rail"] a');
    const tileCount = await primaryTiles.count();
    expect(tileCount).toBeGreaterThan(0);

    // Verify first 3 primary tiles have visible icons
    for (let i = 0; i < Math.min(tileCount, 3); i++) {
      const tile = primaryTiles.nth(i);
      const icon = tile.locator('img, div[aria-hidden="true"]');
      await expect(icon).toBeVisible();

      const box = await icon.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThan(0);
      expect(box!.height).toBeGreaterThan(0);
    }
  });

  test('Site rows in subcategory cards render visible favicons', async ({ page }) => {
    // Site rows across categories
    const siteRows = page.locator('[data-site-id]');
    const count = await siteRows.count();
    expect(count).toBeGreaterThan(0);

    // Check first 5 site rows have visible icons
    for (let i = 0; i < Math.min(count, 5); i++) {
      const row = siteRows.nth(i);
      const icon = row.locator('img, div[aria-hidden="true"]').first();
      await expect(icon).toBeVisible();

      const box = await icon.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThan(0);
      expect(box!.height).toBeGreaterThan(0);
    }
  });

  test('Fallback avatar renders when favicon image fails to load', async ({ page }) => {
    // Block Google favicon service to simulate offline / broken favicon
    await page.route('**google.com/s2/favicons**', (route) => route.abort());

    // Reload with blocked favicons
    await page.reload();
    await page.locator('[data-category-id]').first().waitFor({ state: 'visible' });

    // When the image fails, Favicon renders a fallback div badge with initial letter
    // Find all fallback avatars
    const fallbackBadges = page.locator('[data-favicon-fallback]');
    await expect(fallbackBadges.first()).toBeVisible();

    const firstBadgeText = await fallbackBadges.first().textContent();
    expect(firstBadgeText?.trim().length).toBeGreaterThan(0);
  });

  test('Floating controls display SVG search and settings icons', async ({ page }) => {
    // Search button icon
    const searchBtn = page.getByRole('button', { name: 'Search the web' });
    await expect(searchBtn).toBeVisible();
    const searchSvg = searchBtn.locator('svg');
    await expect(searchSvg).toBeVisible();

    // Settings button icon
    const settingsBtn = page.getByRole('button', { name: 'Settings' });
    await expect(settingsBtn).toBeVisible();
    const settingsSvg = settingsBtn.locator('svg');
    await expect(settingsSvg).toBeVisible();
  });

  test('Extension manifest icon files are accessible', async ({ page }) => {
    // Check that icon files referenced in manifest.json respond with HTTP 200
    const iconUrls = [
      '/icons/icon-16.png',
      '/icons/icon-48.png',
      '/icons/icon-128.png',
    ];

    for (const iconPath of iconUrls) {
      const response = await page.request.get(iconPath);
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain('image/png');
    }
  });
});

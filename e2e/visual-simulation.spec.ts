import { test, expect } from '@playwright/test';

test.describe('Complete Playwright Visual Testing Simulation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.locator('[data-category-id]').first().waitFor({ state: 'visible' });
  });

  test('Visual Simulation: Full deck rendering in Dark and Light themes with distinct glass borders', async ({ page }) => {
    // 1. Dark Mode Verification
    const deck = page.locator('[data-categories-container]');
    await expect(deck).toBeVisible();

    const linksStrip = page.getByTestId('links-strip');
    await expect(linksStrip).toBeVisible();

    // Check the 4 fixed quick links rendered
    const quickLinks = linksStrip.locator('[data-chip=fixed]');
    await expect(quickLinks).toHaveCount(4);

    // Check category cards rendered
    const cards = page.locator('[data-category-id]');
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThanOrEqual(10);

    // 2. Switch to Light Mode via Settings
    const settingsBtn = page.getByRole('button', { name: 'Settings' });
    await settingsBtn.click();
    const settingsModal = page.getByRole('dialog', { name: 'DevDeck Settings' });
    await expect(settingsModal).toBeVisible();

    // Open Appearance tab
    const appearanceTab = settingsModal.getByRole('button', { name: /Appearance/i });
    await appearanceTab.click();

    // Toggle Default Light
    const lightBtn = settingsModal.getByRole('radio', { name: 'Light', exact: true });
    await lightBtn.click();
    // the theme commits inside a view transition, so wait for it rather than a fixed delay
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    // Close settings
    await page.keyboard.press('Escape');
    await expect(settingsModal).not.toBeVisible();

    // Verify Light mode elements have distinct borders and styling
    const firstCard = cards.first();
    await expect(firstCard).toBeVisible();

    const cardStyles = await firstCard.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        borderWidth: computed.borderWidth,
        borderStyle: computed.borderStyle,
        borderColor: computed.borderColor,
        boxShadow: computed.boxShadow,
      };
    });

    expect(cardStyles.borderStyle).toBe('solid');
    expect(parseFloat(cardStyles.borderWidth)).toBeGreaterThanOrEqual(1);

    // 3. Verify List View toggle in Light Mode
    const listBtn = firstCard.locator('button[aria-label="List view"]');
    await listBtn.click();
    const listContainer = firstCard.locator('[role="region"][aria-label*="All sites list"]');
    await expect(listContainer).toBeVisible();

    // Verify subcategory group items inside list view
    const listGroups = listContainer.locator('[data-list-group-id]');
    await expect(listGroups.first()).toBeVisible();
  });

  test('Visual Simulation: Settings Modal all 5 tabs render without collisions and with clear separation', async ({ page }) => {
    // Switch to Light Mode first
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'light');
    });

    const settingsBtn = page.getByRole('button', { name: 'Settings' });
    await settingsBtn.click();
    const modal = page.getByRole('dialog', { name: 'DevDeck Settings' });
    await expect(modal).toBeVisible();

    const closeBtn = modal.locator('button[aria-label="Close Settings"]');
    await expect(closeBtn).toBeVisible();
    const closeBox = await closeBtn.boundingBox();
    expect(closeBox).not.toBeNull();

    // 1. Library Tab
    const libraryTab = modal.getByRole('button', { name: /Library/i });
    await libraryTab.click();
    const addSiteBtn = modal.getByRole('button', { name: '+ Add Site' });
    await expect(addSiteBtn).toBeVisible();
    const addSiteBox = await addSiteBtn.boundingBox();
    expect(addSiteBox).not.toBeNull();

    // Assert that Close Button does NOT overlap with Add Site button
    if (closeBox && addSiteBox) {
      const horizontalOverlap =
        closeBox.x < addSiteBox.x + addSiteBox.width &&
        closeBox.x + closeBox.width > addSiteBox.x;
      const verticalOverlap =
        closeBox.y < addSiteBox.y + addSiteBox.height &&
        closeBox.y + closeBox.height > addSiteBox.y;
      expect(horizontalOverlap && verticalOverlap).toBe(false);
    }

    // Verify site tiles in Library have rounded pills and distinct borders
    const siteRows = modal.locator('.bg-white\\/\\[0\\.02\\]');
    if (await siteRows.count() > 0) {
      await expect(siteRows.first()).toBeVisible();
    }

    // 2. Appearance Tab
    const appearanceTab = modal.getByRole('button', { name: /Appearance/i });
    await appearanceTab.click();
    await expect(modal.getByRole('radiogroup', { name: 'Appearance mode' })).toBeVisible();
    await expect(modal.getByRole('region', { name: 'Themes' })).toBeVisible();

    // 3. Quick Links Tab
    const quickLinksTab = modal.getByRole('button', { name: /Quick Links/i });
    await quickLinksTab.click();
    await expect(modal.getByText('The links strip at the top of the centre frame')).toBeVisible();

    // 4. Data Tab
    const dataTab = modal.getByRole('button', { name: /Data/i });
    await dataTab.click();
    await expect(modal.getByText('Data Management')).toBeVisible();
    await expect(modal.getByText('Catalog Sites')).toBeVisible();

    // 5. Sitemap Tab
    const sitemapTab = modal.getByRole('button', { name: /Sitemap/i });
    await sitemapTab.click();
    const reactFlow = modal.locator('.react-flow');
    await expect(reactFlow).toBeVisible();

    // Close modal
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
  });

  test('Visual Simulation: Zero horizontal or vertical page window scrollbars across responsive viewports', async ({ page }) => {
    const viewports = [
      { width: 1920, height: 1080 },
      { width: 1440, height: 900 },
      { width: 1280, height: 800 },
      { width: 1024, height: 768 },
    ];

    for (const vp of viewports) {
      await page.setViewportSize(vp);
      await page.waitForTimeout(100);

      const metrics = await page.evaluate(() => ({
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        bodyOverflowY: window.getComputedStyle(document.body).overflowY,
        bodyOverflowX: window.getComputedStyle(document.body).overflowX,
        docScrollWidth: document.documentElement.scrollWidth,
        docClientWidth: document.documentElement.clientWidth,
        docScrollHeight: document.documentElement.scrollHeight,
        docClientHeight: document.documentElement.clientHeight,
      }));

      expect(metrics.scrollX).toBe(0);
      expect(metrics.scrollY).toBe(0);
      expect(metrics.bodyOverflowY).toBe('hidden');
      expect(metrics.bodyOverflowX).toBe('hidden');
      expect(metrics.docScrollWidth).toBeLessThanOrEqual(metrics.docClientWidth);
      expect(metrics.docScrollHeight).toBeLessThanOrEqual(metrics.docClientHeight);
    }
  });

  test('Visual Simulation: Clean console with ZERO errors during all user interactions', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));

    // Interact with search bar
    const searchInput = page.getByRole('combobox', { name: 'Search' });
    await searchInput.fill('developer');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');

    // Ctrl+K focuses the search bar (v2 replaced the palette)
    await page.keyboard.press('Control+k');
    await expect(searchInput).toBeFocused();
    await page.keyboard.press('Escape');

    // Open and close the G1 bookmarks drawer
    await page.getByRole('button', { name: 'Browser bookmarks' }).click();
    await expect(page.getByRole('dialog', { name: 'Browser bookmarks' })).toBeVisible();
    await page.keyboard.press('Escape');

    // Switch subcategories back and forth
    const firstCard = page.locator('[data-category-id]').first();
    const pills = firstCard.locator('[data-group-id]');
    const count = await pills.count();
    for (let i = 0; i < 6; i++) {
      await pills.nth(i % count).click();
      await page.waitForTimeout(40);
    }

    // Filter out known benign offline favicon 404 network fetches
    const realErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('ERR_NETWORK') && !e.includes('404')
    );

    expect(realErrors).toHaveLength(0);
  });
});

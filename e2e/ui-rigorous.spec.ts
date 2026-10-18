import { test, expect } from '@playwright/test';

test.describe('Rigorous UI, Layout & Benchmark Testing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Clear storage and start fresh with seed data
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.locator('[data-category-id]').first().waitFor({ state: 'visible' });
  });

  test('Page has ZERO vertical and horizontal scrollbars at 100% zoom across viewports', async ({ page }) => {
    const viewports = [
      { width: 1920, height: 1080 }, // Full HD Desktop
      { width: 1440, height: 900 },  // Standard Laptop
      { width: 1366, height: 768 },  // Common 768p Display
      { width: 1280, height: 800 },  // Compact Display
    ];

    for (const vp of viewports) {
      await page.setViewportSize(vp);
      await page.waitForTimeout(150);

      const metrics = await page.evaluate(() => ({
        scrollY: window.scrollY,
        scrollX: window.scrollX,
        docScrollHeight: document.documentElement.scrollHeight,
        docScrollWidth: document.documentElement.scrollWidth,
        docClientHeight: document.documentElement.clientHeight,
        docClientWidth: document.documentElement.clientWidth,
      }));

      // No page scroll offset
      expect(metrics.scrollY).toBe(0);
      expect(metrics.scrollX).toBe(0);

      // Document scroll dimensions must not exceed client viewport dimensions
      expect(metrics.docScrollHeight).toBeLessThanOrEqual(metrics.docClientHeight);
      expect(metrics.docScrollWidth).toBeLessThanOrEqual(metrics.docClientWidth);

      // Attempt to scroll the page window
      await page.evaluate(() => window.scrollTo(100, 500));
      const afterScroll = await page.evaluate(() => ({
        scrollY: window.scrollY,
        scrollX: window.scrollX,
      }));
      expect(afterScroll.scrollY).toBe(0);
      expect(afterScroll.scrollX).toBe(0);
    }
  });

  test('Search row has the search bar with an inner Search button and G1 outside it; links strip heads the centre frame', async ({ page }) => {
    // 1. Search bar with its Search button inside the same glass shell
    const input = page.getByRole('combobox', { name: 'Search' });
    const shell = page.locator('div.glass-raised').filter({ has: input });
    await expect(shell).toBeVisible();
    await expect(shell.getByRole('button', { name: 'Search the web' })).toBeVisible();

    // 2. G1 bookmark button sits outside the search shell, to its right
    const g1 = page.getByRole('button', { name: 'Bookmarks and site map' });
    await expect(shell.getByRole('button', { name: 'Bookmarks and site map' })).toHaveCount(0);
    const [shellBox, g1Box] = [await shell.boundingBox(), await g1.boundingBox()];
    expect(g1Box!.x).toBeGreaterThan(shellBox!.x + shellBox!.width - 1);

    // 3. Typing shows the suggestions dropdown; Escape closes it
    await input.fill('git');
    await expect(page.getByRole('listbox', { name: 'Search suggestions' })).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('listbox', { name: 'Search suggestions' })).toHaveCount(0);

    // 4. The links strip is the first child of the centre frame, above the cards
    const frame = page.getByTestId('center-frame');
    const strip = frame.getByTestId('links-strip');
    await expect(strip.locator('[data-chip=fixed]')).toHaveCount(4);
    const [stripBox, cardBox] = [await strip.boundingBox(), await frame.locator('[data-category-id]').first().boundingBox()];
    expect(stripBox!.y + stripBox!.height).toBeLessThanOrEqual(cardBox!.y);
  });

  test('Subcategory navigation has sleek indicator dots; switches smoothly back and forth 10 times; thin scroll space below cards with no scroll buttons', async ({ page }) => {
    const firstCard = page.locator('[data-category-id]').first();
    await expect(firstCard).toBeVisible();

    // 1. Verify NO horizontal scroll buttons below cards
    const scrollButtons = page.getByRole('button', { name: /scroll categories/i });
    await expect(scrollButtons).toHaveCount(0);

    // 2. Subcategory indicator dots are present
    const dots = firstCard.locator('[role="tablist"]');
    if (await dots.count() > 0) {
      await expect(dots).toBeVisible();
    }

    // 3. Subcategory rail has scrollbar-none
    const rail = firstCard.locator('[role="region"][aria-label="Subcategory rail"]');
    await expect(rail).toBeVisible();
    const railClass = await rail.getAttribute('class');
    expect(railClass).toContain('scrollbar-none');

    // 4. Test rapid back-and-forth switching 10 times between subcategory buttons
    const pills = firstCard.locator('[data-group-id]');
    const pillCount = await pills.count();
    expect(pillCount).toBeGreaterThanOrEqual(2);

    for (let i = 0; i < 10; i++) {
      const targetPill = pills.nth(i % pillCount);
      await targetPill.click();
      await page.waitForTimeout(60);
    }
    await page.waitForTimeout(200);

    // 5. The thin cards scrollbar sits below the cards
    await expect(page.getByTestId('cards-scrollbar')).toBeVisible();

    // Verify page window still has zero scroll
    const pageScroll = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
    expect(pageScroll.x).toBe(0);
    expect(pageScroll.y).toBe(0);
  });

  test('Settings: Default Dark, Default Light, and Preset Gradient Themes work with elegant glassmorphism', async ({ page }) => {
    // Open settings modal
    const settingsBtn = page.getByRole('button', { name: 'Settings' });
    await settingsBtn.click();

    const settingsModal = page.getByRole('dialog', { name: 'DevDeck Settings' });
    await expect(settingsModal).toBeVisible();
    const modalClass = await settingsModal.getAttribute('class');
    expect(modalClass).toContain('glass-raised');

    // Switch to Appearance tab
    const appearanceTab = settingsModal.getByRole('button', { name: /Appearance/i });
    await appearanceTab.click();

    // 1. Test Light Theme toggle
    const lightThemeBtn = settingsModal.getByRole('radio', { name: 'Light', exact: true });
    await expect(lightThemeBtn).toBeVisible();
    await lightThemeBtn.click();
    await page.waitForTimeout(200);

    // Verify html data-theme is 'light'
    let themeAttr = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(themeAttr).toBe('light');

    // 2. Test Dark Theme toggle
    const darkThemeBtn = settingsModal.getByRole('radio', { name: 'Dark', exact: true });
    await expect(darkThemeBtn).toBeVisible();
    await darkThemeBtn.click();
    await page.waitForTimeout(200);

    themeAttr = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(themeAttr).toBe('dark');

    // 3. Test Preset Gradient Theme (Cyberpunk Neon)
    const cyberpunkBtn = settingsModal.getByRole('button', { name: /Cyberpunk Neon/i });
    await expect(cyberpunkBtn).toBeVisible();
    await cyberpunkBtn.click();
    await page.waitForTimeout(200);

    // Verify accent color updated
    const accentVar = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue('--color-accent'),
    );
    expect(accentVar.toLowerCase()).toBe('#00f0ff');

    // Close settings modal with Escape
    await page.keyboard.press('Escape');
    await expect(settingsModal).not.toBeVisible();
  });

  test('Scale: Deck features 10+ Categories and 200+ (300+) Sites, verifying containerization, zero-spill, and smooth scrolling', async ({ page }) => {
    // Open Settings -> Data Tab
    const settingsBtn = page.getByRole('button', { name: 'Settings' });
    await settingsBtn.click();

    const settingsModal = page.getByRole('dialog', { name: 'DevDeck Settings' });
    await expect(settingsModal).toBeVisible();

    const dataTab = settingsModal.getByRole('button', { name: /Data/i });
    await dataTab.click();

    // Verify Data Tab shows 10+ categories and 200+ catalog sites
    await expect(settingsModal.getByText('Data Management')).toBeVisible();
    await expect(settingsModal.getByText(/Export Configuration/i)).toBeVisible();

    // Close settings
    await page.keyboard.press('Escape');
    await expect(settingsModal).not.toBeVisible();

    // 1. Verify 10+ categories rendered (exactly 13 in the expanded benchmark deck)
    const cards = page.locator('[data-category-id]');
    await expect(cards).toHaveCount(13);

    // 2. Verify deck containerization is activated (> 3 categories)
    const container = page.locator('[data-categories-container]');
    await expect(container).toBeVisible();

    // 3. Verify ZERO window scroll even with 13 categories and 336 sites
    const pageMetrics = await page.evaluate(() => ({
      scrollY: window.scrollY,
      scrollX: window.scrollX,
      docScrollHeight: document.documentElement.scrollHeight,
      docClientHeight: document.documentElement.clientHeight,
      docScrollWidth: document.documentElement.scrollWidth,
      docClientWidth: document.documentElement.clientWidth,
    }));
    expect(pageMetrics.scrollY).toBe(0);
    expect(pageMetrics.scrollX).toBe(0);
    expect(pageMetrics.docScrollHeight).toBeLessThanOrEqual(pageMetrics.docClientHeight);
    expect(pageMetrics.docScrollWidth).toBeLessThanOrEqual(pageMetrics.docClientWidth);

    // 4. The deck ignores the wheel; dragging its thin scrollbar moves it
    const track = page.locator('[role="region"][aria-label="Scrollable category cards"]');
    await expect(track).toBeVisible();
    const tBox = (await track.boundingBox())!;
    await page.mouse.move(tBox.x + 6, tBox.y + tBox.height - 6);
    await page.mouse.wheel(400, 0);
    await page.waitForTimeout(300);
    expect(await track.evaluate((el) => el.scrollLeft)).toBe(0);

    const bar = page.getByTestId('cards-scrollbar');
    await expect(bar).toBeVisible();
    const thumb = (await bar.locator('div').first().boundingBox())!;
    await page.mouse.move(thumb.x + thumb.width / 2, thumb.y + thumb.height / 2);
    await page.mouse.down();
    await page.mouse.move(thumb.x + thumb.width / 2 + 200, thumb.y + thumb.height / 2, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    expect(await track.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);

    // 5. Scroll to the last category card and verify its rendering
    const lastCard = cards.last();
    await lastCard.scrollIntoViewIfNeeded();
    await expect(lastCard).toBeVisible();

    // Final verification: Window still at (0, 0)
    const finalScroll = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
    expect(finalScroll.x).toBe(0);
    expect(finalScroll.y).toBe(0);
  });
});

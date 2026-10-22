import { test, expect, type Page } from '@playwright/test';

// Settings → Appearance: Light / Dark / Auto with per-mode memory, accent
// palette (also inside the Sonoma skin), theme filters, Reduce transparency,
// clock faces and reset.

async function openAppearance(page: Page) {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'DevDeck Settings' });
  await modal.getByRole('button', { name: /Appearance/ }).click();
  return modal;
}

const html = (page: Page) => page.locator('html');
const accentVar = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim().toLowerCase());

// Theme changes run inside view transitions; under a busy full-suite run they
// need more than the default 30 s.
test.describe.configure({ timeout: 60_000 });

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('[data-category-id]').first().waitFor({ state: 'visible' });
});

test('each mode remembers its own theme', async ({ page }) => {
  const modal = await openAppearance(page);
  await expect(modal.getByTestId('appearance-preview')).toBeVisible();

  await modal.getByRole('button', { name: /Aurora Borealis/ }).click();
  await expect(html(page)).toHaveAttribute('data-theme', 'dark');
  await expect.poll(() => accentVar(page)).toBe('#10b981');

  await modal.getByRole('radio', { name: 'Light', exact: true }).click();
  await expect(html(page)).toHaveAttribute('data-theme', 'light');
  await expect(html(page)).toHaveAttribute('data-skin', 'sonoma');

  await modal.getByRole('radio', { name: 'Dark', exact: true }).click();
  await expect(html(page)).toHaveAttribute('data-theme', 'dark');
  await expect(modal.getByRole('button', { name: /Aurora Borealis/ })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => accentVar(page)).toBe('#10b981');
});

test('Auto follows the system setting live, and after a reload', async ({ page }) => {
  const modal = await openAppearance(page);
  await modal.getByRole('radio', { name: 'Auto', exact: true }).click();
  await expect(modal.getByRole('radio', { name: 'Auto', exact: true })).toHaveAttribute('aria-checked', 'true');
  await expect(html(page)).toHaveAttribute('data-theme', 'dark');
  // Wait for the choice to land (it commits inside a theme view transition).
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('devdeck') ?? '{}').state?.settings?.followSystem))
    .toBe(true);

  await page.emulateMedia({ colorScheme: 'light' });
  await expect(html(page)).toHaveAttribute('data-theme', 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(html(page)).toHaveAttribute('data-theme', 'dark');

  // First paint already matches the OS (public/theme-init.js).
  await page.emulateMedia({ colorScheme: 'light' });
  await page.reload();
  await expect(html(page)).toHaveAttribute('data-theme', 'light');
});

test('accent applies everywhere, including the Sonoma light skin', async ({ page }) => {
  const modal = await openAppearance(page);
  await modal.getByRole('radio', { name: 'Light', exact: true }).click();
  await expect(html(page)).toHaveAttribute('data-skin', 'sonoma');
  await modal.getByRole('radio', { name: 'Purple', exact: true }).click();
  await expect(modal.getByRole('radio', { name: 'Purple', exact: true })).toHaveAttribute('aria-checked', 'true');
  await expect.poll(() => accentVar(page)).toBe('#a550a7');

  // Low-contrast accents get a warning.
  await expect(modal.getByRole('note')).toHaveCount(0);
  await modal.getByRole('radio', { name: 'Yellow', exact: true }).click();
  await expect(modal.getByRole('note')).toContainText('hard to read');
});

test('theme filters and clock faces', async ({ page }) => {
  const modal = await openAppearance(page);
  const themes = modal.getByRole('region', { name: /Themes & wallpapers/ });
  const cards = themes.locator('.theme-card');
  await themes.getByRole('tab', { name: /^Jewel/ }).click();
  await expect(cards).toHaveCount(6);
  await themes.getByRole('tab', { name: /^All/ }).click();
  expect(await cards.count()).toBeGreaterThan(30);
  await themes.getByRole('searchbox', { name: 'Search themes' }).fill('nebula');
  await expect(cards).toHaveCount(1);

  await modal.getByRole('button', { name: 'Clock', exact: true }).click();
  await modal.getByRole('radio', { name: 'macOS Minimal' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('timer', { name: 'Digital clock' })).toHaveAttribute('data-clock-style', 'macos');
});

test('Reduce transparency survives a reload; reset restores the defaults', async ({ page }) => {
  test.setTimeout(60_000); // two full page loads plus the Appearance tab
  let modal = await openAppearance(page);
  const sw = modal.getByRole('switch', { name: 'Reduce transparency' });
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await expect(html(page)).toHaveAttribute('data-reduce-transparency', '');
  const panel = page.locator('[data-widget-card="clock-weather"]');
  await page.keyboard.press('Escape');
  expect(await panel.evaluate((el) => getComputedStyle(el).backdropFilter)).toBe('none');

  await page.reload();
  await expect(html(page)).toHaveAttribute('data-reduce-transparency', '');

  modal = await openAppearance(page);
  await modal.getByRole('button', { name: /Cyberpunk Neon/ }).click();
  await modal.getByRole('button', { name: 'Reset appearance to defaults' }).click();
  await expect(html(page)).not.toHaveAttribute('data-reduce-transparency', '');
  await expect(modal.getByRole('button', { name: /Obsidian Violet/ })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => accentVar(page)).toBe('#ff2e9a');
});

test('Multi-Timezone shows zone options under the gallery and adds a city', async ({ page }) => {
  test.setTimeout(60_000); // the world zone list loads on first search
  const modal = await openAppearance(page);
  await modal.getByRole('button', { name: 'Clock', exact: true }).click();
  await expect(modal.getByTestId('zone-picker')).toHaveCount(0);
  await modal.getByRole('radio', { name: 'Multi-Timezone' }).click();
  const picker = modal.getByTestId('zone-picker');
  await expect(picker).toBeVisible();
  await expect(picker).toContainText('0/2');
  for (const city of ['London', 'Tokyo']) {
    await picker.getByRole('button', { name: 'Add a time zone' }).click();
    await page.getByRole('textbox', { name: 'Search time zones' }).fill(city);
    await page.getByRole('option', { name: new RegExp(city) }).first().click();
    await expect(picker).toContainText(city);
  }
  await expect(picker.getByRole('button', { name: 'Add a time zone' })).toHaveCount(0); // 2 of 2
  await page.keyboard.press('Escape');
  const clock = page.getByRole('timer', { name: 'Digital clock' });
  await expect(clock).toHaveAttribute('data-clock-style', 'multi-timezone');
  await expect(clock).toContainText('London');
  await expect(clock).not.toContainText(/AM|PM/); // 24-hour
});

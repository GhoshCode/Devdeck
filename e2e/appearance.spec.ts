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
  const themes = modal.getByRole('region', { name: 'Themes' });
  const cards = themes.getByRole('button', { pressed: undefined });
  await modal.getByRole('tab', { name: /^light/i }).click();
  await expect(themes.getByText('DARK', { exact: true })).toHaveCount(0);
  await modal.getByRole('tab', { name: /^dark/i }).click();
  await expect(themes.getByText('LIGHT', { exact: true })).toHaveCount(0);
  await modal.getByRole('tab', { name: /^all/i }).click();
  expect(await cards.count()).toBeGreaterThan(12);

  await modal.getByRole('radio', { name: 'macOS Minimal' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('timer', { name: 'Digital clock' })).toHaveAttribute('data-clock-style', 'macos');
});

test('Reduce transparency survives a reload; reset restores the defaults', async ({ page }) => {
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

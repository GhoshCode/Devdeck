import { test, expect } from '@playwright/test';

// Site Map & Hierarchy: category grid with subcategory sections, the
// Currently Processing card, and the palette-style search.

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('[data-category-id]').first().waitFor({ state: 'visible' });
});

test('button sits left of Bookmarks and opens the map', async ({ page }) => {
  const map = page.getByRole('button', { name: 'Site Map & Hierarchy' });
  const bookmarks = page.getByRole('button', { name: 'Bookmarks and site map' });
  const [a, b] = await Promise.all([map.boundingBox(), bookmarks.boundingBox()]);
  expect(a!.x + a!.width).toBeLessThanOrEqual(b!.x);

  await map.click();
  const dialog = page.getByRole('dialog', { name: 'Site Map & Hierarchy' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('combobox', { name: 'Search the site map' })).toBeFocused();

  // First card is Currently Processing; category cards follow with uppercase sections.
  const cards = dialog.locator('section');
  await expect(cards.first()).toHaveAttribute('aria-label', 'Currently Processing');
  const frontend = dialog.getByRole('region', { name: 'Frontend' });
  await expect(frontend.getByText('General', { exact: true })).toBeVisible();
  await expect(frontend.getByText('Frameworks', { exact: true })).toBeVisible();
  await expect(frontend.getByRole('link', { name: /React/ }).first()).toHaveAttribute('href', /react\.dev/);
  await expect(frontend.getByText('Frameworks', { exact: true })).toHaveCSS('text-transform', 'uppercase');
});

test('search lists sites with their category → subcategory path', async ({ page }) => {
  await page.getByRole('button', { name: 'Site Map & Hierarchy' }).click();
  const dialog = page.getByRole('dialog', { name: 'Site Map & Hierarchy' });
  const input = dialog.getByRole('combobox', { name: 'Search the site map' });
  await input.fill('tailwind');

  const options = dialog.getByRole('option');
  await expect(options.first()).toContainText('Tailwind CSS');
  await expect(options.first()).toContainText('tailwindcss.com');
  await expect(options.first()).toContainText(/Frontend\s*→\s*Styling/);
  await expect(options.first()).toHaveAttribute('aria-selected', 'true');
  await expect(dialog.getByText('Navigate')).toBeVisible();

  // Arrow keys wrap through the list.
  const count = await options.count();
  await input.press('ArrowUp');
  await expect(options.nth(count - 1)).toHaveAttribute('aria-selected', 'true');
  await input.press('ArrowDown');
  await expect(options.first()).toHaveAttribute('aria-selected', 'true');

  // Esc clears first, then closes.
  await input.press('Escape');
  await expect(input).toHaveValue('');
  await expect(dialog.getByRole('region', { name: 'Frontend' })).toBeVisible();
  await input.press('Escape');
  await expect(dialog).toBeHidden();
});

test('empty results say so; Enter opens the highlighted site', async ({ page }) => {
  await page.context().route('https://tailwindcss.com/**', (route) => route.fulfill({ body: 'tailwind' }));
  await page.getByRole('button', { name: 'Site Map & Hierarchy' }).click();
  const dialog = page.getByRole('dialog', { name: 'Site Map & Hierarchy' });
  const input = dialog.getByRole('combobox', { name: 'Search the site map' });

  await input.fill('zzz-no-such-site');
  await expect(dialog.getByText('No sites match')).toBeVisible();

  await input.fill('tailwind');
  const [tab] = await Promise.all([page.waitForEvent('popup'), input.press('Enter')]);
  await tab.waitForURL(/tailwindcss\.com/);
});

test('clicking the backdrop closes the map', async ({ page }) => {
  await page.getByRole('button', { name: 'Site Map & Hierarchy' }).click();
  const dialog = page.getByRole('dialog', { name: 'Site Map & Hierarchy' });
  await expect(dialog).toBeVisible();
  await page.mouse.click(12, 700);
  await expect(dialog).toBeHidden();
});

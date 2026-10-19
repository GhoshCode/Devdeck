import { test, expect } from '@playwright/test';

// Phase 4 — D: Currently Processing.

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('[data-category-id]').first().waitFor({ state: 'visible' });
});

test('panel D is two stacked cards with the settings cog in the lower one', async ({ page }) => {
  const top = page.getByRole('region', { name: 'Processing: Currently processing' });
  const lower = page.getByRole('region', { name: 'Processing: other sections' });
  await expect(top).toBeVisible();
  await expect(lower).toBeVisible();
  const [t, l] = [await top.boundingBox(), await lower.boundingBox()];
  expect(l!.y).toBeGreaterThan(t!.y + t!.height - 1);

  const cog = lower.getByRole('button', { name: 'Manage currently processing' });
  const c = await cog.boundingBox();
  expect(c!.x + c!.width).toBeGreaterThan(l!.x + l!.width - 24); // bottom-right corner
  expect(c!.y + c!.height).toBeGreaterThan(l!.y + l!.height - 24);
});

test('add a library site, schedule it, and file a second one under another section', async ({ page }) => {
  await page.getByRole('button', { name: 'Manage currently processing' }).click();
  const dialog = page.getByRole('dialog', { name: 'Manage currently processing' });

  const add = dialog.getByRole('textbox', { name: 'Add a site to Currently Processing' });
  await add.fill('github');
  await add.press('Enter');

  // The new item opens for editing with reminders on by default.
  await dialog.getByRole('radio', { name: 'Hourly' }).click();
  await expect(dialog.getByText(/Every hour/).first()).toBeVisible();
  await expect(dialog.getByText(/Next reminder:/)).toBeVisible();

  // Point the add form at the Queue section so the next site lands in the lower card.
  await dialog.getByRole('combobox', { name: 'Section' }).first().fill('Queue');
  await add.fill('vercel.com');
  await add.press('Enter');

  await page.keyboard.press('Escape');
  await expect(page.getByRole('region', { name: 'Processing: Currently processing' }).getByText('GitHub')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Processing: other sections' }).getByText('Vercel')).toBeVisible();
});

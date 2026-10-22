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

  await dialog.getByRole('radiogroup', { name: 'Section' }).getByRole('radio', { name: 'Currently processing', exact: true }).click();
  const add = dialog.getByRole('textbox', { name: 'Add a site to Currently Processing' });
  await add.fill('github');
  await add.press('Enter');

  // The new item opens for editing with reminders on by default.
  await dialog.getByRole('radio', { name: 'Hourly' }).click();
  await expect(dialog.getByText(/Every hour/).first()).toBeVisible();
  await expect(dialog.getByText(/Next reminder:/)).toBeVisible();

  // Point the add form at the Queue section so the next site lands in the lower card.
  await dialog.getByRole('radiogroup', { name: 'Section' }).getByRole('radio', { name: 'Queue', exact: true }).click();
  await add.fill('vercel.com');
  await add.press('Enter');

  await page.keyboard.press('Escape');
  await expect(page.getByRole('region', { name: 'Processing: Currently processing' }).getByText('GitHub')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Processing: other sections' }).getByText('Vercel')).toBeVisible();
});

test('the sites panel lists every list, adds to the chosen one with a starting reminder, and never twice', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-category-id]').first().waitFor();
  // from the Queue box: the panel opens on Queue
  await page.getByTitle(/Add\/remove sites in the queue/).click();
  const dialog = page.getByRole('dialog', { name: 'Manage currently processing' });
  const lists = dialog.getByRole('radiogroup', { name: 'Section' });
  await expect(lists.getByRole('radio', { name: 'Currently processing', exact: true })).toBeVisible();
  await expect(lists.getByRole('radio', { name: 'Queue', exact: true })).toHaveAttribute('aria-checked', 'true');

  // a new list of one's own
  await dialog.getByRole('button', { name: '+ New list' }).click();
  await dialog.getByRole('textbox', { name: 'New section name' }).fill('Reading');
  await dialog.getByRole('textbox', { name: 'New section name' }).press('Enter');
  await expect(lists.getByRole('radio', { name: 'Reading', exact: true })).toHaveAttribute('aria-checked', 'true');

  await dialog.getByRole('radiogroup', { name: 'Starting reminder' }).getByRole('radio', { name: 'Mondays 9:00' }).click();
  const add = dialog.getByRole('textbox', { name: 'Add a site to Currently Processing' });
  await add.fill('github');
  await add.press('Enter');
  await expect(dialog.getByText(/Reading · Weekly at 09:00/).first()).toBeVisible();

  // the same site can't go into the same list twice
  await add.fill('github');
  await expect(dialog.getByRole('list', { name: 'Matching sites' }).getByRole('button').first()).toBeDisabled();
  await expect(dialog.getByText('Added to Reading').first()).toBeVisible();

  // the list filter shows every list with its count
  await expect(dialog.getByRole('tab', { name: /^Reading\s*1$/ })).toBeVisible();
  await expect(dialog.getByRole('tab', { name: /^Queue/ })).toBeVisible();
});

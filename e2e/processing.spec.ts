import { test, expect, type Locator, type Page } from '@playwright/test';

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

// The list the add side files into: a dropdown beside the name, like a site's card.
async function pickList(page: Page, dialog: Locator, name: string) {
  await dialog.getByRole('combobox', { name: 'Add to list' }).click();
  await page.getByRole('option', { name, exact: true }).click();
}

test('add a library site, schedule it, and file a second one under another section', async ({ page }) => {
  await page.getByRole('button', { name: 'Manage currently processing' }).click();
  const dialog = page.getByRole('dialog', { name: 'Manage currently processing' });

  await dialog.getByRole('tab', { name: 'From your sites' }).click();
  await pickList(page, dialog, 'Currently processing');
  const add = dialog.getByRole('textbox', { name: 'Add a site to Currently Processing' });
  await add.fill('github');
  await add.press('Enter');

  // The new item opens for editing on the right, with its reminder on.
  const card = dialog.locator('li[data-processing-id]').first();
  await card.getByRole('radio', { name: 'Hourly' }).click();
  await expect(dialog.getByText(/Every hour/).first()).toBeVisible();
  await expect(dialog.getByText(/Next reminder:/)).toBeVisible();

  // Point the add side at Queue so the next site lands in the lower card.
  await pickList(page, dialog, 'Queue');
  await add.fill('vercel.com');
  await add.press('Enter');

  await page.keyboard.press('Escape');
  await expect(page.getByRole('region', { name: 'Processing: Currently processing' }).getByText('GitHub')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Processing: other sections' }).getByText('Vercel')).toBeVisible();
});

test('the sites panel: a brand-new site with its own reminder goes to the top of its list, never twice', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-category-id]').first().waitFor();
  // from the Queue box: the panel opens on Queue, with New site first
  await page.getByTitle(/Add\/remove sites in the queue/).click();
  const dialog = page.getByRole('dialog', { name: 'Manage currently processing' });
  await expect(dialog.getByRole('tablist', { name: 'How to add' }).getByRole('tab').first()).toHaveText('New site');
  await expect(dialog.getByRole('tab', { name: 'New site' })).toHaveAttribute('aria-selected', 'true');
  await expect(dialog.getByRole('combobox', { name: 'Add to list' })).toContainText('Queue');

  // a list of one's own, from the dropdown
  await pickList(page, dialog, '+ New list…');
  await dialog.getByRole('textbox', { name: 'New section name' }).fill('Reading');
  await dialog.getByRole('textbox', { name: 'New section name' }).press('Enter');
  await expect(dialog.getByRole('combobox', { name: 'Add to list' })).toContainText('Reading');

  // a brand-new site with its own reminder: weekly on Mondays at 07:30, plus a timer
  const addSide = dialog.getByRole('form', { name: 'Add a site' });
  await dialog.getByRole('textbox', { name: 'New site name' }).fill('Team wiki');
  await dialog.getByRole('textbox', { name: 'New site address' }).fill('wiki.example.com');
  await addSide.getByRole('radio', { name: 'Weekly' }).click();
  await addSide.getByLabel('Time of day').fill('07:30');
  for (const d of ['Tu', 'We', 'Th', 'Fr']) {
    const b = addSide.getByRole('button', { name: d, exact: true });
    if ((await b.getAttribute('aria-pressed')) === 'true') await b.click();
  }
  await addSide.getByRole('button', { name: '1 day', exact: true }).click();
  await addSide.getByRole('button', { name: 'Add to Reading' }).click();

  // it shows at the top of the list, open, with that reminder
  const first = dialog.getByRole('list', { name: 'Sites' }).locator('li[data-processing-id]').first();
  await expect(first).toContainText('Team wiki');
  await expect(first).toContainText(/Reading · Weekly at 07:30/);

  // the same address can't go into the same list twice
  await dialog.getByRole('textbox', { name: 'New site name' }).fill('Wiki again');
  await dialog.getByRole('textbox', { name: 'New site address' }).fill('https://wiki.example.com');
  await expect(dialog.getByText('Already in Reading.')).toBeVisible();
  await expect(addSide.getByRole('button', { name: 'Add to Reading' })).toBeDisabled();

  // sort by next reminder, and the list tabs show their counts
  await dialog.getByRole('combobox', { name: 'Sort sites' }).click();
  await page.getByRole('option', { name: 'Next reminder' }).click();
  await expect(dialog.getByRole('tab', { name: /^Reading\s*1$/ })).toBeVisible();
});

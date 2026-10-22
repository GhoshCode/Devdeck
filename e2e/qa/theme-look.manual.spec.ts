import { test, type Page } from '@playwright/test';
import { PRESET_THEMES } from '../../src/store/themes';

// Visual check that every surface follows the chosen theme: screenshots of the
// main surfaces on two themes into qa-artifacts/theme-<id>-*.png.
// Run on request: THEMELOOK=1 npx playwright test --project=qa e2e/qa/theme-look.manual.spec.ts
test.skip(!process.env.THEMELOOK, 'set THEMELOOK=1');
test.use({ video: 'off', trace: 'off', viewport: { width: 1920, height: 1080 } });

async function applyTheme(page: Page, id: string) {
  const t = PRESET_THEMES.find((p) => p.id === id)!;
  await page.evaluate(async (look) => {
    const m = await import('/src/store/index.ts');
    m.useStore.getState().updateSettings({ presetTheme: look.id, accentColor: look.accentColor, backgroundImage: look.gradient, themeMode: look.mode });
  }, { id: t.id, accentColor: t.accentColor, gradient: t.gradient, mode: t.mode });
  await page.waitForTimeout(600);
}

for (const id of ['nature-ocean', 'default-dark']) {
  test(`surfaces follow the theme: ${id}`, async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-category-id]').first().waitFor();
    await applyTheme(page, id);
    const shot = (name: string) => page.screenshot({ path: `qa-artifacts/theme-${id}-${name}.png` });
    await shot('dashboard');

    // sites panel with a few sites in both lists
    await page.getByTitle(/Add\/remove sites in the queue/).click();
    const dialog = page.getByRole('dialog', { name: 'Manage currently processing' });
    await dialog.getByRole('tab', { name: 'From your sites' }).click();
  const add = dialog.getByRole('textbox', { name: 'Add a site to Currently Processing' });
    for (const [list, name] of [['Queue', 'github'], ['Currently processing', 'figma'], ['Queue', 'notion']] as const) {
      await dialog.getByRole('combobox', { name: 'Add to list' }).click();
    await page.getByRole('option', { name: list, exact: true }).click();
      await add.fill(name);
      await add.press('Enter');
    }
    await dialog.getByRole('tab', { name: 'New site' }).click();
    await shot('sites-panel');
    await page.keyboard.press('Escape');

    // calendar
    await page.getByRole('button', { name: /calendar/i }).first().click();
    await page.locator('.cmdcal').waitFor();
    await page.waitForTimeout(400);
    await shot('calendar');
    await page.locator('.cmdcal button[title^="Schedule an event"]').click();
    await page.waitForTimeout(300);
    await shot('calendar-composer');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');

    // settings
    await page.keyboard.press(',');
    await page.waitForTimeout(500);
    await shot('settings');
    await page.keyboard.press('Escape');
  });
}

import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { contrastAudit, measureFrames, report, seedDeck, step, watchConsole, type FrameStats } from './qa';

// Contrast inside an open overlay; recorded, and any violation fails softly.
async function auditOpen(page: Page, info: TestInfo, name: string, selector: string) {
  const issues = await contrastAudit(page, selector);
  await report(info, `contrast: ${name}`, { violations: issues.length, issues });
  expect.soft(issues, `${name}: contrast violations`).toEqual([]);
}

// Full manual-QA pass: every feature, one function at a time, in both themes.
// Each transition is timed (smoothness) and every step is screenshotted for
// visual review. Functional breakage fails; smoothness is recorded.

const THEMES = ['light', 'dark'] as const;

// Collects per-transition frame stats for one test and reports them at the end.
function transitions(page: Page, info: TestInfo) {
  const results: Record<string, FrameStats> = {};
  return {
    async run(name: string, action: () => Promise<void>, settleMs?: number) {
      results[name] = await measureFrames(page, action, settleMs);
      await step(page, info, name, async () => {});
    },
    async done() {
      await report(info, 'transitions', results);
    },
  };
}

for (const theme of THEMES) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await seedDeck(page, { theme });
      await page.waitForTimeout(1500);
    });

    test('top bar — clock faces, command prompt, weather', async ({ page }, info) => {
      const errors = watchConsole(page);
      const t = transitions(page, info);
      await step(page, info, 'top bar at rest', async () => {});

      for (const face of ['Cyberpunk 2077', 'macOS Minimal', 'Digital (DSEG7)']) {
        await page.getByRole('button', { name: 'Settings', exact: true }).click();
        await page.getByRole('dialog', { name: 'DevDeck Settings' }).getByRole('button', { name: /Appearance/ }).click();
        await page.getByRole('radio', { name: face }).click();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog', { name: 'DevDeck Settings' })).toHaveCount(0);
        await step(page, info, `clock face ${face}`, async () => {});
      }

      const prompt = page.getByRole('textbox', { name: 'Command prompt' });
      await prompt.fill('calc 12*(3+4)');
      await t.run('command calc result', () => prompt.press('Enter'), 300);
      await expect(page.getByTestId('command-result')).toHaveText('12*(3+4) = 84');
      await prompt.fill('help');
      await prompt.press('Enter');
      await expect(page.getByTestId('command-result')).toContainText('gh <owner/repo');
      await page.getByRole('button', { name: 'Administrator mode' }).click();
      await step(page, info, 'admin mode on', async () => {});
      await expect(page.getByRole('button', { name: 'Administrator mode' })).toHaveAttribute('aria-pressed', 'true');

      await t.run('weather refresh click', () => page.getByTestId('weather-uv').click(), 1500);
      await t.done();
      expect(errors, errors.join('\n')).toEqual([]);
    });

    test('to-do — expand, add with due date, complete, archive, restore, collapse', async ({ page }, info) => {
      const t = transitions(page, info);
      const widget = page.getByTestId('todo-widget');
      await step(page, info, 'collapsed with overdue on top', async () => {});
      await expect(widget.locator('li[data-todo-id]').first()).toHaveAttribute('data-overdue', 'true');

      await t.run('expand overlay', () => widget.getByRole('button', { name: 'Expand' }).click());
      const panel = page.getByRole('dialog', { name: 'All tasks' });
      await expect(panel).toBeVisible();

      await panel.getByRole('textbox', { name: 'New task' }).fill('Write QA report');
      await panel.getByRole('button', { name: 'Attach due date' }).click();
      await panel.getByRole('textbox', { name: 'Due date' }).fill('2030-01-15');
      await panel.getByRole('textbox', { name: 'New task' }).press('Enter');
      await step(page, info, 'task added', async () => {});
      await expect(panel.getByText('Write QA report')).toBeVisible();
      await expect(panel.locator('li', { hasText: 'Write QA report' })).toContainText('Jan 15');
      await auditOpen(page, info, 'to-do overlay', '[role="dialog"][aria-label="All tasks"]');

      await t.run('complete slides out', () => panel.getByRole('button', { name: 'Complete "Write QA report"' }).click(), 800);
      await expect(panel.getByText('Write QA report')).toHaveCount(0);

      await t.run('open archive', () => panel.getByRole('button', { name: /^Archive/ }).click());
      const archive = page.getByRole('dialog', { name: 'Archived tasks' });
      await archive.getByRole('button', { name: 'Restore "Write QA report"' }).click();
      await t.run('back to tasks', () => archive.getByRole('button', { name: 'Back to tasks' }).click());
      await expect(page.getByRole('dialog', { name: 'All tasks' }).getByText('Write QA report')).toBeVisible();

      await t.run('collapse with Escape', () => page.keyboard.press('Escape'));
      await expect(page.getByRole('dialog', { name: 'All tasks' })).toHaveCount(0);
      await t.done();
    });

    test('search — focus, live suggestions, keyboard navigation, dismiss', async ({ page }, info) => {
      const t = transitions(page, info);
      const input = page.getByRole('combobox', { name: 'Search' });
      await page.keyboard.press('Control+k');
      await expect(input).toBeFocused();
      await t.run('dropdown opens while typing', () => input.pressSequentially('react', { delay: 60 }), 900);
      const list = page.getByRole('listbox', { name: 'Search suggestions' });
      await expect(list.getByText('Your sites')).toBeVisible();
      await auditOpen(page, info, 'search dropdown', '#search-suggestions');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowDown');
      await step(page, info, 'second option highlighted', async () => {});
      await expect(list.getByRole('option').nth(1)).toHaveAttribute('aria-selected', 'true');
      await t.run('dismiss with Escape', () => page.keyboard.press('Escape'));
      await expect(list).toHaveCount(0);
      await t.done();
    });

    test('bookmarks drawer — open, expand folder, filter, close', async ({ page }, info) => {
      const t = transitions(page, info);
      await t.run('drawer slides in', () => page.getByRole('button', { name: 'Bookmarks and site map' }).click());
      const drawer = page.getByRole('dialog', { name: 'Bookmarks and site map' });
      await expect(drawer).toBeVisible();
      await t.run('expand Frontend folder', () => drawer.getByRole('treeitem', { name: 'Frontend' }).getByRole('button', { name: 'Expand folder' }).click());
      await expect(drawer.getByRole('treeitem', { name: 'GitHub' }).first()).toBeVisible();
      await auditOpen(page, info, 'bookmarks drawer', '[role="dialog"][aria-label="Bookmarks and site map"]');
      await t.run('filter as you type', () => drawer.getByRole('textbox', { name: 'Filter bookmarks' }).pressSequentially('postgres', { delay: 50 }));
      await expect(drawer.getByRole('treeitem', { name: 'PostgreSQL' })).toBeVisible();
      await t.run('drawer slides out', () => page.keyboard.press('Escape'));
      await expect(drawer).toHaveCount(0);
      await t.done();
    });

    test('cards — pin, unpin, subcategory pills, list view, links strip', async ({ page }, info) => {
      const t = transitions(page, info);
      const names = () => page.locator('[data-category-id] h2').allTextContents();
      const original = await names();

      await t.run('pin moves card to front', () => page.getByRole('button', { name: `Pin ${original[3]}` }).click(), 900);
      await expect.poll(async () => (await names())[0]).toBe(original[3]);
      await t.run('unpin restores order', () => page.getByRole('button', { name: `Unpin ${original[3]}` }).click(), 900);
      await expect.poll(names).toEqual(original);

      const card = page.locator('[data-category-id]').first();
      const pills = card.locator('[data-group-id]');
      await t.run('switch subcategory pill', () => pills.nth(1).click(), 700);
      await expect(pills.nth(1)).toHaveAttribute('aria-current', 'true');
      await t.run('back to first pill', () => pills.nth(0).click(), 700);

      await t.run('list view', () => card.getByRole('button', { name: 'List view' }).click(), 700);
      await expect(card.getByRole('region', { name: /All sites list/ })).toBeVisible();
      await t.run('grid view', () => card.getByRole('button', { name: 'Grid view' }).click(), 700);

      const chip = page.getByTestId('links-strip').locator('[data-chip=fixed]').first();
      await chip.hover();
      await step(page, info, 'quick link hover', async () => {});
      const tile = card.locator('[aria-label="Primary sites rail"] a').first();
      await tile.hover();
      await step(page, info, 'site tile hover', async () => {});
      await t.done();
    });

    test('currently processing — open editor, add, set schedule, close', async ({ page }, info) => {
      const t = transitions(page, info);
      await t.run('editor opens', () => page.getByRole('button', { name: 'Manage currently processing' }).click());
      const dialog = page.getByRole('dialog', { name: 'Manage currently processing' });
      const add = dialog.getByRole('textbox', { name: 'Add a site to Currently Processing' });
      await add.fill('supabase');
      await add.press('Enter');
      await dialog.getByRole('radio', { name: 'Daily' }).click();
      await step(page, info, 'schedule editor', async () => {});
      await expect(dialog.getByText(/Next reminder:/)).toBeVisible();
      await auditOpen(page, info, 'processing editor', '[role="dialog"][aria-label="Manage currently processing"]');
      await t.run('editor closes', () => page.keyboard.press('Escape'));
      await expect(page.getByRole('region', { name: 'Processing: Focus' }).getByText('Supabase')).toBeVisible();
      await t.done();
    });

    test('feeds — topic chips filter, refresh', async ({ page }, info) => {
      const t = transitions(page, info);
      const news = page.getByRole('region', { name: 'Tech news' });
      await expect(news.locator('[data-feed-item]').first()).toBeVisible({ timeout: 15_000 });
      const chips = page.getByRole('radiogroup', { name: 'Filter feeds by topic' });
      for (const chip of ['#AI', '#Frontend', '#DevOps', 'All']) {
        await t.run(`topic ${chip}`, () => chips.getByRole('radio', { name: chip }).click(), 400);
        await expect(chips.getByRole('radio', { name: chip })).toHaveAttribute('aria-checked', 'true');
      }
      await t.run('refresh feeds', () => page.getByRole('button', { name: 'Refresh feeds' }).click(), 2500);
      await t.done();
    });

    test('settings — open, close, theme switch', async ({ page }, info) => {
      const t = transitions(page, info);
      await t.run('settings opens', () => page.getByRole('button', { name: 'Settings', exact: true }).click());
      const modal = page.getByRole('dialog', { name: 'DevDeck Settings' });
      await modal.getByRole('button', { name: /Appearance/ }).click();
      await auditOpen(page, info, 'settings appearance', '[role="dialog"][aria-label="DevDeck Settings"]');
      const other = theme === 'light' ? 'dark' : 'light';
      await t.run(`switch to ${other}`, () => modal.getByRole('radio', { name: other === 'light' ? 'Light' : 'Dark', exact: true }).click(), 800);
      await expect(page.locator('html')).toHaveAttribute('data-theme', other);
      await t.run('settings closes', () => modal.getByRole('button', { name: 'Close Settings' }).click());
      await expect(modal).toHaveCount(0);
      await step(page, info, `dashboard in ${other}`, async () => {});
      await t.done();
    });
  });
}

test.describe('responsive', () => {
  for (const [label, width, height] of [
    ['13-inch laptop 1280', 1280, 800],
    ['small window 900', 900, 800],
  ] as const) {
    test(`${label} — layout and drawers`, async ({ page }, info) => {
      await page.setViewportSize({ width, height });
      await seedDeck(page, { theme: 'light' });
      await page.waitForTimeout(1500);
      const t = transitions(page, info);
      await step(page, info, 'layout', async () => {});
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

      await t.run('news drawer opens', () => page.getByRole('button', { name: 'Open news and topics' }).click());
      await expect(page.getByRole('dialog', { name: 'Tech news and topics' })).toBeVisible();
      await t.run('news drawer closes', () => page.keyboard.press('Escape'));
      if (width < 1024) {
        await t.run('processing drawer opens', () => page.getByRole('button', { name: 'Open currently processing' }).click());
        await expect(page.getByRole('dialog', { name: 'Currently processing' })).toBeVisible();
        await page.keyboard.press('Escape');
      }
      await t.done();
    });
  }
});

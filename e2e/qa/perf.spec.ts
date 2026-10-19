import { expect, test, type Page } from '@playwright/test';
import { measureFrames, report, seedDeck, type FrameStats } from './qa';

// Interaction performance, measured without video/trace (they cost frames).
// Each interaction runs five times; the median worst-frame and jank count are
// reported, and the budget below is what a tester would call "smooth".

test.use({ video: 'off', trace: 'off', screenshot: 'off' });
// One theme at a time: two measurements in parallel would skew each other.
test.describe.configure({ mode: 'serial' });

const RUNS = 5;
// Per-interaction budgets. Theme switch runs inside a View Transition: the
// browser shows a crossfading snapshot while it restyles, and pauses rAF for
// the capture, so its frame counter overstates what the user sees. Pinning
// moves a heavy card to the front in one layout pass (one long frame).
const DEFAULT_BUDGET = { worstFrameMs: 120, jankFrames: 3 };
const BUDGETS: Record<string, { worstFrameMs: number; jankFrames: number }> = {
  'theme switch': { worstFrameMs: 200, jankFrames: 6 },
  'pin / unpin': { worstFrameMs: 150, jankFrames: 3 },
};

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

async function sample(page: Page, action: () => Promise<void>, settle = 700) {
  const runs: FrameStats[] = [];
  for (let i = 0; i < RUNS; i++) runs.push(await measureFrames(page, action, settle));
  return {
    worstFrameMs: median(runs.map((r) => r.worstFrameMs)),
    jankFrames: median(runs.map((r) => r.jankFrames)),
    longTasks: median(runs.map((r) => r.longTasks)),
  };
}

for (const theme of ['light', 'dark'] as const) {
  test(`${theme} — interaction performance`, async ({ page }, info) => {
    await seedDeck(page, { theme });
    await page.waitForTimeout(2000);
    const results: Record<string, Awaited<ReturnType<typeof sample>>> = {};

    // Theme switch round trip from Settings → Appearance.
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const modal = page.getByRole('dialog', { name: 'DevDeck Settings' });
    await modal.getByRole('button', { name: /Appearance/ }).click();
    let flip = theme === 'light';
    results['theme switch'] = await sample(page, async () => {
      await modal.getByRole('radio', { name: flip ? 'Dark' : 'Light', exact: true }).click();
      flip = !flip;
    }, 900);
    // Leave it on the theme under test.
    await modal.getByRole('radio', { name: theme === 'light' ? 'Light' : 'Dark', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(modal).toHaveCount(0);

    const names = await page.locator('[data-category-id] h2').allTextContents();
    let pinned = false;
    results['pin / unpin'] = await sample(page, async () => {
      await page.getByRole('button', { name: `${pinned ? 'Unpin' : 'Pin'} ${names[3]}` }).click();
      pinned = !pinned;
    }, 900);
    if (pinned) await page.getByRole('button', { name: `Unpin ${names[3]}` }).click();

    const pills = page.locator('[data-category-id]').first().locator('[data-group-id]');
    let pill = 1;
    results['subcategory pill'] = await sample(page, async () => {
      await pills.nth(pill).click();
      pill = pill === 1 ? 0 : 1;
    });

    results['settings open'] = await sample(page, async () => {
      await page.getByRole('button', { name: 'Settings', exact: true }).click();
      await page.getByRole('dialog', { name: 'DevDeck Settings' }).waitFor();
      await page.keyboard.press('Escape');
    }, 600);

    results['bookmarks drawer'] = await sample(page, async () => {
      await page.getByRole('button', { name: 'Browser bookmarks' }).click();
      await page.getByRole('dialog', { name: 'Browser bookmarks' }).waitFor();
      await page.keyboard.press('Escape');
    }, 600);

    // Scrolling: wheel bursts over the card row, the links strip and inside a card.
    const wheel = async (selector: string, yFrac: number) => {
      const box = (await page.locator(selector).first().boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height * yFrac);
      for (let i = 0; i < 10; i++) {
        await page.mouse.wheel(0, 140);
        await page.waitForTimeout(30);
      }
    };
    let dir = 1;
    results['scroll card row'] = await sample(page, async () => {
      await page.getByRole('region', { name: 'Scrollable category cards' }).evaluate((el, d) => {
        el.style.scrollBehavior = 'auto';
        if (d < 0) el.scrollLeft = 0;
      }, dir);
      await wheel('[aria-label="Scrollable category cards"]', 0.02);
      dir = -dir;
    });
    results['scroll links strip'] = await sample(page, () => wheel('[data-strip="scroll"]', 0.5));
    results['scroll inside card'] = await sample(page, () => wheel('[data-category-id]', 0.8));

    await report(info, 'performance (median of 5)', { budgets: { default: DEFAULT_BUDGET, ...BUDGETS }, results });
    for (const [name, r] of Object.entries(results)) {
      const budget = BUDGETS[name] ?? DEFAULT_BUDGET;
      expect.soft(r.worstFrameMs, `${name}: worst frame`).toBeLessThanOrEqual(budget.worstFrameMs);
      expect.soft(r.jankFrames, `${name}: janky frames`).toBeLessThanOrEqual(budget.jankFrames);
    }
  });
}

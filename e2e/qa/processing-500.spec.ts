import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

// Heavy QA, the way a person builds up their work list: open the Queue box's
// Manage dialog and add ~500 sites one at a time — library sites by name and
// pasted URLs — half to Currently processing, half to Queue, each with its own
// reminder (hourly / daily / weekly / monthly, different times and days).
// Then open the full-screen calendar and walk every view with that load,
// timing each and saving screenshots to qa-artifacts/.
// Slow, so it only runs on request:
//   PROC500=1 npx playwright test --project=qa e2e/qa/processing-500.spec.ts

test.skip(!process.env.PROC500, 'set PROC500=1 to run the 500-site load');
test.use({ video: 'off', trace: 'off', screenshot: 'off', viewport: { width: 1920, height: 1080 }, actionTimeout: 15_000, baseURL: process.env.QA_URL ?? undefined });

let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
const hhmm = (h: number, m: number) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

const DOMAINS = ['github.com', 'gitlab.com', 'linear.app', 'notion.so', 'figma.com', 'vercel.com', 'netlify.app', 'supabase.com', 'stripe.com', 'sentry.io', 'datadoghq.com', 'grafana.com', 'aws.amazon.com', 'cloud.google.com', 'portal.azure.com', 'docs.python.org', 'developer.mozilla.org', 'stackoverflow.com', 'npmjs.com', 'pypi.org'];

async function scheduleOpenItem(page: Page, dialog: ReturnType<Page['getByRole']>, i: number) {
  const card = dialog.locator('li[data-processing-id]').filter({ has: page.locator('button[aria-expanded="true"]') });
  await card.scrollIntoViewIfNeeded();
  await expect(card).toHaveCount(1);
  const freq = pick(['Hourly', 'Daily', 'Daily', 'Daily', 'Weekly', 'Weekly', 'Monthly'] as const);
  const radio = card.getByRole('radio', { name: freq, exact: true });
  if ((await radio.getAttribute('aria-checked')) !== 'true') await radio.click();
  if (freq !== 'Hourly') await card.getByLabel('Time of day').fill(hhmm(int(6, 22), pick([0, 15, 30, 45])));
  if (freq === 'Weekly' || freq === 'Daily' || freq === 'Hourly') {
    // a few different days for each
    for (const d of ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']) {
      const btn = card.getByRole('button', { name: d, exact: true });
      const want = rnd() < (freq === 'Weekly' ? 0.35 : 0.75);
      if ((await btn.getAttribute('aria-pressed')) === 'true' ? !want : want) await btn.click();
    }
  }
  if (freq === 'Monthly' && i % 3 === 0) {
    await card.getByRole('combobox', { name: 'Day of the month' }).click();
    await page.getByRole('option', { name: `${pick(['1st', '5th', '10th', '15th', '20th', '28th'])} day`, exact: true }).click();
  }
  return freq;
}

test('add ~500 sites to Currently processing and Queue one by one, then walk the calendar', async ({ page }) => {
  test.setTimeout(90 * 60_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/favicon|Failed to load resource|ERR_/.test(m.text()) && errors.push(m.text()));

  await page.goto('/');
  await page.locator('[data-category-id]').first().waitFor();
  // the names the person sees in their library (read, not written)
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('devdeck') ?? '{}').state ?? {});
  const libraryNames: string[] = ((await stored()).sites ?? []).map((s: { name: string }) => s.name);

  await page.getByRole('button', { name: 'Manage currently processing' }).click();
  const dialog = page.getByRole('dialog', { name: 'Manage currently processing' });
  await dialog.getByRole('tab', { name: 'From your sites' }).click();
  const add = dialog.getByRole('textbox', { name: 'Add a site to Currently Processing' });

  const freqs: Record<string, number> = {};
  const addTimes: number[] = [];
  const TOTAL = 500;
  for (let i = 0; i < TOTAL; i++) {
    await dialog.getByRole('combobox', { name: 'Add to list' }).click();
    await page.getByRole('option', { name: i % 2 ? 'Queue' : 'Currently processing', exact: true }).click();
    const t0 = Date.now();
    if (i < libraryNames.length) {
      await add.fill(libraryNames[i]);
      await add.press('Enter');
    } else {
      await add.fill(`https://${pick(DOMAINS)}/team-${i}/project-${int(1, 99)}`);
      await add.press('Enter');
    }
    addTimes.push(Date.now() - t0);
    const f = await scheduleOpenItem(page, dialog, i);
    freqs[f] = (freqs[f] ?? 0) + 1;
    if (i % 50 === 49) console.log(`added ${i + 1}, last add ${addTimes[addTimes.length - 1]}ms`);
  }
  const count: number = ((await stored()).processing ?? []).length;
  console.log('PROCESSING', JSON.stringify({ count, freqs, slowestAddMs: Math.max(...addTimes), lastAddMs: addTimes.at(-1) }));
  await page.keyboard.press('Escape');

  mkdirSync('qa-artifacts', { recursive: true });
  writeFileSync('qa-artifacts/processing-500.json', await page.evaluate(() => localStorage.getItem('devdeck') ?? ''));
  await page.screenshot({ path: 'qa-artifacts/p500-dashboard.png' });

  // The calendar with this load: every view, timed.
  const t0 = Date.now();
  await page.getByRole('button', { name: /calendar/i }).first().click();
  await page.locator('.cmdcal').waitFor();
  const timings: Record<string, number> = { open: Date.now() - t0 };
  for (const v of ['Day', 'Week', 'Month', 'Agenda']) {
    const s = Date.now();
    await page.locator('.cmdcal [role="tab"]').filter({ hasText: new RegExp(`^${v}`) }).first().click();
    await page.waitForTimeout(300);
    timings[v] = Date.now() - s;
    await page.screenshot({ path: `qa-artifacts/p500-cal-${v.toLowerCase()}.png` });
  }
  // next / previous week
  await page.locator('.cmdcal [role="tab"]').filter({ hasText: /^Week/ }).first().click();
  for (const dir of ['Next', 'Next', 'Previous', 'Previous']) {
    const s = Date.now();
    await page.getByRole('button', { name: dir, exact: true }).click();
    timings[`${dir}-${Date.now()}`] = Date.now() - s;
  }
  // what a person checks: month days say how much more they hold, agenda cards
  // are readable, and a stack of reminders opens as a list
  await page.locator('.cmdcal [role="tab"]').filter({ hasText: /^Month/ }).first().click();
  await expect(page.locator('.cc-more').first()).toBeVisible();
  await page.locator('.cmdcal [role="tab"]').filter({ hasText: /^Agenda/ }).first().click();
  const card = page.locator('[data-testid="cal-agenda"] [data-cal-item]').first();
  expect((await card.boundingBox())!.height).toBeGreaterThan(44);
  await expect(card.locator('.cc-item-title')).toBeVisible();
  await page.locator('.cmdcal [role="tab"]').filter({ hasText: /^Day/ }).first().click();
  const group = page.locator('[data-key^="reminders:"]').first();
  await group.click();
  const stackList = page.getByTestId('cal-reminder-stack');
  await expect(stackList).toBeVisible();
  console.log('STACK', await stackList.locator('li').count());
  await page.screenshot({ path: 'qa-artifacts/p500-cal-stack.png' });
  await page.keyboard.press('Escape');
  const domItems = await page.locator('[data-cal-item]').count();
  console.log('DOM_ITEMS_DAY', domItems);
  console.log('TIMINGS', JSON.stringify(timings));
  console.log('ERRORS', JSON.stringify(errors.slice(0, 20)));
  expect(count).toBeGreaterThanOrEqual(TOTAL);
});

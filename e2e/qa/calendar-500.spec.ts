import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

// Heavy calendar QA: fills DevDeck with 500+ scheduled items the way a person
// would — one at a time, typing into the to-do box and the calendar's
// "Schedule" composer (events, to-dos, queue and processing items) — then
// saves the result to qa-artifacts/calendar-500.json for the calendar checks.
// Slow (several minutes), so it only runs on request:
//   CAL500=1 npx playwright test --project=qa e2e/qa/calendar-500.spec.ts

test.skip(!process.env.CAL500, 'set CAL500=1 to run the 500-item calendar load');
test.use({ video: 'off', trace: 'off', screenshot: 'off', viewport: { width: 1920, height: 1080 } });

const TODAY = new Date();
const day = (offset: number) => {
  const d = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const time = (h: number, m: number) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
// A small seeded random, so every run builds the same calendar.
let seed = 42;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));

const EVENT_TITLES = ['Standup', 'Architecture sync', 'Board call', '1:1 with Priya', 'Design review', 'Flight to SFO', 'Sprint planning', 'Customer demo', 'Incident retro', 'Hiring panel', 'Lunch with Sam', 'Deep work: auth refactor', 'Release go/no-go', 'Security review', 'Investor update', 'Team offsite prep', 'Dentist', 'Gym', 'Pair programming', 'Quarterly planning'];
const EVENT_KINDS = ['Meeting', 'Call', 'VIP', 'Deep work', 'Deadline', 'Travel'] as const;
const PEOPLE = ['Sarah Chen', 'Board', '#q4', 'Priya', 'Sam, Alex', '#infra', 'Design team', ''];
const PLACES = ['Room Alpha', 'meet.google.com/abc-defg-hij', 'Zoom', 'SFO T2', 'Cafe Nero', ''];
const TODO_TEXTS = ['Approve Q4 compute allocation', 'Write release notes', 'Review PR', 'Reply to recruiter', 'Renew domain', 'Update runbook', 'Fix flaky test', 'Pay electricity bill', 'Book cab to airport', 'Draft blog post', 'Rotate API keys', 'Order groceries', 'Prepare slides', 'Call mom', 'Backup laptop'];
const NL_TODOS = ['Ship notes #launch !p1 tomorrow 5pm', 'Review PR #backend !p2 today 4pm', 'Pay rent !p1 next monday 9am', 'Renew passport #personal friday', 'Standup prep tomorrow 9:30am', 'Write tests #qa !p3 in 3 days', 'Email Priya #hiring next week', 'Plan sprint !p2 monday 11am', 'Dentist appointment saturday 10am', 'Fix login bug #auth !p1 today 6pm'];
const QUEUE_TEXTS = ['Triage open pull requests', 'Read RFC 9110', 'Go through bug backlog', 'Review design docs', 'Clear notifications', 'Read HN top posts', 'Check Dependabot alerts', 'Learn Rust lifetimes'];
const PROC_TEXTS = ['Vector index rebuild', 'Migrate to Vite 7', 'Kubernetes upgrade', 'Data pipeline backfill', 'Write the auth service', 'Refactor billing module', 'Ship v3 onboarding'];
const URLS = ['github.com/org/repo/pulls', 'linear.app/team/backlog', 'docs.google.com/document/d/abc', 'news.ycombinator.com', 'figma.com/file/xyz', 'grafana.example.com/d/api', ''];

async function openComposer(page: Page, kind: 'Calendar event' | 'To-do' | 'Queue' | 'Processing') {
  await page.locator('.cmdcal button[title^="Schedule an event"]').click();
  const c = page.getByTestId('cal-composer');
  await c.getByRole('radio', { name: new RegExp(`^${kind}`) }).click();
  return c;
}

test('load 500+ scheduled items through the UI, one at a time', async ({ page }) => {
  test.setTimeout(60 * 60_000);
  await page.goto('/');
  await page.locator('[data-category-id]').first().waitFor();
  const counts = { nlTodos: 0, events: 0, todos: 0, queue: 0, processing: 0, editor: 0 };

  // 1. To-dos typed into the to-do box, natural language with dates and tags.
  await page.getByRole('tab', { name: /to-do/i }).first().click();
  const box = page.getByPlaceholder(/Add a task/).first();
  for (let i = 0; i < 120; i++) {
    const text = i < NL_TODOS.length * 3 ? `${NL_TODOS[i % NL_TODOS.length]} (${i + 1})` : `${pick(TODO_TEXTS)} ${i + 1} ${pick(['today', 'tomorrow', 'next week', 'friday 3pm', 'in 2 days', ''])}`.trim();
    await box.fill(text);
    await box.press('Enter');
    counts.nlTodos++;
  }

  // 2. Sites into Currently processing / a queue section through the Manage dialog.
  await page.getByRole('button', { name: 'Manage currently processing' }).click();
  const dialog = page.getByRole('dialog', { name: 'Manage currently processing' });
  const add = dialog.getByRole('textbox', { name: 'Add a site to Currently Processing' });
  const section = dialog.getByRole('textbox', { name: 'Section' }).first();
  for (let i = 0; i < 30; i++) {
    await section.fill(i % 2 ? 'Queue' : 'Currently processing');
    await add.fill(`https://example-${i}.dev/project`);
    await add.press('Enter');
    counts.editor++;
  }
  await page.keyboard.press('Escape');

  // 3. Everything else through the full-screen calendar's Schedule composer.
  await page.getByRole('button', { name: /calendar/i }).first().click();
  await page.locator('.cmdcal').waitFor();
  for (let i = 0; i < 400; i++) {
    const r = i % 10;
    const offset = int(-21, 42);
    if (r < 4) {
      const c = await openComposer(page, 'Calendar event');
      const h = int(7, 20);
      const m = pick([0, 15, 30, 45]);
      const len = pick([15, 30, 30, 45, 60, 60, 90, 120]);
      const endMin = Math.min(h * 60 + m + len, 23 * 60 + 45);
      await c.getByLabel('Event title').fill(`${pick(EVENT_TITLES)} #${i + 1}`);
      await c.getByLabel('Date').fill(day(offset));
      await c.getByLabel('Start time').fill(time(h, m));
      await c.getByLabel('End time').fill(time(Math.floor(endMin / 60), endMin % 60));
      await c.getByRole('radio', { name: pick(EVENT_KINDS), exact: true }).click();
      const who = pick(PEOPLE);
      if (who) await c.getByLabel('Attendees or tags, comma separated').fill(who);
      const where = pick(PLACES);
      if (where) await c.getByLabel('Location').fill(where);
      if (rnd() < 0.2) await c.getByLabel('Notes').fill('Agenda: status, risks, decisions.\nDial-in in the invite.');
      await c.getByRole('button', { name: 'Save to calendar' }).click();
      counts.events++;
    } else if (r < 7) {
      const c = await openComposer(page, 'To-do');
      await c.getByLabel('To-do text').fill(`${pick(TODO_TEXTS)} — cal ${i + 1}`);
      await c.getByLabel('Due date').fill(day(offset));
      if (rnd() < 0.25) await c.getByRole('checkbox').check();
      else await c.getByLabel('Due time').fill(time(int(6, 22), pick([0, 15, 30, 45])));
      await c.getByRole('button', { name: 'Save to calendar' }).click();
      counts.todos++;
    } else {
      const kind = r < 9 ? 'Queue' : 'Processing';
      const c = await openComposer(page, kind);
      await c.getByLabel('Item name').fill(`${pick(kind === 'Queue' ? QUEUE_TEXTS : PROC_TEXTS)} ${i + 1}`);
      const url = pick(URLS);
      if (url) await c.getByLabel('Site or link').fill(url);
      await c.getByLabel('Due date').fill(day(offset));
      if (rnd() < 0.2) await c.getByRole('checkbox').check();
      else await c.getByLabel('Due time').fill(time(int(6, 22), pick([0, 15, 30, 45])));
      await c.getByRole('button', { name: 'Save to calendar' }).click();
      if (kind === 'Queue') counts.queue++;
      else counts.processing++;
    }
    await expect(page.getByTestId('cal-composer')).toHaveCount(0); // saved and closed
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log('ADDED', JSON.stringify({ ...counts, total }));
  mkdirSync('qa-artifacts', { recursive: true });
  writeFileSync('qa-artifacts/calendar-500.json', await page.evaluate(() => localStorage.getItem('devdeck') ?? ''));
  expect(total).toBeGreaterThanOrEqual(500);
});

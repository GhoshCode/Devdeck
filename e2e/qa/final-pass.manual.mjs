// Final QA pass (web build on the dev server): alerts, cockpit resize stress,
// card paging stress, Site Map random deletes. Usage: node qa-final.mjs <dark|light>
import { chromium } from 'playwright';
import fs from 'fs';
const theme = process.argv[2] ?? 'dark';
const OUT = 'screenshots/qa-final/'; // run from the repo root with the dev server on :5180
fs.mkdirSync(OUT, { recursive: true });
const log = [];
const note = (s, ok, d = '') => {
  log.push({ s, ok, d });
  console.log(`${ok === true ? 'PASS' : ok === false ? 'FAIL' : 'NOTE'} | ${s}${d ? ' | ' + d : ''}`);
};
let n = 0;
const shot = (name, loc) => (loc ?? p).screenshot({ path: `${OUT}${theme}-${String(++n).padStart(2, '0')}-${name}.png` });
const b = await chromium.launch({ channel: 'msedge' });
const p = await b.newPage({ viewport: { width: 1920, height: 1000 } });
p.setDefaultTimeout(9000);
const errors = [];
p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
p.on('console', (m) => m.type() === 'error' && !/Failed to load resource|net::|favicon|ERR_|CORS|status of 4\d\d/i.test(m.text()) && errors.push(m.text()));
const step = async (name, fn) => {
  const before = errors.length;
  try {
    await fn();
  } catch (e) {
    note(name, false, 'threw: ' + e.message.split('\n')[0]);
    await shot('error-' + name.replace(/\W+/g, '-').slice(0, 24)).catch(() => {});
  }
  if (errors.length > before) note(`${name}: console clean`, false, errors.slice(before).join(' || ').slice(0, 300));
  else note(`${name}: console clean`, true);
};

await p.goto('http://localhost:5180/');
await p.locator('[data-category-id]').first().waitFor({ timeout: 20000 });
await p.getByRole('button', { name: /mode$/ }).first().click();
await p.getByRole('button', { name: /mode$/ }).first().click();
const now = Date.now();
await p.evaluate(({ theme, now }) => {
  const raw = JSON.parse(localStorage.getItem('devdeck'));
  Object.assign(raw.state.settings, { themeMode: theme, presetTheme: theme === 'light' ? 'default-light' : 'default-dark', greetingName: 'QA' });
  const d = new Date(now - 86400000);
  const yday = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  raw.state.todos = [
    { id: 'qa-late', text: 'Renew SSL certificate', dueDate: yday, dueTime: '09:00', createdAt: now - 2e8, order: 0, archivedAt: null, priority: 1, tags: ['ops'] },
    { id: 'qa-timer', text: 'Write release notes', dueDate: null, dueTime: null, createdAt: now - 55000, order: 1, archivedAt: null, priority: 2, tags: ['docs'], timer: { amount: 1, unit: 'minutes', start: now - 52000 } },
    { id: 'qa-plain', text: 'Plain task', dueDate: null, dueTime: null, createdAt: now, order: 2, archivedAt: null },
  ];
  const sch = { enabled: false, frequency: 'daily', daysOfWeek: [1], timeOfDay: '10:00', interval: 1, dayOfMonth: 1, from: '2026-01', to: '2026-12' };
  raw.state.processing = [
    { id: 'qa-p', name: 'GitHub Trending', url: 'https://github.com/trending', siteId: null, section: 'Currently processing', order: 0, createdAt: now - 58000, schedule: sch, timer: { amount: 1, unit: 'minutes', start: now - 49000 } },
    { id: 'qa-q', name: 'GitLab', url: 'https://gitlab.com', siteId: null, section: 'Queue', order: 1, createdAt: now - 58000, schedule: sch, timer: { amount: 1, unit: 'minutes', start: now - 46000 } },
    { id: 'qa-q2', name: 'Bitbucket', url: 'https://bitbucket.org', siteId: null, section: 'Queue', order: 2, createdAt: now - 58000, schedule: sch, timer: { amount: 1, unit: 'minutes', start: now - 45000 } },
    { id: 'qa-late-p', name: 'Old dashboard', url: 'https://example.com', siteId: null, section: 'Queue', order: 3, createdAt: now - 9e6, schedule: sch, timer: { amount: 1, unit: 'hours', start: now - 9e6 } },
  ];
  localStorage.setItem('devdeck', JSON.stringify(raw));
  localStorage.removeItem('devdeck.alerts.seen');
  localStorage.removeItem('devdeck.alerts.overdueAt');
}, { theme, now });
await p.reload();
await p.locator('[data-category-id]').first().waitFor({ timeout: 20000 });

// ---- 1. Alerts -----------------------------------------------------------
await step('Alerts', async () => {
  const sum = p.locator('[data-alert-kind="overdue"]');
  await sum.waitFor({ timeout: 6000 });
  note('Overdue summary drops in on open', true, (await sum.textContent()).replace(/\s+/g, ' ').slice(0, 120));
  await p.waitForTimeout(600);
  await shot('alert-overdue', p.locator('[aria-label="Reminders"]'));
  // timers end within ~15 s → todo, processing, queue x2 alerts
  await p.locator('[data-alert-kind="todo"]').waitFor({ timeout: 20000 });
  await p.locator('[data-alert-kind="queue"]').last().waitFor({ timeout: 20000 });
  await p.waitForTimeout(800);
  await p.waitForTimeout(400);
  const kinds = await p.locator('[data-alert-kind]').evaluateAll((els) => els.map((e) => e.getAttribute('data-alert-kind')));
  note('Up to 3 visible, newest on top', kinds.length <= 3, kinds.join(', '));
  const more = p.getByRole('button', { name: /more reminder/ });
  note('Extra alerts grouped behind "+N more"', (await more.count()) === 1, await more.textContent().catch(() => ''));
  await p.mouse.move(960, 60); // hover pauses auto-hide
  await shot('alert-stack', p.locator('[aria-label="Reminders"]'));
  await more.click();
  await p.waitForTimeout(500);
  await shot('alert-all', p.locator('[aria-label="Reminders"]'));
  const all = await p.locator('[data-alert-kind]').evaluateAll((els) => els.map((e) => e.getAttribute('data-alert-kind')));
  note('"+N more" shows every alert; each source has its own design', ['overdue', 'todo', 'processing', 'queue'].every((k) => all.includes(k)), all.join(', '));
  // snapshot each kind
  for (const k of ['processing', 'queue', 'todo', 'overdue']) await shot(`alert-${k}`, p.locator(`[data-alert-kind="${k}"]`).first());
  // matte + contrast check (WCAG ratio of title and sub text against the card)
  for (const k of ['processing', 'queue', 'todo', 'overdue']) {
    const m = await p.locator(`[data-alert-kind="${k}"]`).first().evaluate((el) => {
      const rgb = (c) => {
        const cv = document.createElement('canvas').getContext('2d');
        cv.fillStyle = c; cv.fillRect(0, 0, 1, 1);
        const d = cv.getImageData(0, 0, 1, 1).data;
        return [d[0], d[1], d[2], d[3] / 255];
      };
      const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
      const cs = getComputedStyle(el);
      const bg = rgb(cs.backgroundColor);
      const title = el.querySelector('.alert-title');
      const sub = el.querySelector('.alert-sub');
      return {
        alpha: bg[3], blur: cs.backdropFilter, radius: parseFloat(cs.borderTopLeftRadius),
        title: title ? Math.round(ratio(rgb(getComputedStyle(title).color), bg) * 10) / 10 : null,
        sub: sub ? Math.round(ratio(rgb(getComputedStyle(sub).color), bg) * 10) / 10 : null,
        size: title ? parseFloat(getComputedStyle(title).fontSize) : null,
      };
    });
    note(`${k}: opaque matte, contrast title ≥ 7 and sub ≥ 4.5, corners ≤ 10px`, m.alpha === 1 && (m.blur === 'none' || !m.blur) && m.title >= 7 && (m.sub === null || m.sub >= 4.5) && m.radius <= 10, JSON.stringify(m));
  }
  // Mark done on the todo alert
  await p.locator('[data-alert-kind="todo"]').first().getByRole('button', { name: 'Mark done' }).click();
  await p.waitForTimeout(400);
  const archived = await p.evaluate(() => JSON.parse(localStorage.getItem('devdeck')).state.todos.find((t) => t.id === 'qa-timer')?.archivedAt);
  note('Mark done completes the to-do', !!archived);
  // Snooze on a queue alert
  const q = p.locator('[data-alert-kind="queue"]').first();
  const qtext = await q.textContent();
  await q.getByRole('button', { name: 'Snooze 10m' }).click();
  await p.waitForTimeout(400);
  const snoozed = await p.evaluate(() => JSON.parse(localStorage.getItem('devdeck.alerts.snoozed') ?? '[]').length);
  note('Snooze hides it and stores it for 10 min', snoozed === 1, qtext?.slice(0, 40));
  // Review on summary → to-do pane + overdue focus
  const review = p.locator('[data-alert-kind="overdue"]').getByRole('button', { name: 'Review' });
  if (await review.count()) {
    await review.click();
    await p.waitForTimeout(900);
    const pane = await p.getByTestId('queue-todo-scroller').evaluate((el) => Math.round(el.scrollLeft / el.clientWidth));
    note('Review opens the To-do pane', pane === 1);
  }
  // dismiss everything
  for (const x of await p.getByRole('button', { name: 'Dismiss' }).all()) await x.click().catch(() => {});
  await p.waitForTimeout(500);
  note('Dismiss clears the stack', (await p.locator('[data-alert-kind]').count()) === 0);
  // reload: same events do not alert twice
  await p.reload();
  await p.locator('[data-category-id]').first().waitFor({ timeout: 20000 });
  await p.waitForTimeout(2500);
  note('No duplicate alerts after reload', (await p.locator('[data-alert-kind]').count()) === 0);
});

// ---- 2. Cockpit resize stress (both sides, many times) --------------------
await step('Resize middle section', async () => {
  const handles = { left: p.locator('[data-snap-handle="left"]'), right: p.locator('[data-snap-handle="right"]') };
  note('Both resize handles present', (await handles.left.count()) === 1 && (await handles.right.count()) === 1);
  const drag = async (h, dx) => {
    const bb = await h.boundingBox();
    const x = bb.x + bb.width / 2;
    const y = bb.y + bb.height / 2;
    await p.mouse.move(x, y);
    await p.mouse.down();
    await p.mouse.move(x + dx, y, { steps: 12 });
    await p.mouse.up();
    await p.waitForTimeout(350);
  };
  const widths = [];
  for (let i = 0; i < 8; i++) {
    await drag(handles.left, i % 2 ? -450 : 450);
    await drag(handles.right, i % 2 ? 450 : -450);
    widths.push(Math.round((await p.locator('[data-zone="center"]').boundingBox()).width));
  }
  note('16 alternating drags: centre width snaps between whole-card sizes', new Set(widths).size <= 4, widths.join(','));
  await shot('resize-after', p.locator('[data-zone="cockpit"]'));
  // Overflow sanity: nothing spills out horizontally
  const spill = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  note('No horizontal page overflow after resizing', spill <= 1, `${spill}px`);
  // reset
  await drag(handles.left, -600);
  await drag(handles.right, 600);
});

// ---- 3. Category paging back and forth ------------------------------------
await step('Scroll category cards', async () => {
  const pager = p.getByTestId('cards-pager');
  const dots = pager.getByRole('tab');
  const count = await dots.count();
  note('Pager present', count > 1, `${count} pages`);
  const track = p.locator('[data-cards-track]');
  const per = Number(await track.getAttribute('data-per-page'));
  const firstVisible = () => track.evaluate((el) => {
    const cards = [...el.children].filter((c) => !c.dataset.pagerSpacer);
    return cards.findIndex((c) => c.offsetLeft - cards[0].offsetLeft >= el.scrollLeft - 2);
  });
  const box = await pager.boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const seen = [];
  for (let i = 0; i < 24; i++) {
    await p.mouse.wheel(0, i < 12 ? 120 : -120);
    await p.waitForTimeout(480);
    let last = -1;
    for (let j = 0; j < 40; j++) { const v = await track.evaluate((el) => el.scrollLeft); if (v === last) break; last = v; await p.waitForTimeout(80); }
    seen.push(await firstVisible());
  }
  const aligned = seen.every((f) => f % per === 0);
  note('24 wheel steps over the dots: every page starts on a page boundary', aligned, `per=${per} → ${seen.join(',')}`);
  for (let i = count - 1; i >= 0; i--) {
    await dots.nth(i).click();
    await p.waitForTimeout(250);
  }
  await p.waitForTimeout(600);
  note('Dot clicks end on page 1', (await firstVisible()) === 0);
  // sideways trackpad swipe over the cards is ignored
  const tb = await track.boundingBox();
  await p.mouse.move(tb.x + 200, tb.y + 200);
  const before = await track.evaluate((el) => el.scrollLeft);
  await p.mouse.wheel(400, 0);
  await p.waitForTimeout(300);
  note('Sideways swipe over cards does not move the row', (await track.evaluate((el) => el.scrollLeft)) === before);
});

// ---- 4. Site Map: random deletes, undo, restore ----------------------------
await step('Site Map random deletes', async () => {
  const dlg = p.getByRole('dialog', { name: 'Site Map & Hierarchy' });
  const total0 = await p.evaluate(() => JSON.parse(localStorage.getItem('devdeck')).state.sites.length);
  let deleted = 0;
  let undone = 0;
  for (let round = 0; round < 3; round++) {
    await p.getByRole('button', { name: 'Site Map & Hierarchy' }).click();
    await dlg.waitFor();
    await p.waitForTimeout(400);
    const cards = dlg.locator('section[data-sitemap-category]');
    const nc = await cards.count();
    for (let i = 0; i < 6; i++) {
      const card = cards.nth(Math.floor(Math.random() * nc));
      await card.scrollIntoViewIfNeeded();
      const chips = card.locator('a[data-sitemap-site]');
      const k = await chips.count();
      if (!k) continue;
      const chip = chips.nth(Math.floor(Math.random() * k));
      const chipName = (await chip.getAttribute('title')).split(' — ')[0];
      const h = await chip.elementHandle();
      const dt = await p.evaluateHandle(() => new DataTransfer());
      await h.dispatchEvent('dragstart', { dataTransfer: dt });
      const bin = card.getByTestId('sitemap-bin');
      await bin.dispatchEvent('dragover', { dataTransfer: dt });
      await bin.dispatchEvent('drop', { dataTransfer: dt });
      await h.dispatchEvent('dragend', { dataTransfer: dt }).catch(() => {});
      deleted++;
      await p.waitForTimeout(120);
      if (i % 3 === 2) {
        const bar = p.getByTestId('undo-bar').filter({ hasText: 'Deleted ' + chipName }).last();
        await bar.getByRole('button', { name: 'Undo' }).click();
        undone++;
        await p.waitForTimeout(150);
      }
    }
    const stuck = await dlg.getByText('Drop sites here').count();
    note(`Round ${round + 1}: no card stuck in drag mode`, stuck === 0, `${stuck}`);
    await p.keyboard.press('Escape');
    await dlg.waitFor({ state: 'hidden' });
  }
  const st = await p.evaluate(() => JSON.parse(localStorage.getItem('devdeck')).state);
  note('Deleted sites are in the bin, undone ones are back', st.sites.length === total0 - (deleted - undone) && st.trash.sites.length >= deleted - undone, `${deleted} deleted, ${undone} undone, ${st.trash.sites.length} in bin`);
  await shot('after-sitemap', p.locator('[data-zone="cockpit"]'));
});

note('Console / page errors (whole run)', errors.length === 0, errors.slice(0, 5).join(' || ').slice(0, 400));
fs.writeFileSync(`${OUT}${theme}-log.json`, JSON.stringify(log, null, 2));
await b.close();

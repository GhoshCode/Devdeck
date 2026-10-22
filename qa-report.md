# DevDeck — QA report (vfinal2.0, 2026-10-22)

**Date:** 2026-10-22 · **Branch:** `vfinal2.0` · **Tester:** Claude (end-user walk-throughs driven through the real UI, plus visual review)
**Scope:** the full release candidate for today's deploy, with a heavy-data pass on the sites panel (Queue / Currently processing) and the full-screen calendar.
**Previous report:** the 2026-10-20 `vfinal-qa-fixes` report is in git history (`git log -- qa-report.md`).

---

## 1. Verdict

**Ready to deploy**, with the caveats in §7.

Every issue found in this pass is fixed and re-tested at full load. The final runs:

| Suite | Result |
|---|---|
| Unit tests (Vitest) | **265 / 265 passed** |
| End-to-end, Chromium (Playwright, every user-facing feature) | **100 / 100 passed** |
| Extension in a real Chromium (`dist/` loaded unpacked) | **4 / 4 passed**: new-tab override, service worker and alarms; Alt+Enter hand-off to Gemini, ChatGPT and Claude with a 45-line prompt |
| Heavy load: 500 sites through the sites panel, then the calendar | **Passed**, 12.4 min, no console errors |

The only test that ever fails intermittently is the quote shuffle. It depends on the live quotes API and passes on retry. It was flaky before this round too.

---

## 2. Environment

| | |
|---|---|
| OS | Windows 11 Home |
| Browsers | Playwright Chromium (e2e, extension), Microsoft Edge channel (QA project), the Claude desktop built-in browser (hands-on checks) |
| Viewports | 1920 × 1080 (main), 1600 × 900 and 1440 × 900 (narrow checks), 1512 × 982 (QA project default) |
| Themes | Obsidian Violet (dark, default), Nature Ocean (teal), light |
| Builds | Vite dev server for the e2e suite. For the heavy load, a **frozen production build** served by `vite preview` on port 4300, so code changes during testing could not reload the page under the test (that happened once; see §5.1). |

---

## 3. How the heavy-data pass was done

You asked for data to go in **the way a person adds it**, one item at a time through the UI, not written into storage. Both loaders do exactly that, through the same controls a user clicks.

### 3.1 500 sites through the sites panel (`e2e/qa/processing-500.spec.ts`)

Run with: `QA_URL=http://localhost:4300 PROC500=1 npx playwright test --project=qa e2e/qa/processing-500.spec.ts`

For each of 500 sites, the loader:

1. Opens the sites panel from the **Queue box's settings button**.
2. Clicks the list (alternating **Currently processing** and **Queue**).
3. Types a library site's name, or pastes a URL once the library runs out, and presses Enter.
4. In the site's editor, clicks a frequency and sets a time of day and days of the week; for monthly ones it picks the day of the month from the dropdown.

Result: 500 sites, with 231 daily, 123 weekly, 66 monthly and 80 hourly reminders, at times from 06:00 to 22:45 on varied days.

| Measure | Value |
|---|---|
| Adding a site (type and press Enter, until it's saved) | 0.12–0.34 s throughout; slowest 0.64 s at about 480 sites |
| Total for 500 sites, with reminders set | about 11 minutes |

Then it opens the full-screen calendar and:

- walks Day, Week, Month and Agenda;
- steps through weeks;
- opens a reminder group;
- checks the month "+ N more" links and the agenda cards;
- saves screenshots to `docs/qa-2026-10-22/`.

### 3.2 Hands-on in the built-in browser

The same flow by hand in the Claude desktop browser: open Manage from the Queue box, type, press Enter, change the list, paste a URL, open a reminder editor, read what's on screen. This is where the panel problems in §4.1 were first seen.

### 3.3 Mixed calendar load (`e2e/qa/calendar-500.spec.ts`)

Run with `CAL500=1`. Through the to-do box (natural language such as "Ship notes #launch !p1 tomorrow 5pm") and the calendar's **Schedule** composer, it adds 120 to-dos, 30 sites, 160 events, 120 calendar to-dos, and 80 each of queue and processing items, across −3 to +6 weeks. It was written and run once in this pass. That run stalled when code edits hot-reloaded the dev server under it, so it did not finish (see §5.1). It hasn't been re-run since the frozen-build setup, and none of the results in this report come from it.

---

## 4. Findings and fixes

Severity: **S1** blocks a task · **S2** wrong or misleading result · **S3** hard to use · **S4** polish.

### 4.1 Sites panel (Queue / Currently processing)

| # | Sev | What a user saw | Cause | Fix |
|---|---|---|---|---|
| P1 | **S1** | In the Queue box's settings, the list dropdown only offered **"Currently processing"**, so there was no visible way to put a site into Queue. | The list field was a type-ahead box (`<input list>`). It only suggests entries matching what is already typed, and it starts with "Currently processing" typed in, so "Queue" never appears. | **Panel redesigned.** Lists are buttons (Currently processing, Queue, every other list, "+ New list"), all always visible. Moving a site uses a dropdown that lists every list. |
| P2 | S2 | Opening Manage **from the Queue box** was titled "Currently processing", and new sites went into Currently processing. | The panel had no idea where it was opened from. | From the Queue box it opens on **Queue**; from Currently processing, on that. Title: "Your sites". |
| P3 | S2 | The same site could be added to a list over and over (your screenshot had **Nextjs three times**). | The duplicate check only looked at library sites, and only when matching by name. | Library sites and pasted addresses are checked against the chosen list. Already-added sites show **"Added to Queue"** and can't be clicked. |
| P4 | **S2** | **Every new reminder stopped at the end of the current month** ("October 2026 → October 2026"), without warning. | The default schedule used this month as both the start and the end month. | New reminders have **no end** (the editor shows "no end"). A one-time **v3 migration** opens up existing reminders whose start and end month are the same; ranges you chose yourself (e.g. Oct–Jan) are kept. Unit-tested. |
| P5 | S3 | The list field was too narrow ("Currently p…"); the panel was a 400 px side drawer, cramped with many sites. | Layout. | A **centred two-column panel** (up to 1040 × 760): add on the left (list, search or paste, starting reminder), your lists on the right (tabs with counts, a find box, each site's editor). It stacks into one column in narrow places such as Settings → Processing. |
| P6 | S4 | Every new site needed its reminder set by hand. | No starting choice. | **Starting reminder** buttons: Weekdays 9:00 · Every day 9:00 · Mondays 9:00 · No reminder. |

### 4.2 Full-screen calendar under load (500 scheduled sites)

| # | Sev | What a user saw (before) | Cause | Fix | After |
|---|---|---|---|---|---|
| C1 | **S1** | **Week view:** 210–272 tiny unreadable capsules per day, a wall of noise. | Every reminder occurrence drawn on its own; hundreds share the same few times. | **Reminders that fire at the same moment are one item**: "5 reminders · Figma, Netlify, Pypi…". Click it for the list; click a site to edit it. Search and filters still see each reminder. | ~65 readable items per day ([week](docs/qa-2026-10-22/p500-cal-week.png)) |
| C2 | **S1** | **Day view:** a diagonal staircase of chips cut off at the edges ("Datadog…", "Aws 1…"). | Same cause: dozens of overlapping blocks per slot. | Same grouping. | One clear row per time ([day + list](docs/qa-2026-10-22/p500-cal-stack.png)) |
| C3 | **S2** | **Month view:** each day showed 3 chips and **no "+ N more"**, so days with 272 items looked like 3. | The "how many chips fit" maths used a 21 px chip height; real chips are 29 px with the gap. The "+ more" line was pushed out of the cell and hidden. | Real chip height. | Every day shows "+ 60…64 more" ([month](docs/qa-2026-10-22/p500-cal-month.png)) |
| C4 | **S2** | **Agenda:** rows showed only "Today · 10:15a" and a badge, with **the name missing**. | Cards sat in a scrolling flex column and were allowed to shrink; with many cards they squashed to about 30 px and clipped their own title. Invisible with light data. | Cards keep their height (`shrink-0`). | Names readable ([agenda](docs/qa-2026-10-22/p500-cal-agenda.png)) |
| C5 | S2 | **Slow:** about 2 s to open or switch views, **4.5 s to step a week**. | Thousands of items laid out and drawn per view. | Grouping cuts what is drawn (the day view now holds 66 items). | Open **0.6 s**, views **0.6–0.9 s**, week step **~1.0 s** |

### 4.3 Found during the heavy run

| # | Sev | What happened | Cause | Fix |
|---|---|---|---|---|
| A1 | **S1** | Around site 200, reminders started firing, and the sites panel's list buttons **stopped responding to clicks**. | The blurred backdrop behind the reminder pop-ups covered a 980 px strip at the top of the screen and **swallowed clicks**, including on a dialog underneath. | The backdrop is visual only; clicks pass through it. The reminder cards themselves stay clickable. Re-tested by the full 500-site run. |

### 4.4 Other changes in this round (built and tested)

| Area | Change | Test |
|---|---|---|
| Quick-links bar | **Six-dot grip** on the right edge opens a panel of every other and recent site (up to **15**). Drag down or click to open; drag the panel's **bottom edge** up to close (the inside doesn't drag). The panel follows the pointer, then **eases out** (0.32 s, no bounce). While it's open the bar keeps only the 5 fixed sites, with nothing shown twice. The panel uses the bar's glass, darker and blurred, so it matches the theme (checked on violet and teal: [violet](docs/qa-2026-10-22/panel-default-dark.png), [teal](docs/qa-2026-10-22/panel-nature-ocean.png)). | e2e: drag-open mid-way tracks the pointer; edge-close; inside-drag does nothing; no duplicates; ≤ 15 |
| Card pins | The pin on a card's main sites is just the icon, with no circle. | visual |
| Quick links | 5 fixed links (topped up from your most-visited when fewer are set); the rest scroll beside them; the bar fills up to the terminal. Narrow screens: the terminal narrows first, and fixed chips scroll rather than being cut. | e2e + 1440 / 1600 / 1920 checks |
| Card modes | Opens on 2 balanced cards; the edge tabs cycle 2 → 1 → 3 and drag by whole cards; the outside bars resize freely. Tabs hide when only one mode fits. | e2e |
| Greeting | Plain "GOOD MORNING…" on load; click = next style, right-click = another phrase. | e2e |
| Search | Long text: one line with "…" in the bar and a darker panel below (50% wider) holding all of it; voice typing appends; suggestions sit above the terminal. | e2e |
| CPU temperature | Shown when Chrome reports it (ChromeOS); nothing on Windows or macOS. | e2e with a stubbed `chrome.system` |
| Alt+Enter | A 45-line prompt reaches Gemini, ChatGPT and Claude complete and in order, and is sent. | extension e2e on stand-in pages |

---

## 5. Problems in the test setup itself (none in the app)

1. **Hot reload under a running test.** The first calendar loader ran on the dev server while code was being edited. Each save reloaded the page and the run stalled. Since then, heavy runs use a frozen production build on its own port.
2. **Wrong control type.** The first 500-site attempt looked for a plain text field for the list, which was a combobox, and waited 90 minutes on site 1. Fixed in the loader, and every step now has a 15 s limit so a miss fails fast.
3. **"5th day" also matched "15th day" and "25th day".** Fixed with exact matching.
4. **Real AI site reached.** An early Alt+Enter test reached the real gemini.google.com (signed out, throwaway profile) because Playwright's routing does not catch tabs the extension opens itself. A test prompt may have been sent to Gemini anonymously. The test now blocks those host names entirely (`--host-resolver-rules`).

---

## 6. Screenshots (final run, 500 sites, 1920 × 1080)

| View | File |
|---|---|
| Dashboard after the load | [p500-dashboard.png](docs/qa-2026-10-22/p500-dashboard.png) |
| Week | [p500-cal-week.png](docs/qa-2026-10-22/p500-cal-week.png) |
| Day, with a reminder group opened | [p500-cal-stack.png](docs/qa-2026-10-22/p500-cal-stack.png) |
| Month | [p500-cal-month.png](docs/qa-2026-10-22/p500-cal-month.png) |
| Agenda | [p500-cal-agenda.png](docs/qa-2026-10-22/p500-cal-agenda.png) |
| Quick-links panel, violet / teal | [panel-default-dark.png](docs/qa-2026-10-22/panel-default-dark.png), [panel-nature-ocean.png](docs/qa-2026-10-22/panel-nature-ocean.png) |

---

## 7. Known limits and recommendations (not blocking)

1. **Week view is still dense at 500 sites.** It is readable and fast, but each day holds about 65 grouped items in two columns, and labels truncate ("3 remind…"). Option: group by hour in the week view only ("9a · 14 reminders").
2. **"Every minute" reminders.** Your own data has some. Each one raises an alert every minute in its hours, which crowds the reminder stack. Consider removing "Minute" from the frequency choices, or capping how many minute reminders can be active.
3. **Briefing counters ignore reminders by design.** The top strip says "Processing due 0" and "Zero collisions today" even with 66 reminders that day, because it counts due dates and meetings only. Consider a "Reminders today N" counter.
4. **Hourly reminders are not on the calendar grid** (by design: they are a rhythm, not appointments). They still alert.
5. **Not tested here:**
   - Linux Chrome (not available on this machine).
   - The real AI sites with your sign-in. If a site changes its page, the prompt may land without being sent; one Alt+Enter per AI after deploying confirms it.
   - Light theme for the new sites panel (styles exist and the dark theme was checked).
6. **Existing user data:** the v3 migration runs once on first load after deploy. It only changes reminder ranges whose start and end month are the same.

---

## 8. Files

- Loaders and checks: `e2e/qa/processing-500.spec.ts` (PROC500), `e2e/qa/calendar-500.spec.ts` (CAL500), `e2e/qa/ai-handoff.spec.ts`, `e2e/system-stats.spec.ts`.
- New and updated end-to-end tests: `e2e/processing.spec.ts` (sites panel), `e2e/cockpit-tools.spec.ts` (quick-links panel, card modes, links row), `e2e/search.spec.ts`.
- Code:
  - `src/components/processing/ProcessingEditor.tsx`, `ProcessingPanel.tsx` (sites panel);
  - `src/lib/calendar.ts` (`groupReminders`) and `src/components/calendar/*` (reminder list, month, agenda);
  - `src/components/ui/AlertCenter.tsx` (backdrop);
  - `src/store/store.ts` (no-end default, v3 migration);
  - `src/components/links/LinksStrip.tsx` (quick-links panel).

# DevDeck — QA report (vfinal-qa-fixes)

**Date:** 2026-10-20 · **Branch:** `vfinal-qa-fixes` (from `vfinal` = `v8.1` @ `42d8ad7`)
**Tester:** Claude (automated end-user walk-throughs + visual review) · **Strategy:** [qa-strategy.md](qa-strategy.md)
**References:** [implementation.md](implementation.md), [features-functionality.md](features-functionality.md), [ui_layout_analysis.md](ui_layout_analysis.md). There is no `design.md` in the repo; the design notes live in those three files.

## 1. Environment

| | |
|---|---|
| OS | Windows 11 (dev machine) |
| Browsers | Microsoft Edge (Chromium) for the website runs; Playwright Chromium with `dist/` loaded unpacked for extension runs |
| Viewports | 1920×1000 (website scenarios), 1600×950 (extension), 1650×950 (e2e suite) |
| Themes | Dark and light, each scenario run in both |
| Data | Fresh profile with seeded library (13 categories, 260+ sites); scenario-seeded to-dos, timers and bookmarks |

Linux Chrome, the primary target, was **not** available on this machine. See §6.

## 2. Summary

| Check | Result |
|---|---|
| TypeScript (`tsc -b`) | Clean |
| Unit tests (Vitest) | **229 / 229** pass |
| Browser e2e suite (`chromium`, 90 tests) | **90 / 90** pass (serial re-run after the offline fix; 4 load-related failures in a parallel run passed serially) |
| QA project (`qa`: baseline, full pass both themes, console-clean, extension, bookmarks, responsive) | **34 / 34** pass |
| Perf budgets (`qa-perf`) | Dark passes; light: theme switch and Settings open exceed the worst-frame / janky-frame budget on this machine (recorded, not a functional failure) |
| Scenario: final pass (alerts, resize, paging, Site Map deletes) | **26 / 26** dark · **26 / 26** light |
| Scenario: bookmarks panel + Tree View (in the extension) | **26 / 26** dark · **26 / 26** light |
| Browser console errors across all scenarios | **0** |

## 3. What was tested, step by step

### 3.1 Reminder alerts (new) — `e2e/qa/final-pass.manual.mjs` §1

The scenario seeds data that fires each alert type for real:
- an overdue P1 to-do (yesterday 09:00);
- a P2 to-do with a 1-minute timer about to end;
- a Currently processing item, two Queue items, and an overdue Queue item, each with a timer.

1. On opening, the **overdue summary** drops in: "You have 2 overdue items", the names, and counts To-dos 1 · Queue 1 · Currently processing 0. ✔
2. Within about 15 s, the to-do, Currently processing and two Queue alerts arrive.
   - At most **3 are visible**, newest on top. ✔
   - The rest sit behind "+1 more reminder". ✔
3. "+N more" expands the list, and all four designs are present. ✔
4. **Glass check:** computed `backdrop-filter: blur(28px) saturate(1.7)`, a 1 px hairline border, and an accent-tinted translucent background. ✔
5. **Mark done** on the to-do alert archives the task. ✔
6. **Snooze 10m** hides it and stores it to come back. ✔
7. **Review** on the summary opens the To-do pane. ✔
8. **Dismiss** clears the stack. ✔
9. **Reload:** the same events don't alert twice. ✔
10. Visual review (screenshots `screenshots/qa-final/*-alert-*.png`): each design is readable in both themes.

Found and fixed:
- **Gap on exit:** the closing card held its space, leaving a visible gap until the animation ended. Now `popLayout`; the others close up smoothly.
- **Light theme:** the overdue clock icon had too little contrast.

### 3.2 Middle section resize stress — §2
1. Dragged the left and right cockpit handles 450 px in alternating directions, **16 times**.
   - The centre width only ever snapped between whole-card sizes (468 ↔ 1298 px). ✔
   - No horizontal page overflow (0 px). ✔
   - No console errors. ✔

### 3.3 Category cards scrolling back and forth — §3
1. **24 wheel steps** over the page dots (12 forward, 12 back).
   - After each scroll settled, every page started exactly on a page boundary (cards 0, 3, 6, 9, 12 at 3 per page). ✔
   - An earlier failing reading came from sampling mid-animation, not a bug.
2. Clicking every dot from last to first ends on page 1. ✔
3. A sideways trackpad swipe over the cards doesn't move the row. ✔
4. No console errors. ✔

### 3.4 Site Map random deletes — §4
1. Three rounds of opening the Site Map. Each round, 6 random sites from random categories were dropped on their card's recycle bin, with **Undo** on every third.
   - 18 deleted, 6 undone. ✔
   - The site count and bin contents match exactly. ✔
   - No card stuck in drag mode. ✔
   - Esc closes the map. ✔
   - No console errors. ✔

### 3.5 Browser bookmarks — `e2e/qa/bookmarks.manual.mjs` (inside the built extension)

The test seeds a 4-level tree through the real `chrome.bookmarks` API:
- Bookmarks bar ▸ Work ▸ Frontend ▸ Frameworks ▸ 3 sites;
- an 11-site Reading folder;
- loose sites in Bookmarks bar and Other bookmarks.

| # | Step | Result |
|---|---|---|
| 1 | The panel lists the browser's folders; expanding reaches level 4 | ✔ |
| 2 | **+** has the tooltip "Add sub folder" and sits left of Edit, then Delete | ✔ |
| 3 | Add a sub folder, rename a folder, **+ Add folder** (first level): each change lands in the browser | ✔ |
| 4 | Filter "svelte" shows only the match, with its folder path | ✔ |
| 5 | Delete a non-empty folder → confirmation → deleted → **Undo** restores the folder and its sites | ✔ |
| 6 | A bookmark created by the browser appears in the panel live | ✔ |
| 7 | Tree View: real-mouse drag of a site to another folder; the ghost follows, the target highlights, the browser updates | ✔ |
| 8 | Drag a whole folder (with its sites) to another folder | ✔ |
| 9 | Drop a folder into its own sub folder: red "can't move here" and nothing moves | ✔ |
| 10 | Esc during a drag cancels it; Esc again closes Tree View and the panel stays | ✔ |
| 11 | **6 rapid back-and-forth moves** of one site end in the right place | ✔ |
| 12 | Pan (drag the background), wheel zoom, "+N more" on long folders | ✔ |
| 13 | Console errors | **0** ✔ |

Found and fixed: in **light theme**, the drop-target highlight was overridden (you couldn't see where a drop would land), and "+N more" and the fold buttons were white on white.

### 3.6 Automated e2e suite (`npm run test:e2e`)
Specs made stale by intended UI changes were updated to the current behaviour:
- **Browser bookmarks:** the "Bookmarks and site map" library drawer became the browser-bookmarks panel.
  - Website tests now check the "needs the extension" state.
  - The real panel is covered by the new `e2e/qa/bookmarks.spec.ts`.
  - The Recent-strip test now opens a site through the Site Map search.
- **"Focus" → "Currently processing":** region names updated.
- **Topic chips:** now multi-select toggles. The test covers selecting 2 topics ("2 topics") and **All**.
- **Card row:** scrollbar → page dots (`cards-pager`).
- **Overview:** it replaces the cards, so they are counted before opening it.
- **Multi-Timezone (Settings):** the picker starts empty and adds 2 cities from the world search, in 24-hour time.

## 4. Defects found in this pass

| # | Area | Severity | Status |
|---|---|---|---|
| 1 | Alerts: a closing alert left a gap until its exit animation finished | Low | Fixed (`popLayout`) |
| 2 | Alerts: low-contrast overdue icon in light theme | Low | Fixed |
| 3 | Tree View (light): drop-target highlight invisible | Medium | Fixed |
| 4 | Tree View (light): "+N more" and fold toggles invisible | Low | Fixed |
| 5 | Settings zone picker didn't match the clock face (28 preset cities, 3 zones, 12-hour) | Medium | Fixed: world search, 2 zones, 24-hour |
| 6 | 16 e2e specs stale after intended UI changes | — | Updated |
| 8 | Offline banner stayed after the network returned (worker unreachable → every request failed) | High | Fixed: `netFetch` falls back to direct fetch |
| 9 | Offline veil let sites behind it be clicked | Low | Fixed: veil blocks clicks |
| 10 | QA specs stale (due chip, theme pills, graph label) | — | Updated |
| 7 | e2e flakiness: 2 theme tests timed out under full-suite load; 1 used a fixed 200 ms wait for a view-transition theme change | Low | Fixed (60 s budget; wait for the attribute) |

No High-severity defects are open. Open: light-theme perf budget for theme switch / Settings open (Low).

## 5. Not covered / for your manual review
- **Linux Chrome** (the primary platform), including the terminal helper with `python3`.
- Real system notifications: switch tabs while a reminder is due, and confirm you get one system notification and no glass alert.
- Snooze actually returning after 10 real minutes (unit-tested with a mocked clock).
- Real-mouse HTML5 drags in the Site Map (automation dispatches drag events). Tree View drags were real mouse drags.
- A large real bookmark profile (hundreds or thousands of bookmarks) for panel and Tree View smoothness.

## 6. Artefacts
- Screenshots: `screenshots/qa-final/` (alerts, resize, Site Map), `screenshots/qa-bookmarks/` (panel, Tree View). Both themes.
- Scripts: `e2e/qa/final-pass.manual.mjs`, `e2e/qa/bookmarks.manual.mjs`, `e2e/qa/bookmarks.spec.ts`.

# DevDeck — Implementation log

Technical record of what was built, where it lives and why. Newest round first.
User-facing behaviour and the manual test checklist are in
[features-functionality.md](features-functionality.md).

Branch: `v8.1` · Stack: Vite + React 19 + TypeScript, Zustand (persisted to
`localStorage["devdeck"]`), Tailwind v4, motion/react, dnd-kit, MV3 extension
(`npm run build` → `dist/`, load unpacked).

---

## Round 2026-10-20l — work panel, AI shortcut, alert polish (branch `vfinal2.0`)

- **Work panel** (`processing/WorkBoard.tsx`, `lib/workBoard.ts`):
  - Opened with `openBoard({ tab, focus?, archive?, focusInput? })`, an event that `WorkBoardHost` (mounted in `App`) listens for.
  - Holds three panes (Currently processing → Queue → To-do) in a snap scroller; tabs (sliding pill), dots, horizontal wheel/swipe and ←/→ switch between them. 1080 × 86vh; closes on Esc, a click outside or after 30 s idle.
  - Processing / Queue panes are `WorkList` + `WorkCard`: favicon, host, due/overdue, next reminder + schedule, live timer, age; Open / Timer / Move to Queue ↔ Start processing / Remove (undo); stats chips; Manage opens `ProcessingManager` (now exported).
  - The To-do pane is `TodoWidget board`, which renders the old pop-up's content and accepts `initialFocus`, `initialArchive` and `focusInput`. The old to-do pop-up and its idle/Esc logic were removed.
  - Expand buttons: on the Currently processing card (top-right), and in the Queue footer (before the cog). The to-do card's expand, + and archive buttons open the To-do tab.
  - The overdue alert's Review opens the To-do tab with overdue tasks first. On other websites, the worker opens `index.html#review`.
- **Search:** Ctrl/⌘+Enter (or Alt+Enter) sends the text to the chosen AI. Hints appear in the placeholder, the suggestions footer and the composer footer.
- **Top bar:**
  - The clock box is 424 × 148 (was 380 × 132), or 312 × 102 on short screens.
  - The UV badge is stacked under the temperature.
  - On this day has an always-visible refresh icon at the line end, dimmed when there's only one event.
- **Settings → Greeting:** "Show On this day line" and "Show quote line" checkboxes now sit under the style picker; the old toggles were removed.
- **Alerts:**
  - A time-left line (`[data-life]::after`, `--life`) shrinks right → left over the card's life and pauses on hover.
  - `.alert-shield` (frosted, masked, `pointer-events-auto`) sits behind the stack while any alert is up.
- **Mini calendar:** double-clicking the month or year opens Month and Year wheels side by side (1900–2200, snap-centred, › ‹ marker). A click sets the value; double-click/Enter closes the wheels; Esc closes the wheels first.

## Round 2026-10-20k — type-to-capture search, Clear all, Command Calendar (branch `vfinal2.0`)


- **Type-to-capture** (`hooks/useTypeToCapture.ts`): a window `keydown` listener. `capturedText()` ignores focused fields (input / textarea / select / contentEditable), named keys (Shift, F1–F12, Escape, Tab, arrows, Enter…), Ctrl/⌘/Alt shortcuts (AltGr still types), the page hotkeys `/` and `,`, and Space on a focused button. A `paste` listener handles Ctrl/⌘+V outside a field. Nothing is captured while a dialog is open.
- **Search composer** (`SearchBar.tsx`): the input is now an auto-sizing `<textarea>` (still `role="combobox"`, `aria-label="Search"`). Over 65 characters, a newline or horizontal overflow shows a small expand button at the bottom-right. Expanded, the drawer covers the whole search row (max 280 px, own scrollbar, line/char count) with the actions in its footer. Shift+Enter adds a line, Enter submits, Esc collapses, and the text is kept. Long or multi-line text skips Google suggestions.
- **Clear all** (`AlertCenter.tsx`, `alertStore.clearAllAlerts`): a glass pill under the stack while 2+ alerts are up. The cards slide out with a 40 ms stagger (200 ms each), and the pill fades out at ≤1 alert. Cleared alerts stay gone after reload because every alert is marked seen when pushed.
- **Calendar data**:
  - `CalendarEvent` (title, date, start/end, category meeting/call/vip/deep-work/deadline/travel, priority, attendees/tags, location, notes, `remindMins`) lives in persisted `events`; it is normalised on load and import.
  - `ProcessingItem` gains `dueDate`/`dueTime`; Queue = any section other than Currently processing.
  - Store actions: `addEvent`, `updateEvent`, `deleteEvent` (with undo) and `reinsertEvent`.
  - `settings.calendar` remembers the view and the second time zone.
- **Engine** (`lib/calendar.ts`, React-free, unit-tested):
  - `collectItems` merges events, dated to-dos, Processing/Queue dues and daily/weekly/monthly reminder occurrences (minute/hourly reminders stay off the grid);
  - `layoutColumns` places overlaps side by side;
  - `findConflicts` flags overlaps involving an event, plus local hours with more than 3 dues;
  - `freeGaps` and `focusShieldSlot` find a 2-hour block ending by 23:45;
  - `briefing` gives the KPIs: focus = free 30-minute-plus gaps in 08–20 plus remaining deep work; risk = booked share plus conflicts and a pile of dues;
  - `workload` drives the month heat;
  - `agenda` groups items into next 2h / later today / deadlines, with a passed due time listed once as overdue;
  - `autoResolve` moves colliding dues to the next free same-length slot, never meetings.
- **Command Calendar UI** (`components/calendar/`, styled after `pro_workspace_command_calendar.tsx`):
  - opens full screen from the launcher bar above Currently processing;
  - command bar: filter box `/`, Focus Shield, New item, alert-stack toggle;
  - KPI strip: clickable filter pills, conflict radar with Auto-resolve, dual time zone, view switcher;
  - canvas: day chips, legend filters, Day/Week time grid (72/52 px per hour, Now line, hover hint, click or drag to create), Month capacity heatmap and the three-lane Agenda;
  - `AlertStack` side panel: live alerts plus the next 24 h;
  - centred `CalendarComposer`: new event / to-do / Queue / Processing item, scheduling of existing items, and item details;
  - scoped `--cc-*` tokens built from the theme: frosted glass over the live backdrop (`--color-base` / `--color-base-elevated`), with every primary colour derived from `--color-accent`. Meetings wear the accent; the other categories keep their own colours.
- **Mini calendar** (`MiniCalendar.tsx`): a square button beside the Calendar bar opens a plain month calendar in macOS-style glass (traffic lights, accent-glow today, ISO week numbers, live clock, picked-day footer). It isn't bound to events. Keys: arrows, PgUp/PgDn, T; Esc closes.

- **Calendar alerts**:
  - `AlertKind 'calendar'` from `upcomingEvents(…, events)`, firing at start − `remindMins`;
  - in-page `CalendarPill` (rounded-full, spinning category ring, ringing bell, live countdown, Acknowledge / Snooze 5m / Jump to slot) that stays until acted on;
  - the same capsule in `alertOverlay.ts` for other websites;
  - the worker snoozes calendar alerts for 5 minutes and opens `index.html#cal=date:id`.
  - Processing/Queue due times fire through the existing spotlight/pill designs (`· DUE`).

## Round 2026-10-20j — On this day, API quotes, All categories by the links bar, store packaging


- **On this day** (`services/onThisDay.ts`, `DateGreet.tsx` `OnThisDay`):
  - Wikipedia's On this day feed (`/api/rest_v1/feed/onthisday/all/MM/DD`), cached per day in `devdeck.onthisday.v1`;
  - filtered to tech: events matching `TECH_EVENT` first, then births/deaths of computer scientists, programmers and tech inventors; YouTube personalities excluded;
  - one at a time, 13 px (quote is 12 px); ↻ on hover shows the next; the text links to the Wikipedia article;
  - hidden when there's nothing for today or the feed fails; toggle in Appearance (`showOnThisDay`).
- **Quotes** (`services/quotes.ts`): DummyJSON quotes API (1,454 quotes). Today's quote is `/quotes/{id-from-date}`, cached for the day in `devdeck.quote.v1`; ↻ fetches `/quotes/random`. The built-in list is only an offline fallback.
- **All categories**: a standalone `glass-raised` button left of the quick-links bar in `App.tsx`, the same height as the bar (24 px icon, `px-2`; label from `xl` up). It sits in the same row as the bar, so it moves as the centre column resizes. Toggles the overview. Removed from the cards footer.
- **Store readiness:**
  - fonts are bundled with `@fontsource` (`src/fonts.ts`), so there's no Google Fonts request;
  - the manifest has `host_permissions` `<all_urls>` only, no `optional_host_permissions`, no `extension_ids` on web-accessible resources, plus `short_name`, `minimum_chrome_version` 116 and a new description;
  - `npm run package` builds and zips `dist/` to `release/devdeck-<version>.zip` with root-level, forward-slash paths;
  - `PRIVACY.md` and `STORE_LISTING.md` added.

## Round 2026-10-20i — offline banner no longer sticks; offline veil blocks clicks

- `lib/netFetch.ts` is fail-safe: if the service worker can't be reached
  ("Receiving end does not exist", e.g. after an extension reload) or doesn't
  answer within 8 s, the page fetches directly and bypasses the proxy for 60 s
  (`markProxyDown`). A missing worker no longer looks like "you're offline",
  so feeds, GitHub and weather load.
- `lib/faviconStore.ts`: a failed favicon request marks the proxy down; while
  it's down the snapshot returns `DIRECT` and `Favicon` uses the normal image.
- `ui/OfflineBanner.tsx`: the veil is `pointer-events-auto`, so sites behind
  it can't be clicked while offline; copy updated.
- QA specs updated for current UI (due chip "Tomorrow", theme filter pills,
  contribution-graph label).

## Round 2026-10-20h — no console errors from refused network requests

- **Cause:** opening Settings → Scraping showed "Failed to load resource: 403". That was not the tab itself. The feed reload hit Hacker News's API (hn.algolia.com), which refuses bursts (the demo build has 210 sources). Chrome logs every refused request made by a page as a console error; GitHub rate limits, weather outages and the offline probe can do the same.
- **Fix** (`lib/netFetch.ts` new, `background.ts`):
  - in the extension, every data request (feeds, GitHub, weather, search suggestions, the offline probe) goes to the service worker (`devdeck:fetch`), which fetches it and returns status, headers and body;
  - the page rebuilds a normal `Response`, so callers still see 403 / 404 / 429 and report them (e.g. the feed tooltip), but nothing is logged in DevDeck's console;
  - only http(s) URLs with string or no bodies are proxied; anything else, and the website build, use plain `fetch`;
  - abort signals and timeouts still work.
- **Verified** (built extension, demo data with 210 sources, fresh profile): 0 console errors, warnings or failed requests after load, after opening Settings → Scraping, and 20 s of feed loading. Feeds fill normally.

---

## Round 2026-10-20g — to-do card at narrow widths, more room for items

- **To-do card as a container** (`TodoWidget.tsx` `@container/todo`, `TodoRow.tsx`): rows and the footer respond to the card's own width.
  - **The problem:** with the category cards taking three columns, the left column is 200–250 px and to-do rows overlapped (text squeezed to nothing).
  - **Task text** keeps a minimum width (3.5rem, or 4.5rem at ≥ 240 px) and truncates with "…"; the row clips instead of overlapping.
  - **Extras appear only with room:**
    - tags and "+N": ≥ 360 px;
    - subtask count and notes mark: ≥ 330 px;
    - P1/P2/P3 label: ≥ 280 px (the priority bar on the left still shows it).
  - **Due chip below 240 px:** drops the time ("Oct 28") and shows "1d late" for "1d overdue".
  - **Footer chips:** short labels below 330 px ("5", "1 late", "5 prio", "7 act"), on one line. "Need action" hides below 300 px (those tasks are already in overdue / priority).
- **More room for items:**
  - the Queue/To-do bottom band is `h-9` (was `h-10`), and the card's bottom padding and dots are a little tighter;
  - the main settings button is 40 px (was 44) with a 22 px cog;
  - Currently processing / Queue text is 14 px name / 11 px schedule (between the original 13/10 and last round's 15/12).
- **Not changed:** the quick-links bar and terminal widths stay as in round 2026-10-20f (a trial of matching them to the search row and Git box was reverted on request).

---

## Round 2026-10-20f — alerts on any website, floating bookmarks panel, Tree View at scale, layout

### Alerts outside DevDeck (`background.ts`, `lib/alertEvents.ts`, `lib/alertOverlay.ts`, `hooks/useInPageAlerts.ts`)
- **Why Chrome popups appeared:** they were the "no DevDeck tab in view" fallback. You chose: **top panel always**.
- **The service worker now delivers every alert**, through `deliver()`:
  1. A visible DevDeck tab is asked first (`devdeck:alert-due` / `devdeck:reminder-due`); if it answers `{shown:true}`, nothing else happens.
  2. Otherwise `chrome.scripting.executeScript` injects `renderAlertOverlay` into the active tab of the focused window. It's self-contained, in a shadow DOM, uses the same four matte designs, stacks up to 3 plus "+N more", and auto-hides after 12 / 20 s (paused on hover).
  3. Otherwise, a `chrome.notifications` notification. That covers `chrome://` pages, the Web Store, the PDF viewer, and Chrome not in front.
- **Events:**
  - Reminders: per-item alarms from the mirrored items, which now carry `section`.
  - To-do due times and timers: the page mirrors upcoming events (35 days, ≤ 200) to `devdeck:alert-events`, with one alarm each.
  - Theme: the accent and light/dark are mirrored to `devdeck:alert-theme`.
- **Overlay actions** (`devdeck:overlay-action`):
  - Open: the site, or DevDeck at `#todo=<id>`, which flashes the task.
  - Snooze 10m: stored in `devdeck:bg-snoozes` with an alarm.
  - Mark done: messages an open DevDeck, otherwise queued in `devdeck:pending-actions` and applied when DevDeck next opens.
  - Dismiss.
- **The page** never sends its own system notification in the extension.
- **Manifest:** `scripting` plus host `<all_urls>` (needed to draw on websites); `favicon`; `web_accessible_resources` for `_favicon/*`.
- **Verified in a real Chrome window:**
  - DevDeck visible: in-page alert, 0 notifications.
  - DevDeck closed, on a website: an overlay with 3 stacked cards, and Snooze stored.
  - On `chrome://version`: 1 notification.

### Bookmarks panel (`search/BookmarkDrawer.tsx`, `search/expandStore.ts`)
- **Shell:** a centred floating panel (like the Site Map, max 960 px, rounded 22 px) replaces the right-side drawer. The list scrolls both ways; rows don't truncate, so deep levels and long names scroll sideways.
- **Expand all / Collapse all** toggle in the header.
- **`ExpandStore`:** rows subscribe to their own folder (`useSyncExternalStore`), so a change re-renders only that row. Large changes run in per-frame batches of 24 folders: closing deepest-first, opening parents-first. Row Edit/Delete buttons render on first hover or focus.
- **Measured on 3,427 rows:** the longest main-thread block went from about 1.2 s to about 0.13 s; rows stream in top-down.
- **Esc while Tree View fades out** now reaches the panel.

### Tree View at scale (`bookmarkLayout.ts`, `BookmarkTreeView.tsx`)
- **The problem:** with a real collection, it was a single row about 15,000 px wide at 25 % zoom — unreadable, and impossible to grab.
- **Compact layout:** a folder whose sub-folders have no further (expanded) folders stacks them vertically, indented 30 px with an elbow connector. Width now grows with depth, not breadth (unit-tested).
- **Opening:** it opens at 80 % centred on the first top-level folder, unless the whole tree fits.
- **Icons:** bookmark icons come from Chrome's own favicon cache (`_favicon`): no network requests and no 404s.

### Site icons without failed requests (`lib/faviconStore.ts`, `Favicon.tsx`, `background.ts`)
- **The problem:** Google's icon service can answer 404 at random (it happened for dotnet.microsoft.com).
- **In the extension:**
  - the page never requests icons itself; the worker fetches each one (`devdeck:favicon`) and returns a `data:` URL;
  - icons are cached in `localStorage["devdeck.favicons.v1"]` (≤ 800 entries), so 309 icons paint within 150 ms on reload;
  - a missing icon is retried after 3 days.
- **On the website build**, icons load directly as before.

### Layout (`DashboardLayout.tsx`, `App.tsx`, `LinksStrip.tsx`, `TopBar.tsx`, `CategoryGrid.tsx`, `PrimaryRow.tsx`, `ProcessingPanel.tsx`)
- **Quick-links bar:** quick links + recent are their own floating glass bar (`--links-bar-h: 56px`), with a 12 px gap above the category cards container.
- **Side columns:** both start with a band the height of that bar.
  - Left: breathing space.
  - Right: the terminal (`rightTop` slot).
  - Measured: the left card, the cards container and the news card all start at y = 332 (1920 and 1536 wide).
- **Top bar:** on wide screens the terminal leaves it (`LayoutContext.rightInline`) and the Git box takes the full 236 px. When the right column folds into a drawer, the terminal returns there.
- **All categories:** moved into the cards container's footer, bottom-left, with the page dots centred.
- **Pin badge:** the hover badge on top-row tiles is removed. Unpin a site from its row's pin.
- **Currently processing / Queue rows:** name 15 px (was 13), schedule line 12 px (was 10), icon 20 px.

---

## Round 2026-10-20e — GitHub refresh every 3 hours

- `GIT_TTL_MS` (`services/github.ts`) is now 3 h (was 30 min).
  - It drives both the widget's background refresh (`setInterval` in `GitWidget.tsx`, for stats, profile, repos and activity) and how long cached GitHub data counts as fresh.
  - The ↻ button still forces an immediate refresh.

---

## Round 2026-10-20d — clean console, Site Map card sizing, minimal slider

- **Console errors** came from two places; both are now gone.
  - **Missing favicons:** the favicon service answers 404 for sites without an icon (pkg.go.dev, cvedetails.com, en.cppreference.com, gchq.github.io, …), and Chrome logs every failed image as an error. This repeated whenever cards re-rendered (switching subcategory chips) and when the Site Map opened.
    - `Favicon.tsx` now never requests a host known to have no icon.
    - Hosts come from a built-in list (all ~300 starter / demo hosts were probed) plus any host that failed once (`localStorage["devdeck.favicon.missing"]`, capped at 500).
    - Those render the letter tile straight away.
  - **Geolocation warning:** Chrome warned "Is the 'geolocation' permission appropriate?" because weather uses `navigator.geolocation`. The manifest now declares `"geolocation"`.
- **Measured in the built extension:** 0 errors / warnings / failed requests on load, after switching chips on every card and page, and after opening and scrolling the Site Map. A new regression test (`e2e/qa/console-clean.spec.ts`) fails on any console error, warning or HTTP ≥ 400.
- **Site Map category card** (`SiteMapModal.tsx`):
  - delete-category button `size-8` with an 18 px bin (was `size-6` / 14 px);
  - header area shorter: card top padding `pt-2.5` (was 16 px), header `min-h-8`;
  - "+ Sub category" / "+ Add site" are 13 px (was 11 px) with more padding.
- **Items-per-section slider** (`ScrapingTab.tsx`): one quiet row (label · half-width slider · number).
  - The 0–100 dot markers and the boxed value are gone.
  - Track 3 px, thumb 12 px, plain white with a hairline ring.
  - The light theme's global input frame is stripped from the slider.

---

## Round 2026-10-20c — matte, high-contrast alerts

- **Finish:** `.alert-glass` is now **solid and matte**: no backdrop blur, no gloss, no translucency.
  - Dark: background `color-mix(accent 16%, #14131b)`, title #f8fafc, secondary #cbd5e1.
  - Light: background `color-mix(accent 6%, #fff)`, title #0f172a, secondary #334155.
  - A 1 px accent border keeps the theme. Buttons are solid (secondary grey, primary accent).
  - Priority eyebrows use the P1/P2/P3 colours.
- **Contrast** (WCAG, measured by the QA script on every design): title 14.9:1 dark / 16.4:1 light; secondary 10.5:1 / 9.5:1 (AAA needs 7:1).
- **Size:** titles 17 px (Queue pill 15 px), secondary 13.5 px, eyebrow 11.5 px bold, buttons 13.5 px, count numbers 21 px. Cards are slightly wider.
- **Corners:** cards 10 px (were 16–20 px and fully round pills); buttons and close 6 px.
- **Code:** new `.alert-title` / `.alert-sub` classes replace `text-white/…` inside alerts, so contrast is set per theme.
- **Checks:** `e2e/qa/final-pass.manual.mjs` asserts an opaque background, no blur, contrast (title ≥ 7, secondary ≥ 4.5) and radius ≤ 10 px. It passes 29/29 in dark and light.

---

## Round 2026-10-20b (vfinal-qa-fixes) — glass reminder alerts, zone picker unified, QA fixes

- **Alert store** (`ui/alertStore.ts`): plain-data alerts, `AlertKind = processing | queue | todo | overdue`.
  - `pushAlert` de-duplicates by key, both while on screen and once seen. Seen keys live in `localStorage["devdeck.alerts.seen"]` for 7 days, so reloads and other tabs don't repeat an alert.
  - `snoozeAlert` stores the alert plus `until` (10 min) in `devdeck.alerts.snoozed`. `takeDueSnoozes` removes due ones, so only one tab re-shows them.
- **Alert UI** (`ui/AlertCenter.tsx`, mounted in `App`): a portal at the top centre, `z-[110]`.
  - Motion: each alert drops in from y −140 with a spring (stiffness 380, damping 30); exit lifts up and fades. `AnimatePresence mode="popLayout"`, so the rest close up smoothly when one leaves.
  - Stack: newest on top, at most 3, then a "+N more reminders" pill that expands the list.
  - Timing: auto-hides after 12 s (overdue summary 20 s); paused on hover.
  - **Four designs:**
    - **Currently processing** — spotlight banner: favicon in an accent ring, "CURRENTLY PROCESSING · NOW", "Time to work on …", schedule and host.
    - **Queue** — "Up next" pill.
    - **To-do** — checklist card: tick to complete, priority stripe (P1 red, P2 amber, P3 blue), eyebrow "TO-DO DUE · P1" or "TIMER ENDED".
    - **Overdue** — summary sheet: total, a few names, and count tiles for To-dos, Queue and Currently processing.
  - Actions: **Open** (new tab for sites; for to-dos it shows the To-do pane and flashes the row), **Snooze 10m**, **Dismiss**. To-dos also get **Mark done**; the summary gets **Review** (To-do pane with the overdue filter).
  - Styles (`.alert-glass`): `backdrop-filter: blur(28px) saturate(170%)`, background `color-mix(accent 13%, rgba(22,20,32,.66))`, 0.5 px border `color-mix(accent 42%, white 14%)`, inset top highlight, soft shadow. Light theme: accent 9% over white 72%.
- **Triggers** (`hooks/useInPageAlerts.ts`):
  - Events:
    - scheduled reminders (`nextFireTime`), styled Currently processing or Queue by section;
    - to-do due date + time;
    - timers that run out, for to-dos and Queue/Currently processing items;
    - an overdue summary about 1.5 s after a tab opens, at most every 30 min (`devdeck.alerts.overdueAt`).
  - One timeout aims at the next event (re-planned at most hourly, and on `visibilitychange`). Events since the last check fire too, so a sleeping laptop catches up.
  - **No doubles:** a visible tab shows the glass alert. A hidden tab sends a system notification instead: `chrome.notifications` in the extension, `Notification` on the web, with the key as tag. Extension reminders are left to the service worker.
  - The service worker (`background.ts`) now asks first: `runtime.sendMessage({type:'devdeck:reminder-due'})`. A visible DevDeck tab shows the alert and replies `{shown:true}`, and then no notification is sent.
  - `useWebReminders` is retired (folded in).
- **To-do jumps:** `devdeck:show-todo` events. `QueueAndTodo` scrolls to the To-do pane and flashes `[data-todo-id]` (`.todo-flash`); `TodoWidget` sets the overdue focus for Review.
- **Settings zone picker** (`AppearanceTab` `ZonePicker`): unified with the clock face. It uses the same world-wide `ZoneSearch` (exported from `faces2.tsx`), a 2-city limit and 24-hour times. Before, it used the curated 28-city list and allowed 3.
- **Tests:**
  - 7 new unit tests (`useInPageAlerts.test.ts`); Vitest 228/228.
  - New `e2e/qa/bookmarks.spec.ts` (extension) and the scenario scripts `e2e/qa/final-pass.manual.mjs` and `bookmarks.manual.mjs`.
  - Stale e2e specs updated for intended UI changes. See `qa-report.md`.

---

## Round 2026-10-20a — browser bookmarks panel + Tree View

- **Data** (`services/bookmarks.ts`): live, two-way access to the browser's own bookmarks via `chrome.bookmarks`. The manifest gets the `"bookmarks"` permission.
  - `watchBookmarks` re-reads the tree on every onCreated / onRemoved / onChanged / onMoved / onChildrenReordered / onImportEnded event, debounced 60 ms.
  - Writes: `createFolder`, `renameNode` (title, and URL for sites), `moveNode`, `deleteNode` (`removeTree` for folders). `deleteNode` returns a snapshot that `restoreNode` recreates recursively, for Undo.
  - Pure helpers: `findNode`, `isInside` (no moving a folder into itself or a descendant), `countSites`, `filterTree`.
  - The browser's top-level containers (Bookmarks bar, Other, Mobile) are `isRootContainer`: they can't be renamed, deleted or moved. Managed (`unmodifiable`) nodes are read-only.
- **Panel** (`search/BookmarkDrawer.tsx`, rewritten): the bookmark button now opens the browser bookmarks. DevDeck's categories stay in the Site Map and Settings → Library.
  - A nested list to any depth. Only expanded folders render their children (`BmRow` is memoised), so large collections stay light.
  - Folder hover actions, in order: **+** (tooltip "Add sub folder"), **Edit** (inline rename), **Delete**. A non-empty folder asks first; every delete has a 5 s Undo.
  - Sites: open in a new tab, plus Edit (name and URL) and Delete.
  - Filter box (keeps each match's folder path). **+ Add folder** creates a first-level folder in Bookmarks bar, or another root you pick.
  - On the plain website (no `chrome.bookmarks`), the panel shows only an explanation.
  - `useBookmarks` hook; `.bm-*` styles for dark and light.
- **Tree View** (`search/BookmarkTreeView.tsx`, lazy-loaded; `search/bookmarkLayout.ts`): a full-screen canvas.
  - Layout: each folder is a box with its own sites (8 shown, "+N more" for the rest); sub-folders hang below, centred, joined by elbow connectors. Subtrees take disjoint column ranges, so boxes never overlap.
  - Folders at depth ≥ 2 that have sub-folders start collapsed; there are Expand all / Collapse all.
  - Pan by dragging the background; the wheel zooms around the cursor (25–160%); − / + / Fit buttons; a sideways trackpad swipe pans.
  - **Dragging is pointer-driven, not HTML5**, for smoothness:
    - after 5 px of movement, a ghost follows the pointer on a `requestAnimationFrame` loop (`translate3d`, no React render per move);
    - the target is found by `elementFromPoint → [data-drop-folder]`; React only re-renders when the target changes;
    - invalid targets (itself, a descendant, its current parent, managed folders) show red and refuse the drop;
    - the canvas auto-pans within 64 px of an edge;
    - Esc cancels the drag; Esc again closes the view;
    - the moved item's new box pulses briefly.
  - Sites drag by their row; folders drag by their header.
- **Tests:**
  - 9 new unit tests (`bookmarks.test.ts`, `bookmarkLayout.test.ts`); Vitest 221/221.
  - The extension QA script (`e2e/qa/bookmarks.manual.mjs`) seeds a 4-level tree through the real API and passes 26/26 in dark and light: panel CRUD, the confirm + Undo round trip, live external changes, real-mouse drags of sites and folders, the blocked drop into a descendant, Esc cancel, 6 rapid back-and-forth moves, pan and zoom, and no console errors.
  - QA found and fixed a light-theme issue: the drop-target highlight and "+N more" / fold labels were invisible.

---

## Round 2026-10-19j — 24-hour zones, flip plate in layout, new-tab start page, drag-out windows

- **Multi-Timezone** (`faces2.tsx`): always 24-hour. `h24 = true` for the zone tiles; the local tile uses `now.getHours()` and no meridiem.
- **Flip plate:** the plate is now *in the case's layout*: the case is a column with the plate, then the row of cards and AM/PM.
  - The plate is `relative z-10`, tightly padded (`px-[1.6cqw] pl-[2cqw] py-[0.7cqh]`), semibold, with tracking 0.4em.
  - Before, it was absolutely positioned: the later (relative) cards painted over its lower half, and the widget edge clipped its top.
  - `.flip-plate` text colour is fixed to white/88 in both themes; light theme had turned it dark on the dark plate.
  - Verified by screenshots at 1920 px, dark and light.
- **Start page never navigates away** (`lib/openTab.ts` new, `index.html`):
  - `<base target="_blank">`: every link (site rows, tiles, chips, overview, quick links, feeds) opens in a new tab.
  - `openInNewTab(url)` replaces `location.assign` in the search bar (Enter, built-in commands), the Site Map search and the AI hand-off (`services/ai.ts`).
  - It uses `chrome.tabs.create` in the extension (no popup blocker, even after an await) and `window.open` on the website.
- **Drag a site out → new window** (`hooks/useDragOutToWindow.ts` new, mounted in `App`):
  - Drag zones: `data-drag-zone` on the Site Map dialog and on the category cards `main`.
  - On `dragend` with `dropEffect === 'none'` (nothing accepted the drop) and the pointer outside the source zone, it calls `openInNewWindow(url)`: `chrome.windows.create` in the extension, otherwise a popup window at 70% × 80% of the screen.
  - Drops onto sections, the bin or the browser tab strip keep their meaning.
- **e2e:** search, sitemap and gemini specs now wait for the popup tab instead of a same-tab navigation, with routes on the context. 19/19 pass.

---

## Round 2026-10-19i — terminal wording, location pin, greeting offset, QA strategy

- **Terminal box** (`CommandPrompt.tsx`, `services/terminal.ts`): no behaviour change; the investigation is below.
  - The shell label and prompt sign come from `detectPlatform()` (the user agent): Windows → `PS>` / "PowerShell", macOS → `$` / "Terminal", Linux → `$` / "your terminal" (was "the terminal").
  - The not-extension message now says the page isn't running as the installed extension (e.g. localhost). That was the cause of the reported "nothing happens": the page was the dev server, where `chrome.runtime.id` is absent and native messaging can't be reached.
  - `e2e/topbar.spec.ts` expectation updated.
- **Location pin** (`WeatherUV.tsx`): the 10 px 📍 emoji is replaced by an 18 px SVG `MapPinGlyph` in the accent colour. The place lines sit in a column beside it, so the pin is vertically centred on them; the `pl-[15px]` indents are gone. The "Set location" button uses the same glyph.
- **Greeting:** the centre column's top padding goes from `pt-3` to `pt-7`, so the greeting sits about 16 px lower.
- **`qa-strategy.md` (new):** environments (Linux first), test levels and commands, data sets, risk priorities, feature-area → checklist map, entry/exit criteria, defect format, known gaps, terminal test cases T1–T10.

---

## Round 2026-10-19h — subcategory delete → bin + undo, QA fixes, card polish

- **Subcategory delete** (`store.ts` `deleteSubcategory`, new `reinsertSubcategory`; `library/deleteSubcategory.ts` new):
  - The subcategory is removed and its sites go to the recycle bin (`toTrash`), no longer to General.
  - `deleteSubcategoryWithUndo` deletes without a prompt and shows the undo bar (5 s): "Deleted X — N sites moved to the recycle bin".
  - Undo re-inserts the same subcategory (same id and order) and restores each site into it.
  - Used by the Site Map, the Bookmarks drawer and Settings → Library.
- **Category delete:** confirmation everywhere, as before. The Library modal text now says the sites move to the recycle bin; the store already trashed them.
- **Fixes found by the QA run** (`qa-sitemap-lifecycle.md`):
  - `Select` list layer `z-[80]` → `z-[120]`. It was hidden behind the Add Site dialog (`z-[85]`).
  - Site Map drag state ends on any `drop` / `dragend` (capture listeners while dragging). A chip dropped on the bin unmounts before its dragend.
  - Site Map closes on Esc when focus is on the page body (window listener; skipped while focus is inside another dialog).
  - The new-category Add button is accent-coloured (it was invisible in light theme).
  - Queue/To-do switch: `@container`; the icons and wide tracking only show at ≥ 300 px, so the labels aren't cut.
  - Notch label `whitespace-nowrap`, 10.5 px, `tracking 0.12em`, max width.
- **Card polish:**
  - The All Categories overview wraps long names (`break-words`, dot aligned to the first line) instead of truncating.
  - The pager strip is `h-5` (was `h-8 pt-1`) and the container bottom padding is `pb-1` / `sm:pb-1.5`.
  - The pinned row is `px-3.5 py-2`, and the rail is `px-1 pt-1.5 pb-1` with `gap-2.5`, so tiles and the unpin badge aren't clipped.
  - Flip: the case gets `mt-[4cqh]`, and the plate sits at `-top-[3cqh]` with more padding (`px-[2.8cqw] pl-[3.2cqw] pt-[1.3cqh] pb-[1.1cqh]`). It was clipped by the widget top edge.
- **Tests:** unit tests updated (subcategory → bin; undo round-trip; fixture resets trash): 212/212. The QA script is saved as `e2e/qa/sitemap-lifecycle.manual.mjs`.

---

## Round 2026-10-19g — pin icon, "Focus" renamed to "Currently processing"

- **Pin icon** (`SiteRow.tsx` `PinIcon`): a new minimal outline thumbtack,
  modelled on Font Awesome's jelly thumbtack.
  - Drawing: a 24-unit, 2 px round-stroke cap, body and needle, rotated 45°.
  - "Pinned" adds a 25% tint inside the outline instead of a solid shape.
  - Used by site rows, the tile unpin badge (`PrimaryRow`) and the category
    pin button (`CategoryCard`, which drops its own inline SVG).
- **Tile unpin badge** (`.tile-unpin`): an elevated neutral circle with a
  white/75 outline icon and a soft shadow. Hover gives an accent border and
  icon instead of the solid accent fill.
- **Section rename:**
  - `FIRST_SECTION = 'Currently processing'` (`types.ts`) is the default
    section for new items, the editor defaults and demo data.
  - `normalizeProcessing` (which runs on every load through `merge`) maps saved
    `'Focus'` items to it, so existing decks rename themselves.
  - Resize-handle labels are updated.
  - The e2e undo-text regex and the QA fixture are updated.
  - **Note:** a section the user deliberately names "Focus" would also be renamed on the next load.
- **Verification:** `tsc -b` clean; Vitest 211/211; `build:demo` succeeds; UI not tested yet.

---

## Round 2026-10-19f — chip last row, inline new category, restore to origin, Uncategorized

### Site Map chips (`SiteMapModal.tsx`)
- Section chip rows still stretch edge to edge, but the **last row keeps
  natural widths**. A zero-height `::after` filler with `grow-[999]` takes the
  leftover space. The Uncategorized card uses the same row.

### New category, inline (`SiteMapModal.tsx` `NewCategoryButton`, `.sitemap-color`)
- The popover is gone. "+ New Category" turns into an inline header form:
  - a colour swatch (a native `<input type="color">` behind a round preview);
  - the name field (autofocus), **Add** and **Cancel**.
- The colour is preset with `nextFreeColor` (unused by any category) each time
  the form opens. Enter adds; Esc cancels and doesn't close the Site Map.

### Recycle bin: restore to origin + Add to URL (`SiteFormDialog.tsx`, `store.ts`)
- **`restoreSite(id)` with no target** restores to where the site came from:
  - **original subcategory** if it still exists in that category;
  - **category kept, subcategory deleted** → the category's General group (`subcategoryId null`);
  - **category deleted** → Uncategorized (`categoryId ''`, `subcategoryId null`).
  - An explicit `categoryId` (including `''`) still wins.
  - The old fallback to the first category is gone.
- **Row text:**
  - "Restores to Category › Sub" (or "› General") while the category exists;
  - when the category is gone, there's no restore path, just "Uncategorized" and the age.
- **"Add to URL"** (`.bin-use-btn`, left of Restore) fills the form's URL and
  Display Name with that site. It stays in the bin.
- **Form:**
  - the category select has "Uncategorized (none)" (`categoryId ''`); its subcategory select offers only "None";
  - save no longer requires a category;
  - editing an uncategorized site keeps `''`.
- **Tests:** 4 new unit tests in `store.test.ts` cover the three cases plus an explicit target.

### Uncategorized sites (`lib/categories.ts`, `UncategorizedTiles.tsx` new, `CategoryGrid.tsx`, `SitemapTab.tsx`, `utils.ts`)
- **Data model:** `UNCATEGORIZED_ID = ''`, name "Uncategorized", colour `#94a3b8`.
  It isn't a real category, so nothing is added to `categories`.
- **Deck:** `UncategorizedTiles` occupies one card-width slot after the last
  category card, with no card frame: a quiet label, a count, and a grid of
  favicon tiles (they record visits). The pager counts the slot.
- **Site Map:** an "Uncategorized / None" `MapCard` without sections. Its chips
  drag onto any section to file them (`placeSite`).
- **Settings → Sitemap graph:** an "Uncategorized / None" node with its sites
  linked straight to it.
- **Search:** `searchSites` includes uncategorized sites under a pseudo
  category, so the search bar and Site Map search find them.
- **Not shown:** Settings → Library still lists only real categories.

### Verification
- `tsc -b` clean.
- Vitest 211/211.
- `build:demo` succeeds.
- UI not tested yet (testing policy).

---

## Round 2026-10-19e — zone list, count box, feed reload, switch border, name fit

- **Time-zone search** (`faces2.tsx` `ZoneSearch`):
  - the popover is `min(560px, viewport − 16)` wide; the input is 13 px; rows are 13.5 px with 11.5 px detail;
  - the city and the full "(UTC…) Country — Zone (cities)" line wrap instead of truncating, so every city is readable;
  - the list is 360 px tall.
- **Items-per-section slider** (`ScrapingTab.tsx`):
  - the number labels under the points are removed; the 11 dots stay, and each is clickable with a tooltip;
  - the value shows in `.count-value`: an accent-tinted bordered box with a bold 15 px number plus "items".
- **Feed reload after Settings:**
  - `App.tsx` dispatches `devdeck:settings-closed` when Settings closes;
  - `FeedColumn` remembers the counts it last fetched for;
  - if News/Jobs counts differ when Settings closes, it calls `refresh(true)` (a forced fetch with the progress bar).
- **Queue / To-do switch:**
  - the active tile has a 1 px border in the theme accent (70%), and the track a faint accent border (22%);
  - the bottom accent underline is removed (the border replaces it);
  - in light theme, the same accent borders sit on white.
- **Greeting name fit** (`DateGreet.tsx`, `.greet-name-face`):
  - the h1 no longer truncates: `leading-[1.2]`, `text-balance`, `break-words`, so a wide name wraps and pushes the quote down;
  - the name is an inline-block with padding (balanced by negative margins), so script swashes and tall letters aren't clipped, including by the spotlight's `background-clip:text`.
- **Roman caps removed:** dropped from `NameFont` and `NAME_FONTS`, along with the Cinzel font and its CSS. A saved `'roman'` falls back to Grotesk.
- **Verification:** `tsc -b` is clean, Vitest passes 207/207, and `build:demo` succeeds. None of this round is tested yet (testing policy).

---

## Round 2026-10-19d (phase 4) — greeting name, paging fix, flip plate, calm switch

### Greeting (`topbar/DateGreet.tsx`, `TopBar.tsx`, `types.ts`, `settings/AppearanceTab.tsx`, `index.css`)
- **Size and position:** the greeting is `text-[2.15rem]` (was 1.85rem). The
  `date-greet` wrapper gets `md:pr-14`, which moves the centred greeting
  about 28 px left.
- **Name typefaces:** `settings.nameFont` (`NameFont`), defined in
  `NAME_FONTS`. Each entry has an `upper` flag; script and italic faces keep
  the name's own capitalisation.
  - Grotesk (default; Space Grotesk, uppercase)
  - Script (Great Vibes)
  - Italic serif (Playfair Display italic)
  - Handwritten (Dancing Script)
  - Roman caps (Cinzel)
  - Condensed (Bebas Neue)
  - Mono (JetBrains Mono)
  The fonts are added to the Google Fonts import, and the classes are `.name-font-*`.
- **Name interactions:** the name is its own control, and `stopPropagation`
  keeps it from changing the greeting style.
  - **Click** → next font, delayed 240 ms so a double-click can cancel it.
  - **Right-click** → previous font.
  - **Double-click**, or Enter/F2 when focused → an inline input (`.name-edit-input`).
  - In the input: Enter or blur saves (trimmed, at most 40 characters); Esc cancels.
- **Appearance → Greeting:** a "Name font" picker with samples rendered in each face.

### Category paging fix (`CardsPager.tsx`)
- **Cause:** with the side columns at rest, the centre is about 10 px narrower
  than 3 cards (`cardSnap` counts a sliver-cut card as shown). The pager
  floored that to 2 per page, so each page started on the third, already-visible
  card.
- **Fix:** `perPage` now uses the same rule (`+ 0.15` before the floor), so a
  page is the full visible set.
- **Checked** at 1920 px with 13 categories: 3 per page, 5 dots, and every wheel
  step lands on card 3, 6, 9 or 12.

### Flip plate (`faces2.tsx`, `.flip-plate`)
- Reverted to the round-19b plate: dark gradient, `text-white/55`, `TINY` mono text.
- More inner padding: `px-[2.4cqw] pl-[2.8cqw] pt-[0.9cqh] pb-[0.8cqh]`
  (was `px-[1.4cqw] py-[0.3cqh]`).
- Set slightly higher, at `-top-[2.4cqh]`, so the taller plate stays on the edge.

### Queue / To-do switch (`index.css`)
- **No glow.** The track is dark glass. The active pill is a faintly lighter
  glass tile with a 1 px border and a short 1.5 px accent line at its bottom
  edge. There's no gradient fill and no coloured shadow.
- **Active tab:** near-white label, accent icon, and a subtle count badge.
- **Light theme:** a white tile on a grey track.

### Verification
- `tsc -b` clean.
- Vitest 207/207.
- `build:demo` succeeds, and `dist/` is rebuilt.
- Only the paging fix was exercised in the preview. The rest is not tested yet,
  per the testing policy.

---

## Round 2026-10-19c — masonry Site Map, add-name, clocks, world zones, switch, scraping controls, loaders

### Site Map layout (`ui/Masonry.tsx` new, `search/SiteMapModal.tsx`)
- **`Masonry`** replaces the fixed 1/2/3-column grid. Each card is placed, in
  order, into the shortest column.
  - Columns: `floor((width + gap) / (minColumn + gap))`, capped at 3; Site Map uses `minColumn 300`, `gap 16`.
  - Cards are absolutely positioned (`translate`) inside one parent, so they never remount when the layout changes. Open editors, popovers and drags survive.
  - A `ResizeObserver` on the box and each card re-packs on the next frame; moves animate (300 ms, off with reduced motion).
- **`content-visibility:auto`** was removed from `.sitemap-card`. Off-screen cards
  would otherwise report the 220 px placeholder height and break the packing.
- **Justified chips:** site chips get `grow`, so each row of chips fills the
  section edge to edge.

### Greeting: add your name (`topbar/DateGreet.tsx`)
- **When it shows:** only when `settings.greetingName` is empty. An `AddName`
  control sits absolutely to the right of the greeting, so it causes no layout
  shift.
- **Behaviour:**
  - it's invisible (`opacity-0`) until the greeting block is hovered (`group/greet`) or focused;
  - clicking it shows an input;
  - **Enter** saves (trimmed, at most 40 characters) through `updateSettings({ greetingName })`;
  - **Esc** or blur cancels.
- **Styles:** `.add-name-btn` and `.add-name-input`, with light-theme variants.

### Clocks
- **Modern Analog:** `AnalogFace` is restored verbatim from `e32e656` (card,
  dial, small readout). `.analog-ambient` CSS is left in place but unused.
- **Typographic Word** (`faces3.tsx`):
  - padding `px-[3.5cqw] py-[0.5cqh]` (Card `tight`);
  - text `min(15cqh,4.7cqw)`;
  - `leading-[1.22]` (a little more line spacing);
  - `gap-x-[1.25cqw]` and `tracking-normal`, so the bigger words still fit five lines.
- **Flip plate** (`faces2.tsx`, `.flip-plate`):
  - bigger: text `max(8px,min(9cqh,3cqw))`, bold, `tracking-[0.45em]`;
  - raised: `-top-[4.5cqh]`;
  - lighter plate gradient with a border;
  - near-white letters with an accent glow.

### Multi-Timezone: every zone in the world (`lib/timezoneOptions.ts` new)
- **Dependency:** `@vvo/tzdb`. `timezoneOptions` follows the snippet you supplied:
  - `value` = the IANA name;
  - `label` = `(UTC±hh:mm) Country — Zone name (cities)`;
  - `searchKeywords` adds the grouped aliases and the abbreviation, lowercased.
- **Loading:** `ZoneSearch` loads the module with a dynamic `import()` when the
  search opens. It's a separate 46 kB chunk (17 kB gzipped), so it stays out of
  the first paint. Until it loads, `Intl.supportedValuesOf` names stand in.
- **Search:** every word typed must match the keywords or the city, and the
  list is no longer cut off at 60. Rows show the city plus the full label;
  the popover is 340 px wide.

### Queue / To-do switch (`processing/ProcessingPanel.tsx`, `index.css`)
- **Segmented control:** `.pane-switch` is a dark recessed track. A glossy
  accent pill (`.pane-switch-pill`) slides under the active tab with
  `translateX(100%)` over 300 ms.
- **Tabs:** an icon (`WaveIcon` for Queue, `CheckCircleIcon` for To-do), the
  label and a count badge. The active badge is white with accent text.
- **Behaviour:** the wheel over the switch and clicks change panes, as before.
- **Light theme:** a grey track; the active text stays white on the pill.

### Scraping controls (`settings/ScrapingTab.tsx`, `feeds/FeedColumn.tsx`, `services/feeds.ts`, `types.ts`)
- **Items per section:**
  - `settings.feedNewsCount` and `settings.feedJobsCount` (0–100, default 4) replace `PER_PANEL`;
  - a `CountSlider` (range 0–100, step 1, styled `.count-slider` with an accent fill through `--fill`);
  - 11 clickable points at 0, 10, …, 100, labelled underneath;
  - 0 hides the list with a hint.
  - Jobs numbering starts at `newsCount + 1`.
- **Several topics:**
  - `topicIds: string[]` replaces the single `topicId`;
  - chips are toggle buttons (`aria-pressed`), and **All** clears the selection;
  - `matchesTopic` and `selectPanel` take `Topic | Topic[] | null`, and an item matching any selected topic is shown;
  - the panel header shows `#label` for one topic or "N topics" for several.

### Loading indicators (`ui/LoadingBar.tsx` new, `.skeleton`)
- **`LoadingBar`:** a 2 px accent bar.
  - Determinate (`value` 0–1, fills) or indeterminate (a sweep).
  - Fades out when finished.
  - Has `role="progressbar"` and a label.
  - Reduced motion turns the sweep off.
- **Feeds:**
  - `loadFeeds` gets `onProgress(done, total)`, called by `settleLimited` after each source settles;
  - both feed panels swap their top accent line for the progress bar while sources load, and the header shows "fetching 34/210";
  - first-load skeletons are shimmer rows (number + two lines, `.skeleton`), replacing the pulse blocks.
- **GitHub widget:** an indeterminate bar along the top edge while any request loads.
- **Weather:** an indeterminate bar under the weather row while it refreshes.

### Verification
- `tsc -b` clean.
- Vitest 207/207.
- `npm run build:demo` succeeds, and `dist/` is rebuilt.
- New UI not tested yet, per the testing policy.

---

## Round 2026-10-19b — clock polish, icons, offline probe, Site Map bar, card paging, demo build

### Clocks (`topbar/clock/faces*.tsx`, `index.css`)
- **Flip** (`faces2.tsx`):
  - hours : minutes : seconds cards (new `FlipColon`);
  - bigger cards (`h-[66cqh] w-[22cqw]`, digits `min(48cqh,15cqw)`) in the same space;
  - a printed **DEVDECK** plate on the top edge of the housing (`.flip-plate`).
- **HUD:** readout `min(58cqh,22cqw)`, shifted down `translate-y-[5cqh]`.
- **Modern Analog** (`faces3.tsx`):
  - no card;
  - bigger dial (`min(98cqh,50cqw)`) with a radial accent glow behind it (`.analog-ambient`);
  - a larger digital readout with seconds beside it.
- **Kinetic Orbital:** the digital time moved out of the SVG ring into a readout beside it; the card stays.
- **Typographic Word:** `Card tight` (less vertical padding), text `min(13cqh,4.3cqw)`.
- **Diffused Glow:** text `min(56cqh,21cqw)`.
- **CLI Sophisticated:** `CodingTicker` in the bottom-right types a line of code every 2.6 s (`.cli-type` steps animation plus a block cursor).
- **Cyberpunk 2077** (`CyberEdges`):
  - On every minute change, a 450 ms flicker on the left and right 16% (`cyber-tick`).
  - Every 5th minute, a 1.4 s old-TV channel-change band in the accent colour (`cyber-channel`).
  - It never covers the centred time.
  - Off under reduced motion.
- **macOS minimal:** centred.

### Icons & settings button (`ui/icons.tsx`, `App.tsx`, `index.css`)
- **SlidersIcon** (two sliders, from the user's reference) replaces the gears.
  It's used on the feeds panel button (`FeedColumn.tsx`) and the Focus/Queue
  manage button.
- **Main settings button:**
  - a calm lucide-style `CogIcon` (26 px, turns 45° on hover);
  - `.settings-orb` rewritten as a glass tile with an accent ring on hover only, so it no longer glows constantly.

### Offline banner (`ui/OfflineBanner.tsx`)
`navigator.onLine` misses "Wi-Fi connected, no internet", so `useOnline`
also probes the connection:
- **Probe:** `https://www.gstatic.com/generate_204`, fetched `no-cors` / `no-store` with a 5 s timeout.
- **Schedule:** every 20 s while online, every 5 s while offline, and immediately on `online` / `offline` / `focus`.
- **Spot-checked:** the banner showed when the adapter was off and when the probe failed while `onLine` was true.

### Site Map (`search/SiteMapModal.tsx`)
- **+ New Category** in the modal header, the same as Settings → Library. It
  opens an `AnchoredPopover` form:
  - the colour is preset to `nextFreeColor` (a colour no category uses);
  - only unused swatches from `CATEGORY_PALETTE` are offered.
- **Card bottom bar:** `mt-auto border-t pt-3` holds **+ Sub category**,
  **+ Add site** (opens `SiteFormDialog`) and the recycle-bin drop target
  (`ml-auto`, no longer absolute). The header "+ Sub" button is gone.
- **New-subcategory field:** closes on blur (`onBlur → setNewSub(null)`), so a
  click outside never creates anything. The Add button uses
  `onMouseDown preventDefault` so it still submits.

### Queue / To-do card (`processing/ProcessingPanel.tsx`, `topbar/todo/TodoWidget.tsx`)
- **No visible scrollbars.** `scrollbar-none` is on:
  - the pane scroller (was `thin-autohide-scroll`);
  - the queue lists;
  - the compact to-do list.
  The expanded to-do view keeps its ultra-thin bar.
- **Matching bottom bands.** Both panes end in an `h-10` band with
  `data-card-footer` and a top border:
  - To-do: chips, archive and expand;
  - Queue: an "N queued" count and the sliders manage button (now in the band, `size-8`, `ml-auto`).
  Text and buttons centre vertically in the band.
- **Wheel switches panes.** A wheel over the bottom band or the pane dots
  switches Queue ↔ To-do (`onWheel` on the section, filtered by
  `closest('[data-card-footer], [data-pane-dots]')`).
- **Focus card label.** `PanelNotch` is a tab hanging from the top border:
  centred, rounded bottom corners, name plus count (`.panel-notch`). The
  section uses `pt-9`. `PanelHeader` is kept and exported but unused.
- **Emoji removed** from "Zero pending" and "All done — add the next one above."

### Category row paging (`CardsPager.tsx` new, `CategoryGrid.tsx`, `CategoryOverview.tsx`)
- **Replacement:** `CardsScrollbar.tsx` is deleted (and its `.cards-bar*` CSS).
- **`useCardPaging(ref, count)`** measures the row from the card offsets:
  - **perPage:** the number of cards that fully fit;
  - **pages:** `ceil(count / perPage)`;
  - **page:** the current page, from `scrollLeft`;
  - **spacer:** the width after the last card that lets the last page start at the left edge.
  It re-measures on scroll and resize, and snaps back to a page boundary when
  perPage changes.
- **Row wheel:** sideways wheel / trackpad swipes on the row stay blocked, as before.
- **`PagerSpacer`:** sits after the last card (`data-pager-spacer`). With 1
  card left in a 3-card row, the last page shows 1 card and 2 blank slots.
- **`PagerDots`** (`data-testid="cards-pager"`, tablist):
  - the active dot is a wide accent pill;
  - click a dot to go to that page;
  - ←/→ keys page;
  - one wheel notch or swipe over the 32 px strip = one page (450 ms lock);
  - hidden when everything fits on one page.
- **Track attributes:** `data-per-page` on the track. `revealCategory` (the
  overview jump) now goes to the page that holds the card instead of a
  mid-page offset.
- **Pinned card:** no longer `sticky`. It leads page 1, and the row still
  returns to page 1 when you pin.

### Demo build (`main.tsx`, `package.json`)
- `npm run build:demo` (`vite build --mode demo`).
- When `import.meta.env.MODE === 'demo'`, the first open calls
  `loadDemoData()` once and sets `localStorage["devdeck-demo-autoloaded"]`.
- Normal `npm run build` is unchanged. Demo items keep `demo-` ids, and
  Settings → Data → Remove demo data clears them.
- Content: 52 Focus + 52 Queue sites with schedules and timers, 156 to-dos, 30
  topics, 210 feed sources.
- `dist/` was built with `build:demo` for manual testing.

### Verification this round
- `tsc -b` clean.
- Vitest: 207/207.
- `build:demo` succeeds.
- New UI not tested yet, per the testing policy. It's covered in
  features-functionality.md for the combined QA pass.
- **Known stale e2e:** `e2e/cockpit-tools.spec.ts` still references
  `cards-scrollbar`, the header "+ Sub", and "Zero pending 🎉". Update it
  during the QA pass.

---

## Round 2026-10-19 — clocks, Site Map editing, data tools, to-do overhaul

Status: implemented, typechecked (`tsc -b`), unit tests green (207). **Not yet
integration-tested** — by request, testing of this round happens in the
combined QA pass at the end of the UI work.

### 1. Clock faces

| Change | Where | Notes |
|---|---|---|
| Cyberpunk 2077: time centred in the box | `src/components/topbar/clock/faces.tsx` (`CyberpunkFace`) | `justify-center` on the time row. |
| Neon Orb → **Chrono 2100** (futuristic analogue) | `faces2.tsx` (`NeonOrbFace`), `lib/clockStyles.ts` | SVG dial: 60 micro-ticks (5-min bars in accent), two counter-rotating data rings (`.chrono-spin`, `.chrono-spin-rev`, 24 s / 40 s, off with reduced motion), seconds sweep arc + orbiting light, glowing "light-beam" hour/minute hands, `CHRONO·2100` label, side readout (hh:mm, seconds, meridiem, 6-cell seconds bar). Style id stays `neon-orb` so saved settings keep working. |
| Flip Clock: classic desk-clock housing | `faces2.tsx` (`FlipFace`, `FlipCard`) | Case with top highlight and inner shadow, `DEVDECK` label, recessed window, hinge pins on each card, glowing colon dots, AM/PM indicator, two feet. Cards resized to fit the case. |
| Futuristic HUD: bigger readout, cyberpunk weapon-panel background | `faces2.tsx` (`FuturisticHudFace`) | Angular armour-plate SVG with carbon-weave pattern, seams, vents, hazard-stripe corner, rivets, `SYS.TIME // MK-II` label, readout `min(48cqh,18cqw)` (was 36/14) with chromatic shadow, 12-cell "ammo counter" (one cell per 5 s) + seconds. |
| Circular Progress removed | `faces2.tsx`, `lib/clockStyles.ts` | Saved value falls back to the default face via `normalizeSettings`. |
| Multi-Timezone: click a city to change it | `faces2.tsx` (`MultiTimezoneFace`, `ZoneSearch`, `useLocalPlaceName`), `lib/zones.ts` | First tile = your location (weather place name from browser location, else the browser time zone's city). Up to **2** chosen cities; empty slots show "+ Add city". Clicking a tile (live clock only, `interactive` prop) opens a portal popover with a search box over every IANA zone (`Intl.supportedValuesOf('timeZone')`) showing city, region and offset; ↑/↓/Enter supported. `DEFAULT_ZONES` is now `[]` (no preset cities). The popover stops click propagation so picking a city doesn't also switch the clock style. |
| Right-click (secondary click) → previous face | `src/components/topbar/TimeWidget.tsx` | `onContextMenu` → previous style; left click still → next. Tooltip and hover hint updated. |
| `FaceProps.interactive` | `faces.tsx` | Only the top-bar clock passes it, so gallery previews never open pickers. |

### 2. Fixes

- **Git username** slightly smaller: 14.5 px → 13.5 px (`GitWidget.tsx`).
- **Mic doesn't turn off** (`src/hooks/useSpeechInput.ts`): `stop()` used
  `rec.stop()`, which waits for the engine to finish (seconds, sometimes never)
  while the button stays "listening". Now `stop()` aborts and clears state
  immediately. A `startingRef` guards a double start during the mic permission
  check, and a turn-off during that check cancels the start. An aborted older
  session's `onend` can no longer switch off a newer one.
- **Wheel over the cards scrollbar** (`src/components/CardsScrollbar.tsx`): the
  wheel/trackpad over the thin scrollbar under the category cards now scrolls
  the row (native non-passive listener). The cards themselves still ignore the
  wheel.

### 3. Category overview (menu left of the quick links)

- New icon `CategoryMenuIcon` (`src/components/CategoryOverview.tsx`): four
  filled rounded blocks (tall/short over short/tall) in `var(--color-accent)`, so it
  follows the theme.
- The overview now **replaces** the cards view instead of layering on top
  (`src/App.tsx`: `overview ? <CategoryOverview/> : <CategoryGrid/>`). Lighter DOM;
  only one view mounted at a time.
- The menu button glows while open (`.category-menu-btn.is-open`).
- Back to the cards: toggle the button, click the overview's top bar
  (`header role="button"`), its ✕, or Esc. Picking a category returns to the cards
  and scrolls to it after ~420 ms (the grid mounts first), then flashes it.

### 4. Full address on hover — `LinkPeek`

`src/components/ui/LinkPeek.tsx`, mounted once in `App.tsx`. A document-level
`mouseover` listener finds the nearest `a[href^="http"]`; after 380 ms a portal
popover shows the hostname and full URL (break-all, max 420 px, flips above near
the bottom edge). While shown, the link's own `title` is moved aside (restored on
leave) so the native tooltip doesn't double up. Hidden on mouse-out, mousedown,
scroll and window blur. Any subtree can opt out with `data-no-peek`.

### 5. Site Map editing + recycle bin

Data model (`src/types.ts`, `src/store/store.ts`, `src/store/seed.ts`):

- `PersistedState.trash: { sites: TrashedSite[]; processing: TrashedProcessing[] }`
  (additive, normalised on load; capped at 500 each, newest first).
- `deleteSite` now **moves the site to the trash**, recording `deletedAt`,
  `fromCategory` and `fromSubcategory` names.
- `deleteCategory` moves all of that category's sites to the trash.
- `deleteProcessingItem` moves the item to `trash.processing`. Its undo
  (`reinsertProcessingItem`) also takes it back out of the trash.
- `restoreSite(id, categoryId?, subcategoryId?)` puts a site into the given
  section. Otherwise it goes back where it came from if that still exists, else
  into the first category's General group.
- `purgeTrash({ sites?, processing? })`.

UI:

- **Shared Add/Edit site window** — `src/components/library/SiteFormDialog.tsx`.
  Settings → Library now renders this component, and its old inline modal and
  handlers were removed. The Site Map's "+ Add site" opens the same window,
  pre-set to that category.
- **Recycle bin list** under the form (add mode only): "Deleted / archived
  sites" with search, origin, time ago, and **Restore**, which restores into the
  category/subcategory chosen in the form.
- **Site Map** (`src/components/search/SiteMapModal.tsx`):
  - **+ Add new category** in the toolbar: the colour is chosen automatically by
    `nextFreeColor` and shown as a dot; it can be swapped for another unused
    swatch before adding.
  - **Per category card:** "+ Sub" adds a subcategory inline, and the bin icon
    deletes the category after an inline confirmation ("sites go to the recycle
    bin").
  - **Per subcategory section:** a bin icon deletes the section; its sites move
    to General (existing store behaviour).
  - **Recycle-bin drop target** (`SiteBin`) in each card's bottom-right corner:
    - dragging a site over it opens the lid (SVG lid rotates around its hinge)
      and the bin grows and turns red;
    - dropping deletes the site, plays a "gulp" bounce, and shows the Undo bar.
- **Colour picker logic** — `src/lib/palette.ts`: a 20-colour palette, and
  `nextFreeColor(used)` returns the first unused one. When all are used, it picks
  a golden-angle hue as far as possible from every hue in use. Settings → Library
  "+ New Category" also defaults to it.

### 6. Settings → Data

`src/components/settings/DataCleanup.tsx` (mounted in `DataTab.tsx`):

- **Clear cache**: removes `localStorage` keys `devdeck:cache:*` (weather, feeds,
  GitHub, favicons…), clears `sessionStorage` and Cache Storage. It reports how
  many entries went. Sites, tasks and settings are untouched.
  - The browser's own HTTP cache can't be cleared from a page; that needs the
    `browsingData` permission, which wasn't added.
- **Clear data…**: a stacked checklist with counts:
  - deleted sites (bin)
  - removed Focus/Queue sites
  - completed (archived) to-dos
  - demo data

  Then **Permanently delete (n)** → a second click on the inline warning ("This
  can't be undone… Continue with permanent deletion?") → `clearData(...)`.
- **Demo data**: `loadDemoData()` / `clearDemoData()` in the store, data from
  `src/lib/demoData.ts`. All ids start with `demo-`, so only demo items are
  replaced or removed.
  - **Focus / Queue:** 52 Focus + 52 Queue sites, cycling through:
    - every reminder frequency (minute / hourly / daily / weekly / monthly), with
      varied weekdays, times, intervals and days of month (including the last
      day), and some reminders off;
    - timers in every state (just set, mid-way, last-day clock, over today, days
      overdue, no timer).
  - **To-dos (156):**
    - status mix: about 20% completed, overdue, due within 25 min / 5 h, due in 2
      and 9 days, next month, no date;
    - priorities P1–P3 and none, 12 tags, notes, subtasks (partly done);
    - repeats (daily, weekdays, weekly, monthly, yearly) and some timers.
  - **Feeds:**
    - 30 topics with keyword lists;
    - 210 sources: per topic, HN search, HN newest, Dev.to tag, Dev.to top, Ask
      HN, Show HN (news) and Remotive search (jobs). These are the hosts the
      extension can reach (see manifest `host_permissions`).
- **Feed loading** (`src/services/feeds.ts`): `settleLimited` caps concurrent
  requests at 8, so 200+ sources don't flood the network. Results are cached as
  before.

### 7. Offline banner, icons, settings button

- `src/components/ui/OfflineBanner.tsx` (`useOnline` + banner): when the browser
  goes offline, it covers the category area (not the quick-links row). The veil
  is 75% transparent, with a slight blur, a centred card (wifi-off icon, "You're
  offline", reassurance text) and a pulsing "waiting for connection…". It doesn't
  block clicks (`pointer-events: none`) and disappears when back online.
- `src/components/ui/icons.tsx`:
  - `GearsIcon` (two meshing gears) replaces the feeds-panel ⚙ (now 32 px button,
    22 px icon) and the Focus/Queue manage cog (36 px button, 24 px icon);
  - `CogIcon` is the main settings icon;
  - `OfflineIcon`.
- **Main settings button** (`App.tsx`, `.settings-orb`): same 44 px box, now a
  raised accent-tinted tile.
  - Glossy top highlight, inner shadow, accent glow, outline ring.
  - Lifts on hover, presses on click; the cog rotates on hover.
  - Icon 28 px (was 20).
- **Topics list** scrolls after two rows (`max-h-[64px]`) so 30+ topics don't push
  the feeds down.

### 8. Greeting styles

- Six more (12 total): Chrome, Synthwave, Holo (animated iridescent), Terminal
  (mono, green, `> ` prompt), Fire, Ice. They're defined in `GREET_STYLES`
  (`src/types.ts`), with CSS at the end of `src/index.css` (light-theme variants
  included).
- **Click the greeting** → next style; **right-click** → previous
  (`DateGreet.tsx`). The Appearance gallery lists all 12 automatically. The name
  keeps its own look and spotlight.

### 9. Queue / To-do card and the to-do list

- `ProcessingPanel.tsx`:
  - **Headers:** D1/D2 badges removed. The top-right dots are gone; the two page
    dots now sit at the bottom middle of the card.
  - **Queue / To-do tabs:** two separate tab buttons (`.pane-tab`, accent fill
    when active, count pill). Click, or **scroll the wheel over them**, to switch.
  - **Manage button:** two gears, larger.
- **Sorting** (`src/lib/todos.ts`): overdue first (by due time), then by priority
  P1 → P2 → P3 → none. Within the same priority, your manual (drag) order.
- **Row tint** (`todoTone`): overdue (red, existing), due within 1 h (amber), due
  today (accent), this week (light blue), later or no date (plain). Rows with a
  priority get a glowing coloured bar on the left (`var(--prio)`).
- **Footer:**
  - **Summary chips** (`StatChip`): "x to-do", "y overdue", "z priority",
    "n need action". "Need action" means overdue, due within the hour, or P1 and
    due today (`needsAction`).
  - Clicking a chip toggles it: it glows, and its tasks move to the top
    (`matchesFocus`). Click again, or click "x to-do", to go back.
  - With nothing pending it reads "Zero pending 🎉".
  - Footer icons are larger (28 px buttons, 15–17 px icons), vertically centred.
    The footer now sits at the bottom of the card, which moves its separator line
    lower.

### Data/compatibility notes

- All schema additions are optional or normalised (`trash`, `greetStyle`,
  `interval`, `dayOfMonth`, `timer`, `createdAt`…). Old saved data loads without
  migration.
- Retired clock face (`circular-progress`) falls back to the default face.

---

## Round 2026-10-18 (summary, committed `be5fc3e` and earlier)

- **Countdown timers** on to-dos and Focus/Queue sites (`lib/timer.ts`,
  `ui/Countdown.tsx`, `ui/TimerPanel.tsx`), counted from the item's creation:
  "N days left" → "hh:mm left" on the last day → "hh:mm over" the same day →
  "N days overdue". Minute and hour timers tick hh:mm:ss.
- **Undo bar** (`ui/UndoToast.tsx`): 5 s, pauses on hover, Ctrl/⌘+Z. Covers
  deleted to-dos and removed Focus/Queue sites.
- **Weekly / monthly reminders** for Focus/Queue sites (`lib/schedule.ts`):
  - weekly: chosen weekdays, every 1–4 weeks;
  - monthly: a day of the month or the last day, every 1/2/3/6 months;
  - the interval resets when the frequency changes.
- **Site reordering** only in the Site Map and the Bookmarks drawer: drop onto a
  site to land before it (`placeSite`).
- **Themed dropdowns:** a themed `Select` (`ui/Select.tsx`) replaces every native
  `<select>`.
- **Category overview, pins and the card row:**
  - category overview (first version);
  - pin/unpin sites to a card's top row;
  - scrollbar-only card row.
- **Search and greeting:**
  - AI-coloured search glow;
  - greeting styles (first six);
  - name spotlight;
  - snap-resize side columns;
  - Option A top bar.
- **To-do improvements:**
  - repeats;
  - safer quick-add parsing (whole day and month names only);
  - paged long lists (40 rows + Show more, about 70 ms per add with 200 tasks).

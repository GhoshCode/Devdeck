# DevDeck — Features & functionality

What each feature does, how to use it, and how to check it by hand. Every
section ends with a **manual test checklist**, ready for the combined QA pass.
Technical details live in [implementation.md](implementation.md).

**Setup for manual testing:**
1. `npm run build`.
2. Open `chrome://extensions`, turn on Developer mode, then **Load unpacked** →
   `dist/`.
3. Open a new tab.
4. In Settings → Data, click **Load demo data** to get realistic volumes: 104
   Focus/Queue sites, 156 to-dos, 30 topics, 210 feed sources.

Check every item in **dark and light** themes, and at **1920, 1512 and 1280 px**
wide where layout is involved.

---

## Round 2026-10-21 — notifications, search keys, stats, greetings

- **Settings → Processing → Notifications:** All notifications / Chrome built-in notifications / Alert pop-up notifications. With All ticked the other two are ticked and locked.
- **New tab:** start typing right away and it goes into DevDeck's search, not Chrome's address bar. The address bar shows the extension address; this is off by default — turn it on in Settings → Profile → Search (the address bar then shows the extension address).
- **Search keys:** Enter searches in a new tab · Ctrl+Enter in a new window · Alt+Enter asks your AI. Choose the search engine in Settings → Profile → Search. Scroll on the AI icon to switch AIs.
- **Alerts:** To-do and Queue alerts stay 10 s; Currently processing 5 s. Clear all is bigger.
- **Quick links:** in 1- and 2-card views the bar fits without scrolling; the fixed sites have a neon accent border. Main sites in a card show a pin; click it to unpin.
- **Layout:** in 1- and 2-card views the links row is as wide as the cards; extra width goes to Tech news first, then the left column.
- **Work panel:** the Currently processing expand button is in its bottom-right corner; switching tabs by scrolling is smooth (one tab per gesture).
- **Feeds** show 20 items per section. **Quotes** change every 30 minutes online (bundled ones offline) and are cut to fit with no "…".
- **CPU and RAM** meters beside the Settings button (extension).
- **Greeting:** a themed phrase for the time of day (office, afternoon, geek, night crawler); click for another, right-click for the next style.
- **Mini calendar** button shows today's date under the icon. **CLI clock** cycles 48 commands. The date line is larger and the UV badge a little lower.

**Manual test checklist**
- [ ] Notifications: All ticked locks the two below; untick it and turn pop-ups off, then a due to-do arrives as a Chrome notification only.
- [ ] Press Ctrl+T and type: the text appears in DevDeck's search.
- [ ] Enter / Ctrl+Enter / Alt+Enter do search in a new tab / search in a new window / ask the AI; the engine setting changes the search site; scrolling on the AI icon switches the AI.
- [ ] A Processing alert disappears after 5 s, a To-do or Queue alert after 10 s.
- [ ] Resize to a 2-card view: the links bar doesn't scroll, chips never overflow, and the news column is wider.
- [ ] Click a main site's pin badge: it leaves the main row and stays in its list.
- [ ] CPU / RAM meters update about every 2 s.
- [ ] Click the greeting a few times: the phrases change and fit the time of day.

## Round 2026-10-20m — tidy-ups

- The quick-links bar no longer spills into the terminal; extra chips stay inside the bar.
- No outer frame around the category cards.
- Work panel tabs slide smoothly (one animation); a sideways swipe moves one tab.
- The terminal looks like a small console: a coloured prompt (PS ❯ ~ on Windows, $ ❯ ~ on Mac and Linux), scanlines and a glow while typing. Its window mark matches your system: three traffic-light dots on a Mac, a >_ mark on Windows and Linux.
- Administrator mode turns the terminal amber: border, prompt (#) and the text cursor.
- The quick-links bar and the buttons beside it sit a little lower, with all three columns level; the Git tiles sit lower inside their box.
- Extension version 3.0.0.

**Manual test checklist**
- [ ] Narrow the window: the quick-links chips never cover the terminal; extra chips scroll inside the bar.
- [ ] No outer box around the category cards; the cards sit just under the links bar.
- [ ] The links bar, Calendar bar and terminal row are level, and the cards, Calendar bar and Tech news start at the same height.
- [ ] Work panel: clicking Currently processing → To-do slides straight across with no flicker, and the highlight slides with it; a sideways swipe moves one tab; the first tab shows "Currently processing" in full on wide screens.
- [ ] Terminal on Windows shows >_ and PS; on Linux >_ and $; on a Mac the three dots and $.
- [ ] Turn on Administrator mode: the border, the prompt (#) and the blinking cursor are amber; turn it off and they return to the accent.


## Round 2026-10-20l — work panel, AI shortcut, alert polish

- **Work panel:** the expand buttons on the Currently processing card and on the Queue / To-do card open one big panel with three tabs: Currently processing, Queue and To-do. It opens on the tab you came from. Switch with the tabs, the dots, a sideways swipe or ←/→. **Review** on the overdue alert opens it on To-do with overdue tasks first.
- **Ctrl+Enter** in the search bar asks your AI (Alt+Enter works too).
- The clock is a bit bigger; the UV index sits under the temperature; On this day has a small refresh icon at the end.
- Settings → Appearance → Greeting: checkboxes to show or hide the On this day and quote lines.
- Alerts show a thin line that shrinks as their time runs out. While alerts are up, the area behind them is blurred and can't be clicked by mistake.
- Mini calendar: double-click the month or year for side-by-side Month and Year wheels.

**Manual test checklist**
- [ ] The Currently processing expand button opens the panel on Currently processing; the Queue expand opens Queue; the To-do expand opens To-do. Tabs, dots, swipe and ←/→ all switch; Esc closes.
- [ ] Processing / Queue cards: Open, Set timer, Move, Remove (Undo) work; Manage opens the editor.
- [ ] Overdue alert → Review → To-do tab, overdue first.
- [ ] Type a query and press Ctrl+Enter → your AI opens with the text.
- [ ] Clock is larger; UV under the temperature; the refresh icon is at the end of the On this day line.
- [ ] The two Greeting checkboxes hide and show their lines.
- [ ] An alert's line shrinks right → left and pauses on hover; clicks behind the stack do nothing.
- [ ] Mini calendar: double-click the month or year → two wheels; picking changes the month; Esc closes the wheels, then the calendar.

## Round 2026-10-20k — type to search, Clear all, Command Calendar


- **Type anywhere to search:** with nothing selected, just start typing (or paste) and the text lands in the search bar. Long or multi-line text shows a small expand button at the bottom-right of the bar. Expanded, it becomes a roomy composer: Shift+Enter for a new line, Enter to search or ask the AI, Esc to collapse. Your text is kept.
- **Clear all:** when two or more reminders are on screen, a "Clear all (N)" pill appears under them and sweeps them away.
- **Command Calendar:** click the **Calendar** bar above Currently processing. It opens full screen:
  - Day, Week, Month and Agenda views, with your to-dos, Currently processing and Queue items that have a due date, plus your own events: meetings, calls, VIP, deep work, deadlines and travel;
  - click or drag on the grid to schedule; **New item** creates an event, to-do, Queue or Processing item, or schedules an existing one;
  - today's briefing pills (click one to show only that kind), the conflict radar with **Auto-resolve**, **Focus Shield** (blocks your next free 2 hours), a second time-zone rail, and the alert stack on the right;
  - keys: D/W/M/A, ←/→, T, N, F, /, B, Esc.
- The calendar takes your theme: its colours follow your accent and its glass shows your backdrop through it, in light and dark.
- **Mini calendar:** the small calendar button next to the Calendar bar opens a simple glass month calendar, just dates. Use the arrows to move, PgUp/PgDn to change month, T for today and Esc to close.
- **Calendar alerts:** events alert as a rounded capsule with a live countdown and Acknowledge / Snooze 5m / Jump to slot; it stays until you act. To-do, Queue and Processing alerts keep their usual look.

**Manual test checklist**
- [ ] Click an empty spot, type "react": the search bar fills, the caret is at the end, and suggestions show. Ctrl+V on an empty spot pastes into it. Typing inside other fields or dialogs is unaffected; `/` and `,` still work.
- [ ] Paste 4 lines: the expand button appears; expand → full-width drawer with the line count; Shift+Enter adds a line; Esc collapses with the text kept.
- [ ] Two or more alerts → "Clear all (N)" under the stack; click it → cards slide out; with one left the pill disappears.
- [ ] The Calendar bar shows the next item and the meeting count; it opens full screen; Esc closes it and focus returns to the bar.
- [ ] Day: Now line and time pill; overlaps side by side; conflict badges; drag 10:00–11:30 → modal prefilled; save → the block flashes.
- [ ] To-do checkbox on a card completes it (Undo works); Queue cards are dashed amber; Processing cards pulse.
- [ ] Week: per-day item count and load bar; Month: green/amber/red top edges and "+ N more"; Agenda: three lanes.
- [ ] Conflict radar → Auto-resolve moves the colliding to-do/Queue/Processing due dates; Focus Shield adds a 2 h deep-work block.
- [ ] An event with "5 min before": the capsule alert appears on time; Snooze 5m brings it back; Jump to slot opens the calendar on it. On another website (extension) the same capsule shows.
- [ ] Light theme: every calendar surface is readable.
- [ ] Change the accent colour in Appearance: the calendar's buttons, today marker, Now line badges and launcher follow it.
- [ ] Mini calendar: opens beside the bar, today glows in the accent, week numbers are right, PgDn/PgUp change month, Esc and clicking outside close it.


## Round 2026-10-20j — On this day and quotes


- Under the greeting, above the quote: **On this day**, one tech or computing event from today's date in history. Hover and press ↻ for another event from the same day; click it to open the Wikipedia article. You can turn it off in Appearance.
- The daily quote comes from an online library of more than 1,400 quotes. It's the same all day; ↻ gives a random one.
- **All categories** is its own button to the left of the quick-links bar, and moves with the bar.

## Round 2026-10-20i — offline panel

- After the network returns (or the extension is reloaded), the "You're
  offline" panel goes away and news, GitHub and icons load again.
- While the offline panel is showing, the sites behind it can't be clicked.

## Round 2026-10-20h — clean console while feeds load

- **What was happening:** opening Settings → Scraping (or simply waiting) could show red "403" errors in the browser console. Hacker News's API sometimes refuses requests.
- **Now:** DevDeck's background part makes those requests, so the page console stays clean. A source that's refused still shows in the ↻ tooltip of Tech news.

**Manual test checklist**
- [ ] DevTools console (on the DevDeck tab) stays empty while feeds load, after opening Settings → Scraping, and after toggling Wi-Fi off and on.

---

## Round 2026-10-20g — latest changes

- **To-do list in a narrow column** (all three category cards showing): task names stay readable and dates show compactly. Tags, subtasks and the P-label appear when there's room. The footer chips shorten ("5 · 1 late · 5 prio") instead of wrapping.
- **More room for items:** a slimmer bottom band in Queue / To-do, and a slightly smaller settings button.
- **Queue / Currently processing text:** a touch smaller than last round (14 px / 11 px), still larger than before.

**Manual test checklist**
- [ ] Drag the side columns so the centre shows 3 cards: to-do rows show the task name plus one chip, with no overlap; the footer is one line.
- [ ] Widen the left column: tags, P-labels and full chip labels come back.
- [ ] More rows fit in Queue / To-do than before.

---

## Round 2026-10-20f — latest changes

- **Reminders reach you anywhere in Chrome:**
  - DevDeck in view: the panel shows in DevDeck.
  - On any other website (even with DevDeck closed): the same top panel drops onto that site.
  - On Chrome's own pages (Settings, Extensions, the Web Store) or with Chrome in the background: Chrome's bottom-right notification.
  - From a website, the buttons still work: Open, Snooze 10m, Mark done (applied when DevDeck next opens, if it's closed).
- **Bookmarks:**
  - a floating panel in the middle of the screen (like the Site Map);
  - deep folders and long names scroll sideways;
  - **Expand all** opens every folder (smoothly, even with thousands of bookmarks); press it again to collapse.
- **Tree View:**
  - readable with real collections: folders that only contain sites stack neatly under their parent instead of one endless row;
  - it opens at a comfortable zoom (Fit shows everything);
  - icons come from Chrome's own cache.
- **Layout:**
  - the quick-links bar floats above the category cards;
  - the left and right cards start level with the cards;
  - the terminal sits above Tech news, and the Git box is taller;
  - **All categories** is at the bottom-left of the cards container;
  - the pin badge on top-row tiles is gone;
  - bigger names and schedule text in Currently processing / Queue.

**Manual test checklist**
- [ ] With DevDeck closed, on youtube.com: a due reminder drops in at the top; Open / Snooze / Mark done work.
- [ ] On chrome://settings: a Chrome notification instead.
- [ ] Bookmarks: the panel is centred; Expand all opens everything without freezing; Collapse all returns; deep rows scroll sideways.
- [ ] Tree View with your real bookmarks: readable on open; drag sites and folders.
- [ ] Layout: the left card, the cards and the news card tops line up; the terminal sits level with the quick-links bar.
- [ ] The console stays clean (DevTools) while browsing, opening the Site Map and opening bookmarks.

---

## GitHub refresh (round 2026-10-20e)

- The Git widget fetches new data from GitHub every **3 hours** (it was every 30 minutes). Press ↻ for an instant refresh.

**Manual test checklist**
- [ ] After a reload within 3 hours, the widget shows cached data without new GitHub requests (DevTools → Network).
- [ ] ↻ fetches immediately.

---

## Clean console + small polish (round 2026-10-20d)

- **No console errors:** switching subcategory chips or opening the Site Map no longer logs errors. Sites without a favicon show their letter tile straight away, and the browser is never asked for an icon that doesn't exist.
- **Site Map cards:** a larger delete button at the top right, a slimmer header, and larger "+ Sub category" / "+ Add site" buttons.
- **Settings → Scraping:** the items-per-section sliders are thin, half width, with just the number beside them (no dots).

**Manual test checklist**
- [ ] DevTools console stays empty while switching chips on every card and while opening and scrolling the Site Map (in the installed extension).
- [ ] pkg.go.dev / CVE Details etc. show letter tiles.
- [ ] The Site Map card delete button is easy to hit; the add buttons are readable.
- [ ] The slider is half width and minimal in dark and light themes; dragging updates the number.

---

## Reminder alerts (round 2026-10-20b)

- **What they are:** reminders drop in from the top of the page as solid, matte cards tinted with your theme colour, with a thin accent border. They use large, high-contrast text that reads at a glance in both themes.
- **When they appear:**
  - a Currently processing or Queue reminder time arrives;
  - a to-do reaches its due date and time;
  - any timer runs out;
  - when you open a tab, one summary if anything is overdue (at most every 30 minutes).
- **Four looks:**
  - **Currently processing** — a wide banner with the site's icon in a glowing ring.
  - **Queue** — a slim "Up next" pill.
  - **To-do** — a checklist card with a priority stripe and a tick to complete.
  - **Overdue summary** — counts for To-dos, Queue and Currently processing.
- **Buttons:**
  - **Open** opens the site in a new tab; for to-dos it shows the To-do list and highlights the task.
  - **Snooze 10m** brings it back in 10 minutes, even in another tab.
  - **✕** dismisses it. To-dos also have **Mark done**; the summary has **Review**.
- **Stacking and timing:** up to 3 show at once (newest on top); more wait behind "+N more reminders". They hide after 12 s unless you hover.
- **No doubles:** while a DevDeck tab is in view you get the glass alert; otherwise a system notification.
- **Settings → Appearance → Multi-Timezone:** adding a city now uses the same world-wide search as the clock, with 2 cities in 24-hour time.

**Manual test checklist**
- [ ] Set a to-do timer to 1 minute: the to-do card drops in when it ends, with the priority stripe colour right.
- [ ] A Queue / Currently processing timer of 1 minute: pill and spotlight designs.
- [ ] An overdue to-do, then a new tab: the summary appears once; another new tab within 30 min doesn't repeat it.
- [ ] Mark done, Open, Snooze 10m (comes back after 10 min), ✕; hover pauses auto-hide.
- [ ] 4+ alerts at once: 3 visible + "+N more"; closing one makes the others close up smoothly.
- [ ] Switch to another tab when a reminder is due: a system notification instead (extension and web), never both.
- [ ] Dark and light themes, with several accent colours: the text reads instantly (nothing shows through the card).

---

## Browser bookmarks (round 2026-10-20a)

- **Opening:** the bookmark button (beside Site Map) now opens **your browser's bookmarks**, live and two-way: changes here change the browser, and changes in the browser appear here instantly.
- **Folders:** they nest to any depth; click a folder to expand it. Hover a folder for **+** (Add sub folder), **Edit** and **Delete**.
  - Deleting a folder that has bookmarks asks first.
  - Every delete can be undone for 5 s.
- **Sites:** they open in a new tab, and can be edited (name and URL) or deleted.
- **Filter** finds bookmarks by name or address, and shows the folders they're in.
- **+ Add folder** adds a top-level folder (in the Bookmarks bar, or another top-level container you pick).
- **Tree View** (top of the panel): the whole collection as a tree flowing top to bottom.
  - Drag a site, or a folder by its header, onto another folder to move it there.
  - A folder can't go inside itself (shown in red).
  - Drag the background to pan, use the wheel to zoom, and press Fit to see everything.
  - Esc cancels a drag, and closes the view.
- **Outside the extension** (the plain website) the panel only explains that bookmarks need the extension.

**Manual test checklist**
- [ ] The panel matches chrome://bookmarks; add, rename or delete something in chrome://bookmarks → it appears here at once.
- [ ] **+** shows "Add sub folder" on hover, sits left of Edit; sub folder created in the right place.
- [ ] Delete a non-empty folder → confirm → Undo restores it with everything inside.
- [ ] Tree View: drag sites and folders between boxes; the ghost follows smoothly; the target highlights; a folder dropped on its own child is refused.
- [ ] Drag near the canvas edge → it auto-pans; Esc during a drag cancels it.
- [ ] A large real profile (hundreds of bookmarks) stays responsive in both the panel and Tree View.
- [ ] Dark and light themes.

---

## 000000000. Round 2026-10-19j — latest changes

- **Multi-Timezone clock:** every city shows 24-hour time (e.g. 21:23).
- **Flip clock:** DEVDECK sits on a small plate at the top of the case, fully visible, with tight padding, in dark and light themes.
- **DevDeck stays open:** clicking any site, pressing Enter in the search bar or Site Map search, or asking an AI opens the result in a **new tab**.
- **Drag a site out:** drag a site from the Site Map panel or from the category cards and let go outside that box (or outside the browser). It opens in a **new browser window**.

**Manual test checklist**
- [ ] Multi-Timezone: local + 2 zones in 24-hour, no AM/PM.
- [ ] Flip: the plate is readable and not cut in both themes, at 1920 / 1366.
- [ ] Click a site row, a top-row tile, a Site Map chip, an overview site, a quick link: each opens a new tab; DevDeck stays.
- [ ] Search "vite" + Enter, and a built-in "open" command: new tab.
- [ ] Drag a Site Map chip onto the dimmed area outside the panel: new window. Drag it onto a section: it moves (no window). Drag it onto the bin: deleted (no window).
- [ ] Drag a deck site row out of the cards box onto the side column, and out of the browser window: new window. Drop it on the tab strip: new tab (the browser's own behaviour).

---

## 00000000. Round 2026-10-19i — latest changes

- **Terminal box:**
  - on Linux it shows `$` and "run a command in your terminal…"; PowerShell only appears on Windows;
  - opened from localhost (not as the extension), it explains why commands can't run.
- **Location:** a bigger map pin in the accent colour, centred beside the area and city lines.
- **Greeting:** sits a little lower.

**Manual test checklist:** see `qa-strategy.md` §10 (T1–T10) for the terminal, plus:
- [ ] Location pin: about 18 px, centred against both lines (area + city) and against "Locating…" / "Set location".
- [ ] Greeting: lower, still clear of the search bar at 1366×768.

---

## 0000000. Round 2026-10-19h — latest changes

- **Deleting a subcategory:** no prompt. Its sites move to Deleted / archived sites, and an undo bar shows for 5 s ("Deleted Tools — 3 sites moved to the recycle bin"). Undo brings the subcategory and its sites back.
- **Deleting a category:** still asks first. The category and its subcategories go; its sites move to Deleted / archived sites.
- **Fixed:**
  - the dropdowns in the Add Site window now open in front of it;
  - after dropping a site on the bin, the card no longer stays in drag mode;
  - Esc closes the Site Map even after the Add Site window was closed.
- **All Categories view:** long names wrap onto a second line instead of being cut.
- **Main container:** a slimmer strip under the cards; pinned tiles get a bit more room.
- **Flip clock:** the DEVDECK plate isn't clipped and has more padding.

**Manual test checklist:** see `qa-sitemap-lifecycle.md` (automated walk-through results) plus:
- [ ] Settings → Library: delete a subcategory → undo bar → Undo restores it with its sites.
- [ ] Bookmarks drawer: the same.
- [ ] Overview at one-card width: "SYSTEMS & LOW-LEVEL" and "DATA SCIENCE & ANALYTICS" show in full.

---

## 000000. Round 2026-10-19g — latest changes

- **Pin icon:** a clean outline thumbtack everywhere: site rows, the small unpin
  badge on top-row tiles, and the category pin. The badge is a quiet dark
  circle that only takes the accent colour on hover.
- **"Focus" is now "Currently processing":** the top card's label, new items,
  and existing saved items all use the new name, so there's nothing to redo.

**Manual test checklist**
- [ ] Hover a top-row tile: the unpin badge shows a thin outline pin (no solid pink blob); hover the badge: accent outline.
- [ ] The category pin button uses the same icon; pinned shows a light tint.
- [ ] The top card's tab reads "CURRENTLY PROCESSING" and fits; old "Focus" items now show under it; the Site Map and the Processing editor show the new name.

---

## 00000. Round 2026-10-19f — latest changes

- **Site Map chips:** rows still fill the card, but the last row's chips are only as wide as their names.
- **New category (Site Map header):** "+ New Category" turns into a colour swatch plus a name field, with Add and Cancel.
  - The swatch starts with a colour no other category uses; click it to pick another.
  - Enter adds; Esc cancels.
- **Deleted / archived sites** (in the Add Site window):
  - **Restore:** puts a site back where it was:
    - in its old subcategory;
    - in its category's **General** group if that subcategory was deleted;
    - in **Uncategorized** if the whole category was deleted.
  - **Row text:** "Restores to Category › Sub", or just "Uncategorized" when the category is gone.
  - **Add to URL** (left of Restore): copies that site's address and name into the form above.
- **Uncategorized sites:**
  - On the deck they sit as loose tiles in the empty space after the last category card.
  - In the Site Map and in the Settings sitemap graph they appear under **Uncategorized / None**, with no subcategories.
  - Drag one onto any section in the Site Map to file it.
  - Search finds them too.

**Manual test checklist**
- [ ] Site Map: a section with 7 chips — the first rows fill edge to edge; the last chip(s) have natural width.
- [ ] New Category: the swatch colour isn't used by any category; changing the colour works; Enter adds; Esc cancels without closing the Site Map.
- [ ] Delete a site in a subcategory → the bin shows "Restores to Cat › Sub" → Restore puts it back there.
- [ ] Delete a site, then delete its subcategory → the bin shows "Cat › General" → Restore lands in General.
- [ ] Delete a whole category → its sites show "Uncategorized" → Restore puts them in the Uncategorized area (deck, Site Map, Settings sitemap).
- [ ] Add to URL fills the URL and name fields; the site stays in the bin.
- [ ] Uncategorized tiles open the site; dragging one in the Site Map onto a section files it; the area disappears when empty.
- [ ] Edit an uncategorized site: the Category shows "Uncategorized (none)"; saving keeps it there or moves it if you pick a category.

---

## 0000. Round 2026-10-19e — latest changes

- **Time-zone search:** a much wider dropdown with bigger text. Each result shows the city and the full line of country, zone name and main cities, wrapping if needed.
- **Items per section:**
  - the number labels under the dots are gone;
  - the chosen amount shows in a highlighted box ("25 items");
  - when you close Settings after changing an amount, Tech news and Dev jobs reload (the progress bar shows) and fill up to the new number.
- **Queue / To-do switch:** the active tab has a thin border in your theme colour.
- **Greeting:**
  - a long or decorative name is never cut off; the greeting wraps and the quote moves down;
  - Roman caps is removed from the name fonts.

**Manual test checklist**
- [ ] Time zones: search "india"; the whole cities list is readable; text is larger; the dropdown stays on screen at 1280 px.
- [ ] Slider: no 0/10/…/100 labels; dots still jump to values; the value box reads "N items".
- [ ] Change Tech news from 4 to 40, close Settings: the progress bar runs and the panel lists up to 40. Close Settings without changes: no reload.
- [ ] Switch border follows the accent in several themes (dark and light).
- [ ] Name in Script / Handwritten / Italic: fully visible with no clipped swash; with a long name, the greeting wraps and the quote sits below it.
- [ ] Roman caps no longer appears in Appearance → Name font.

---

## 000. Round 2026-10-19d (phase 4) — latest changes

### Greeting
- The greeting is a little bigger and sits a little left of centre.
- **Your name:**
  - **click** it to try the next typeface; **right-click** goes back;
  - **double-click** it to rename it right there (Enter saves, Esc cancels).
- **Typefaces:** Grotesk, Script, Italic serif, Handwritten,
  Condensed and Mono. You can also pick one in Settings → Appearance → Greeting
  → Name font.

**Manual test checklist**
- [ ] Clicking the name changes only its font (not the greeting style); clicking the greeting words still changes the style.
- [ ] Double-click shows an input with the current name; Enter saves; Esc keeps the old name; clicking away saves.
- [ ] Every font renders; nothing is clipped (Script and Handwritten have tall letters); dark and light themes.
- [ ] The Appearance picker matches the greeting.

### Category pages
- Each wheel step or dot click on the strip under the cards moves a whole page.
  The next page never repeats a card from the page you just left.

**Manual test checklist**
- [ ] At 1920 px with 7+ categories: page 2 starts with the 4th card; the last page shows the leftovers plus blanks.
- [ ] After dragging a side column to take a card (2 per page), paging moves by 2.

### Flip clock
- The previous plate is back (subtle, dark), with more space around the DEVDECK letters.

**Manual test checklist**
- [ ] DEVDECK has visible padding on all sides and isn't cramped against the plate edges.

### Queue / To-do switch
- **Calmer style:** the active tab is a lightly raised glass tile with a thin
  accent line at the bottom. There's no glow or bright fill.

**Manual test checklist**
- [ ] No pink/neon glow; the active tab is still clear; the accent icon and underline follow the theme accent; light theme looks clean.

---

## 00. Round 2026-10-19c — latest changes

### Site Map
- **Card layout:** cards pack into columns by height, so a short card no
  longer leaves a gap beside a tall one. Order runs left to right, then into
  the shortest column.
- **Site chips:** they stretch so every row fills the section from wall to wall.

**Manual test checklist**
- [ ] With uneven categories, no big empty holes under short cards; resizing the window re-packs smoothly (1, 2 or 3 columns).
- [ ] Renaming, adding a subcategory or site, or deleting with the bin doesn't reset the cards; they glide to new spots.
- [ ] Drag a site between cards: still works.
- [ ] Chips in every row reach both edges of the section.

### Greeting: add your name
- With no name set, hover the greeting: a faint **+ Add your name** button
  appears beside it.
- Click it, type, and press Enter: the greeting shows your name. Esc or
  clicking away cancels.

**Manual test checklist**
- [ ] Hidden until hover; no layout jump when it appears.
- [ ] Enter saves (also visible in Settings → Profile); Esc and blur cancel; the button is gone once a name is set.
- [ ] Clicking the button does not change the greeting style.

### Clocks
- **Modern Analog:** back to the previous design (in a card, with the smaller readout).
- **Typographic Word:** less space above and below, bigger words, slightly more space between lines.
- **Flip:** the DEVDECK plate is larger, brighter and sits higher on the housing.

**Manual test checklist**
- [ ] Word clock fits its box at 1920, 1512 and 1280 px without clipping the last line.
- [ ] Flip: DEVDECK is clearly readable in dark and light themes.
- [ ] Analog looks as it did before the last round.

### Multi-Timezone
- The city search now covers every time zone in the world.
- Each result shows the city plus the UTC offset, country, zone name and main
  cities.
- Search by city, country, zone name or abbreviation, for example "india",
  "IST", "pacific" or "são paulo". Several words narrow the list.

**Manual test checklist**
- [ ] Type "japan" → Tokyo; "eastern" → New York; "nepal" → Kathmandu (+05:45).
- [ ] Picking a result adds that clock; the offset shown matches.
- [ ] The list scrolls through the whole world when the box is empty.

### Queue / To-do switch
- **New look:** a recessed track with a glossy accent pill that slides under
  the active tab.
- **Tabs:** each has an icon, label and count. The active tab's count is a
  white badge.

**Manual test checklist**
- [ ] The pill slides smoothly; clicks and the wheel over the switch change panes.
- [ ] Readable in the light theme (white text on the pill).

### Scraping & News settings
- **Items per section:** a slider for Tech news and one for Dev jobs.
  - Range 0–100, with points at 0, 10, 20 … 100 (click a point to jump there).
  - 0 hides that list.
- **Topic chips:** turn on as many as you like; the panels show items that
  match any of them. **All** clears the selection.

**Manual test checklist**
- [ ] Set Tech news to 25: the panel lists 25 (if available); Dev jobs numbering continues from 26.
- [ ] Set a slider to 0: the list shows the "Hidden" hint.
- [ ] Select 3 topics: all three chips glow; the header shows "3 topics"; deselect all → All is active.

### Loading indicators
- **Feeds:** while sources load, a thin accent bar fills along the top of Tech
  news and Dev jobs, and the header shows "fetching 34/210".
- **First load:** shimmer placeholders replace the blinking blocks.
- **GitHub widget and weather:** a slim sweeping bar while they refresh.

**Manual test checklist**
- [ ] With demo data (210 sources), click ↻ in Tech news: the bar fills from left to right, and the count climbs and then fades.
- [ ] Clear cache, then reload: shimmer rows show until the first items arrive.
- [ ] Click the weather row or the GitHub refresh: a sweep shows briefly.
- [ ] With reduced motion on, there is no sweep animation.

---

## 0. Round 2026-10-19b — latest changes

**Setup:** `dist/` is now a demo build (`npm run build:demo`).
- On its first open it loads the demo data by itself: 104 Focus/Queue sites, 156 to-dos, 30 topics and 210 feed sources.
- To start empty, use Settings → Data → **Remove demo data**, or build with `npm run build`.

### Clocks
- **Flip:** hours, minutes and seconds cards, bigger. A printed DEVDECK plate sits on top of the housing.
- **HUD:** bigger readout, slightly lower.
- **Modern Analog:** no box, a bigger dial with a soft accent glow behind it, and a bigger digital time (with seconds) beside it.
- **Kinetic Orbital:** the digital time sits beside the ring, not inside it; the box stays.
- **Typographic Word:** less top/bottom padding, bigger words.
- **Diffused Glow:** bigger.
- **CLI Sophisticated:** a line of code types itself in the bottom-right corner, then the next one.
- **Cyberpunk 2077:**
  - Each new minute, a tiny flicker at the far left and right edges.
  - Every 5 minutes, a short old-TV channel-change distortion at the edges, in the theme colour.
  - Neither ever covers the time.
- **macOS minimal:** centred.

**Manual test checklist**
- [ ] Flip shows HH : MM : SS; the seconds card flips every second; DEVDECK sits on the top edge of the box.
- [ ] HUD, Analog, Word and Glow are visibly larger; nothing is clipped at 1280 px.
- [ ] Analog has no card, only the glow; the digital time is beside the dial.
- [ ] Kinetic: no text inside the ring.
- [ ] CLI: the typing line runs bottom-right and doesn't overlap the time.
- [ ] Cyberpunk: watch a minute change (edge flicker) and a :00/:05 change (channel distortion); the time stays clear; nothing moves with reduced motion on.
- [ ] macOS is centred.

### Icons & settings
- The feeds and Focus/Queue manage buttons use the **sliders** icon.
- The main settings button is a calm cog on a glass tile. It only lights up on hover.

**Manual test checklist**
- [ ] Sliders icon on both buttons, in dark and light themes.
- [ ] The settings cog doesn't glow at rest; on hover it gets an accent ring and turns slightly.

### Offline banner
- The banner appears when the network adapter is off, **and** when Wi-Fi is
  connected but there is no internet.
- It checks every 20 s, at once when you come back to the tab, and every 5 s
  while offline.

**Manual test checklist**
- [ ] Turn Wi-Fi off: the banner shows within a second or two.
- [ ] Turn it back on: the banner goes within about 5 s.
- [ ] Keep Wi-Fi on but unplug the router's internet (or block gstatic.com): the banner shows within about 20 s, or at once after switching tabs and back.

### Site Map
- **+ New Category** sits at the top of the Site Map, as in Settings → Library.
  Its colour is preset to one no other category uses, and only unused colours
  are offered.
- Each category card has a bottom bar, under a thin divider:
  **+ Sub category**, **+ Add site** and the recycle bin.
- In the new-subcategory field:
  - **Enter** or **Add** creates it;
  - clicking anywhere else or pressing **Esc** just closes the field, with nothing created.

**Manual test checklist**
- [ ] New Category: the preset colour isn't used by any category; the swatches show only unused colours; Add Category creates the category.
- [ ] Each card's bottom bar: divider, then + Sub category, + Add site and the bin aligned on one line.
- [ ] Type a name, then click outside: no subcategory is created and the field is gone. Same with an empty field.
- [ ] Type a name, then click Add: it is created.

### Queue / To-do card
- No scrollbars anywhere in the card. Lists still scroll with the wheel.
- Both panes end in the same bottom band under a divider:
  - **To-do:** the chips ("Zero pending" etc.), archive and expand, centred vertically;
  - **Queue:** "N queued" and the manage button.
- Scrolling the wheel over that bottom band (or the dots) switches between Queue and To-do.
- The **Focus** card shows its name and count in a small tab hanging from the
  middle of the top border.
- No emoji: "Zero pending", "All done — add the next one above."

**Manual test checklist**
- [ ] No scrollbar visible in Focus, Queue or To-do, even with demo data; lists still scroll.
- [ ] Text, archive and expand line up vertically in the band; the Queue band matches the To-do band's height.
- [ ] Wheel over the band: down/right → To-do, up/left → Queue. Wheel over the list scrolls the list, not the panes.
- [ ] The Focus tab is centred and attached to the top border, with rounded bottom corners, in both themes.
- [ ] No emojis anywhere in the card.

### Category row paging
- **The scrollbar is gone.** Dots under the cards show the pages; a page is as
  many cards as fit side by side.
- **Moving between pages:**
  - click a dot;
  - use ←/→ on the dots;
  - one wheel notch or swipe over the dot strip moves one page.
- **Last page:** its cards start at the left, and empty slots stay blank. For
  example, 7 categories in a 3-wide row gives pages of 3, 3 and 1, with 1 card
  and 2 blanks.
- **Overview jump:** opens the page holding that category.
- **Pinned card:** leads page 1. It no longer sticks to the left edge.

**Manual test checklist**
- [ ] With 7+ categories (demo data adds none, so add some via the Site Map): the dots count matches ceil(categories ÷ cards per row).
- [ ] One wheel notch over the dots = exactly one page; the cards line up at the left edge.
- [ ] The last page shows the leftover cards plus blank space.
- [ ] Resize the window (1920 / 1512 / 1280): the pages recompute and the row snaps to a page.
- [ ] Sideways trackpad swipes over the cards don't move the row.
- [ ] Overview → pick a category on page 3: the row opens page 3 and the card flashes.
- [ ] With ≤ 1 page of cards, there are no dots.

---

## 1. Clock

Click the clock to go to the **next** face; **right-click** goes back to the
**previous** one. Hovering shows the current face's name. All faces are also in
Settings → Appearance.

| Face | What you see |
|---|---|
| Cyberpunk 2077 | Time centred in its panel, chromatic glow. |
| **Chrono 2100** (was Neon Orb) | Futuristic analogue dial: glowing beam hands, orbiting second light, slowly rotating data rings, tick ring; readout of hh:mm, seconds and a seconds bar beside it. |
| **Flip Clock** | A real desk flip clock: dark case with DEVDECK label, recessed window, flip cards with hinge pins, glowing colon, AM/PM lamp, little feet. Cards flip when the time changes. |
| **Futuristic HUD** | Large readout on an armoured "weapon panel": carbon texture, vents, hazard stripes, rivets, `SYS.TIME // MK-II`, an ammo-style counter filling every 5 s. |
| **Multi-Timezone** | First clock = your location (browser location; else your time zone's city). Two more slots: click one to pick a city from a searchable list of every time zone (shows the offset). |
| Circular Progress | Removed. |

**Manual test checklist**
- [ ] Left-click steps forward through all faces; right-click steps back; no browser context menu appears.
- [ ] Cyberpunk: the time is horizontally centred.
- [ ] Chrono 2100: hands point at the right time; the second light moves smoothly; the rings rotate (and stop with "reduce motion" on).
- [ ] Flip: the case looks like a desk clock; minutes flip on change; AM/PM lamp is correct in 12 h mode.
- [ ] HUD: the readout is clearly bigger than before; the ammo counter advances every 5 s.
- [ ] Multi-Timezone: on a fresh profile it shows your city plus two "+ Add city" slots.
- [ ] Clicking a slot opens the city search **without** changing the clock face.
- [ ] Typing filters the city list; ↑/↓/Enter picks a city; the offset is right; the choice persists after reload.
- [ ] In the Appearance gallery, previews can't open the picker.

## 2. Small fixes

- **Git box:** the username is a little smaller.
- **Voice search:** clicking the mic again turns it off **immediately** (it used to keep listening).
- **Category cards:** scrolling the mouse wheel over the thin scrollbar under the cards moves the cards; anywhere else, the wheel doesn't move them.

**Manual test checklist**
- [ ] The mic turns on (red, "Listening…"), and the second click turns it off at once; clicking quickly on/off/on behaves.
- [ ] Wheel over the scrollbar scrolls cards both ways; wheel over the cards themselves does not; dragging the thumb still works.

## 3. Category overview

The block icon left of the quick links (coloured with your theme accent) opens
**All categories** in place of the cards. The button glows while it's open.

- **Wide (3 card widths):** each category shows its name, site count, and pinned
  sites with icons and names.
- **Medium (2):** name, count and a row of site icons.
- **Narrow (1):** compact name boxes.
- **Clicking a category name** returns to the cards and scrolls to that card,
  which flashes.
- **Back to the cards:** click the icon again, click the overview's **top bar**,
  its ✕, or press Esc.

**Manual test checklist**
- [ ] The icon's colour follows the accent when you change theme/accent.
- [ ] Opening the overview hides the cards entirely (nothing visible behind it); the button glows.
- [ ] All three width modes appear when you snap-resize the side columns.
- [ ] The top bar, toggle, ✕ and Esc all return to the cards.
- [ ] Picking a category scrolls to and flashes its card.

## 4. Full address on hover

Hover any site, quick link, site icon, feed item, Focus/Queue item or Site Map
chip for about 0.4 s: a small popover shows the site name and its **full
address**.

**Manual test checklist**
- [ ] Appears for quick links, card tiles, subcategory rows, overview icons, feed items, Focus/Queue rows, Site Map and Bookmarks entries.
- [ ] Shows above the link near the bottom edge of the screen; never off-screen.
- [ ] No duplicate browser tooltip; disappears on leaving, clicking or scrolling.

## 5. Site Map: build and tidy your library

Open **Site Map** (next to the search bar).

- **+ Add new category** (top): the colour dot is picked for you, a colour no
  category uses yet. You can choose another unused swatch, then **Add**.
- **On each category card:**
  - **+ Sub** adds a subcategory;
  - the **bin icon** deletes the whole category after a confirmation. Its sites
    go to the recycle bin, not lost.
- **On each subcategory section:** the small bin deletes the section; its sites
  move to General.
- **+ Add site** opens the same window as Settings → Library → Add Site:
  1. Fill in the URL, name, category, subcategory and the "Primary" option.
  2. Under the form, **Deleted / archived sites** lists everything deleted, with
     search.
  3. **Restore** puts a site back into the category picked in the form.
- **Recycle bin (bottom-right of each card):** drag a site onto it.
  - The lid **opens** while you hover and snaps shut with a little bounce when you
    drop.
  - The site is deleted, and an **Undo** bar appears.
- **Dragging still works:** drop onto another site to reorder, or onto a section
  to move.

**Manual test checklist**
- [ ] A new category gets a colour no other category has; the swatches only offer unused colours.
- [ ] "+ Sub" adds a section that shows on the deck immediately.
- [ ] Deleting a category asks first, then removes it; its sites appear in the recycle bin.
- [ ] Deleting a section moves its sites to General.
- [ ] Bin lid opens on drag-over, closes on leave and bounces on drop; Undo restores the site.
- [ ] "+ Add site" shows the same window as in Settings → Library; adding works.
- [ ] The deleted list shows origin and time; search filters it; Restore adds the site to the selected category/section.
- [ ] Settings → Library: "+ New Category" starts with an unused colour; Add/Edit site uses the same window.

## 6. Settings → Data

- **Clear cache:** drops cached weather, news, jobs, GitHub activity and icons,
  so everything loads fresh. Your data stays.
- **Clear data…:** a list with counts and checkboxes. Untick anything you want
  to keep.
  - deleted sites
  - removed Focus/Queue sites
  - completed to-do tasks
  - demo data

  Press **Permanently delete (n)**, then confirm the warning "This can't be
  undone… Continue with permanent deletion?".
- **Demo data:**
  - **Load demo data** adds the test set (104 sites with every reminder type and
    timer state, 156 to-dos in every status, 30 topics, 210 news/job sources).
  - **Remove demo data** takes it all away again. Your own items are never
    touched.

**Manual test checklist**
- [ ] Clear cache reports a count; weather/feeds/GitHub reload afterwards; nothing else changes.
- [ ] Clear data: counts are right; unticked kinds survive; nothing is removed without the second confirmation.
- [ ] Load demo data: 52 Focus and 52 Queue sites, 156 to-dos (some completed), 30 topic chips, news panels fill (it can take a few seconds the first time).
- [ ] Remove demo data leaves your own items intact.

## 7. Offline banner, icons, settings button

- **Offline:** when the internet drops, a soft see-through veil covers the
  category area, with a "You're offline" card. The quick-links row stays clear.
  It goes away when the connection is back.
- **New icons:** the feeds-panel settings and the Focus/Queue manage button now
  use a larger **two-gear** icon, so they're no longer confused with the main
  settings.
- **Main settings button** (bottom-left): a raised, glowing accent tile with a
  bigger cog. It lifts on hover and the cog turns.

**Manual test checklist**
- [ ] DevTools → Network → Offline: the banner appears over the cards only; switch back: it disappears.
- [ ] Two-gear icons in the Topics header and the Focus/Queue card; both open the right settings.
- [ ] Settings button looks raised in both themes; hover/press feel responsive.

## 8. Greeting styles

**Click the greeting** for the next style, **right-click** for the previous one,
or pick from Settings → Appearance → Greeting. There are 12 styles: Classic,
Accent, Gradient, Aurora, Neon, Outline, Chrome, Synthwave, Holo, Terminal, Fire
and Ice. Only "GOOD MORNING," changes; your name keeps its own look.

**Manual test checklist**
- [ ] Click and right-click cycle styles both ways; the choice persists.
- [ ] Every style is readable in dark and light.
- [ ] The name never takes the style.

## 9. Focus, Queue and To-do

- **Headers:** Focus and Queue/To-do have clean headers (no D1/D2 badges).
- **Queue / To-do:** two buttons at the top of the card. Click one, or **scroll
  over them**, to switch. The page dots sit at the bottom middle.
- **Manage button:** bottom-right, a bigger two-gear icon.
- **Task order:** overdue first, then by priority (P1, P2, P3, none), then your
  own order.
- **Task colours:**
  - overdue: red
  - due within the hour: amber
  - due today: accent tint
  - due this week: light blue
  - prioritised tasks: a coloured bar on the left
- **Footer chips:** "x to-do · y overdue · z priority · n need action". Click a
  chip: it glows and those tasks jump to the top. Click again to go back.
  - "Need action" means overdue, due within the hour, or P1 and due today.
- **Footer controls:** bigger icons, centred vertically; the divider sits lower.

**Manual test checklist**
- [ ] No D1/D2 badges; no dots in the top-right; dots at the bottom middle follow the active pane.
- [ ] Wheel over the tab buttons switches panes; clicks too.
- [ ] Order: overdue → P1 → P2 → P3 → none; dragging still reorders within a priority.
- [ ] Row tints match due times; priority bar colours match P1/P2/P3.
- [ ] Each chip toggles, glows, floats its tasks to the top, and toggles back; counts are right.
- [ ] Footer icons are bigger and centred; works with 150+ tasks (demo data) without lag.

---

## Earlier features (round 2026-10-18) — quick checklist

- [ ] Timers: "N days left" → "hh:mm left" on the last day → "hh:mm over" the same day → "N days overdue"; minute/hour timers tick hh:mm:ss.
- [ ] Undo bar after deleting a to-do or removing a Focus/Queue site (5 s, pauses on hover, Ctrl/⌘+Z).
- [ ] Weekly (every 1–4 weeks, chosen days) and monthly (day 1–31 / last day, every 1/2/3/6 months) reminders.
- [ ] Reordering sites only in the Site Map and the Bookmarks drawer.
- [ ] Themed dropdowns everywhere (no native selects).

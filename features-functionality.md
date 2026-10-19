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

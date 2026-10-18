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

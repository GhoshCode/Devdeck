# QA — Site Map lifecycle (category → subcategories → sites → delete → restore)

**Date:** 2026-10-19 · **Build:** dev server (Vite, `localhost:5180`), branch `v8.1`
**Tool:** Playwright driving Microsoft Edge (Chromium), 1920×1000, fresh browser profile
**Themes:** dark and light (each a full run of the same scenario)
**Script:** `e2e/qa/sitemap-lifecycle.manual.mjs` (`node e2e/qa/sitemap-lifecycle.manual.mjs dark|light` while the dev server runs)
**Screenshots:** `screenshots/qa-sitemap/` (`dark-NN-…png`, `light-NN-…png`)

The scenario was run the way a careful end user would do it: through the UI only
(the Site Map button, its forms, the Add Site window, the recycle-bin drop
target, the undo bar, Escape). Saved state was read from `localStorage` after
each step to confirm what the screen showed.

## Result

**Final runs: 35 / 35 checks pass in both themes. No console or page errors.**

Five problems were found along the way. Four were fixed in this round; one is
by design and noted below.

| # | Found | Severity | Status |
|---|-------|----------|--------|
| 1 | In the Add Site window, the **Category / Subcategory dropdown lists opened behind the window**. The chevron flipped but no options were visible, so you couldn't pick a subcategory. This also affected Settings → Library. | High | Fixed: the dropdown layer is now above every dialog (`Select` `z-[120]`) |
| 2 | After dropping a site on a card's **recycle bin**, the card **stayed in drag mode**. An empty "GENERAL — Drop sites here" placeholder stayed visible because the dragged chip disappears before its dragend fires. | Medium | Fixed: drag state also ends on any drop or dragend (capture phase) |
| 3 | **Escape didn't close the Site Map** after the Add Site window was cancelled, because focus had fallen back to the page body. | Medium | Fixed: page-level Escape closes the map when focus isn't in another dialog |
| 4 | Light theme: the new-category **Add** button was almost invisible (white-on-white). | Low | Fixed: accent-coloured button |
| 5 | "**Add to URL**" copies a deleted site into the form but leaves the original in the bin. Restoring that leftover later creates a duplicate. | Low | By design, as asked ("add to URL" fills the form). Worth deciding whether adding should also clear it from the bin. |

Noticed on the deck while testing, and fixed:
- In the narrow left column, the Queue / To-do switch cut its labels to "QUE…" and "TO-…". Icons now hide when the column is narrow.
- The "Currently processing" tab label wrapped onto two lines. It now stays on one line.

## Steps and checks (each run in dark and light)

1. **Create category from the Site Map header** ("QA Testing")
   - Inline name field and colour picker; the colour preset (`#34d399`) is used by no other category. ✔
   - Enter creates the category with that colour; the card appears in the Site Map and on the deck. ✔
2. **Add 3 subcategories** (Docs, Tools, Blogs) with "+ Sub category" and Enter. ✔
   - Type "Ghost", then click outside: nothing is created and the field closes. ✔
3. **Add 7 sites** with "+ Add site" (the card's category is preset; subcategory picked from the dropdown):
   - Docs: MDN, web.dev ✔
   - Tools: Regex101, Can I Use, Bundlephobia ✔
   - Blogs: CSS-Tricks, Smashing ✔
4. **Delete every Tools site** by dragging each chip onto the card's bin.
   - An undo bar "Deleted <name>" appears for each. ✔
   - All three are in the recycle bin. ✔
5. **Delete the (now empty) Tools subcategory.**
   - No confirmation prompt. ✔
   - An undo bar "Deleted Tools" appears. ✔
   - The subcategory is gone. ✔
   - 5b. **Delete Blogs while it still has sites.**
     - Both sites go to the recycle bin (not General). ✔
     - The bar reads "Deleted Blogs — 2 sites moved to the recycle bin". ✔
     - **Undo** brings Blogs back with both sites in it, and empties them from the bin. ✔
   - 5c. **Undo bar timeout:** the bar leaves by itself after about 5 s. ✔
6. **Add the Tools sites again** from Add Site → Deleted / archived sites.
   - The rows say "Restores to QA Testing › General", because the subcategory is gone. ✔
   - Restore Regex101 and Can I Use: they land in **QA Testing › General**. ✔
   - "Add to URL" on Bundlephobia fills URL and name; Add puts it in General (once). ✔
7. **Delete the category.**
   - The inline confirmation reads "Delete QA Testing and its 7 sites? Sites go to the recycle bin…". ✔
   - Category and subcategories removed; all 7 sites are in the bin. ✔
8. **Add all the deleted category's sites back** (Restore each from another card's Add Site window).
   - The rows show no "Restores to" path, only "Uncategorized". ✔
   - All 7 come back as **Uncategorized** (no category, no subcategory). ✔
9. **Where they're visible:**
   - **Site Map:** an "Uncategorized / None" card with the 7 sites. ✔
   - **Deck:** on the last page, loose tiles after the last category card. ✔
   - **Settings → Sitemap:** an "Uncategorized / None" node. ✔
   - Escape closes the Site Map. ✔
   - No console or page errors. ✔

## Not covered

- Real mouse drags. HTML5 drag-and-drop was simulated with dispatched drag
  events, which Playwright's mouse drag can't drive reliably.
- Search results for an uncategorized site: the screenshot clipped the
  dropdown, so check it by hand.
- The same flow from Settings → Library and the Bookmarks drawer. They share
  the same store actions and the delete-with-undo helper.

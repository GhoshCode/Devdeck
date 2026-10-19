# DevDeck — QA strategy

How DevDeck is tested from now on: what to test, where, with which data, and in
what order. It is written for whoever runs the next integration pass (the
**combined UI QA pass and `qa-report.md`**), and for every release after it.

Companion documents:

| Document | What it holds | Use it for |
|---|---|---|
| [implementation.md](implementation.md) | Technical log per round: files, components, store actions, CSS classes, decisions | Knowing *where* a behaviour lives when a test fails |
| [features-functionality.md](features-functionality.md) | User-facing behaviour per round, each with a **manual test checklist** (126+ items) | The manual test cases themselves |
| [qa-sitemap-lifecycle.md](qa-sitemap-lifecycle.md) | First scripted end-user walk-through (Site Map lifecycle), with screenshots | Template for future scenario reports |
| `qa-report.md` (to be written) | Results of the full integration pass | Sign-off |

---

## 1. Scope

**In scope:**
- The new-tab page: the top bar (clock faces, greeting, weather, search, Git, terminal box).
- The cockpit: Currently processing / Queue / To-do, the category cards row, the overview, the feeds and topics.
- The Site Map, the Bookmarks drawer and every Settings tab.
- The MV3 extension wrapper: new-tab override, alarms/notifications, host permissions, the native-messaging terminal helper.

**Out of scope:**
- The availability of third-party APIs: HN, Dev.to, Remotive, RemoteOK, GitHub, Open-Meteo.
  We test DevDeck's *handling* of their success, failure, slowness and offline cases, not the services themselves.

## 2. Target environments

The extension's main audience runs **Chromium browsers on Linux**, so Linux is the primary platform.

| Priority | OS | Browser | Notes |
|---|---|---|---|
| P1 | Linux (Ubuntu 22.04/24.04, Fedora) | Google Chrome stable, Chromium | Primary. Terminal helper via the Python host; check GNOME and KDE terminals. |
| P1 | Linux | Brave, Microsoft Edge for Linux | Same engine; check the new-tab override and native messaging. |
| P2 | Windows 11 | Chrome, Edge | Current dev machine; PowerShell helper. |
| P3 | macOS | Chrome | Terminal.app helper. |
| — | Snap or Flatpak Chromium | — | **Known risk:** the sandbox can block native messaging, so the terminal box may only ever show the setup hint. Document the result; don't treat it as a DevDeck bug. |

**Viewports:** 1920×1080, 1512×945, 1366×768, 1280×800. Check the narrow-column states as well (side columns widened by a card).

**Themes:** dark and light, plus at least two accent presets (one pink, one teal or green).

**Motion:** normal, and with *Reduce motion* turned on in the OS.

## 3. Test levels

| Level | Tool | Command | When |
|---|---|---|---|
| Static | TypeScript | `npx tsc -b --noEmit` | Every change |
| Unit | Vitest (212 tests) | `npm test` | Every change |
| Component and flow (website) | Playwright, `chromium` project (93 specs) | `npm run test:e2e` (dev server on :5180) | Before each commit that touches UI |
| QA suite | Playwright, `qa` and `qa-perf` projects | `npm run qa` | Before a release |
| Extension load | Playwright, `e2e/qa/extension.spec.ts` | `npm run qa:extension` | Before a release (builds `dist/` first) |
| Scenario walk-throughs | Node + Playwright scripts, e.g. `e2e/qa/sitemap-lifecycle.manual.mjs` | `node e2e/qa/sitemap-lifecycle.manual.mjs dark` | When a feature area changes; keep screenshots |
| Manual exploratory | A human with the checklists | `features-functionality.md` | Every UI round; the full pass before release |

**Rules:**
- New UI is **not** auto-tested in the round it is built (current working agreement). It gets a checklist in `features-functionality.md`, and the combined pass tests everything together.
- A bug found manually gets an automated regression test when it is cheap to write: a store or unit test first, Playwright second.

## 4. Test data

| Data set | How | What it covers |
|---|---|---|
| Fresh profile | New browser profile, or clear `localStorage` | First-run seeding: 13 categories and 260+ sites, empty states, onboarding hints |
| Demo build | `npm run build:demo` → load `dist/` | 52 Currently processing + 52 Queue items with schedules and timers, 156 to-dos, 30 topics, 210 feed sources. Loaded once on first open. |
| Demo on demand | Settings → Data → Load / Remove demo data | Toggling volume during a session |
| Upgrade data | An old `localStorage["devdeck"]` blob (saved from an earlier build) | Normalisation and migration: `Focus` → `Currently processing`, missing fields, removed clock faces |
| Edge data | 1 category, 0 categories, a category with 0 sites, very long names (40+ characters, emoji, RTL text), duplicate URLs, uncategorized sites only | Layout and empty states |

## 5. Risk-based priorities

Higher risk means test first and test deepest.

| Risk | Area | Why | Key checks |
|---|---|---|---|
| **High** | Data safety: delete, restore, undo | Users lose links | Delete a site, subcategory or category → bin → restore destination rules. Undo within 5 s. Clear data with two confirmations. Nothing is lost on reload. |
| **High** | Persistence and migration | Silent corruption | Reload after every action. An old blob loads. Import/export round-trip. |
| **High** | Extension packaging | Unusable if the new tab breaks | `dist/` loads unpacked, the new tab overrides, no CSP errors (Google Fonts, favicons), alarms fire notifications. |
| **High** | Terminal helper (native messaging) | OS-specific, security-sensitive | Linux install script, ping, run, admin with `sudo`, refuses other origins, setup hint when missing. |
| Medium | Layout across widths | The cockpit is snap-sized | Card pages (no repeated card between pages), overview names, narrow-column labels, no clipped badges or text. |
| Medium | Feeds | Network-heavy (210 sources) | Progress bar, 0–100 counts, multi-topic filter, reload after Settings, offline banner. |
| Medium | Drag and drop | HTML5 DnD varies by browser | Site Map chip → section, chip → bin, bookmarks reordering. Real-mouse testing is needed (automation simulates the events). |
| Low | Clock faces and greeting | Cosmetic | Each face at all widths, DEVDECK plate not clipped, name fonts not clipped. |

## 6. Feature areas → where the test cases are

Each area points at the sections of `features-functionality.md` (latest round first) and of `implementation.md`.

| Area | Manual cases | Automated coverage today |
|---|---|---|
| **Clock faces** (Flip, HUD, Analog, Kinetic, Word, Glow, CLI, Cyberpunk, macOS, Chrono 2100, Multi-timezone) | §0–§1, §00, §000 | `visual-simulation.spec.ts`, `topbar.spec.ts` (partial) |
| **Greeting** (styles, name fonts, inline rename, add-name, quote) | §8, §00, §000, §0000 | `topbar.spec.ts` (partial) |
| **Weather and location** | §7 and this round | `topbar.spec.ts` |
| **Search, Site Map search, AI mode** | earlier rounds | `search.spec.ts`, `gemini.spec.ts` |
| **Site Map**: masonry, chips, inline new category, sub-sections, bin, Uncategorized | §5, §0, §00, §00000, §0000000, `qa-sitemap-lifecycle.md` | `sitemap.spec.ts`, the lifecycle script |
| **Recycle bin and restore rules** | §00000, §0000000 | `store.test.ts` (restore and undo unit tests) |
| **Category cards row**: paging dots, pinned row, overview | §0 (paging), §000, §0000000 | `pinning.spec.ts`, `cockpit-tools.spec.ts` (**stale**, see §9) |
| **Currently processing / Queue / To-do** | §9, §0, §00, §000, §0000 | `processing.spec.ts`, `cockpit-tools.spec.ts` |
| **Timers, reminders, undo bar** | round 2026-10-18 list | `cockpit-tools.spec.ts`, `schedule.test.ts`, `timer.test.ts` |
| **Feeds and topics**: counts, multi-topic, loaders | §00, §0000 | `feeds.spec.ts`, `feeds.test.ts` |
| **Settings → Data**: cache, clear data, demo | §6 | `devdeck.spec.ts` (partial) |
| **Offline banner** | §7, §0 | `offline.mjs` scratch check only, so add a spec |
| **Terminal box and helper** | this round (below) | `topbar.spec.ts` (website message only) |
| **Extension wrapper** | — | `e2e/qa/extension.spec.ts` |

## 7. Entry and exit criteria for the combined pass

**Entry:**
- The user confirms the UI rounds are finished.
- `tsc` is clean and unit tests are green.
- `dist/` has been built from the commit under test, both normal and demo.

**Exit:**
- Every checklist item in `features-functionality.md` is marked pass, fail, or not applicable, with a reason.
- No open **High** defects.
- Medium defects are either fixed or accepted by the user.
- The Playwright `chromium`, `qa` and `qa-perf` projects are green, with stale specs updated (§9).
- The extension load spec is green on Linux Chrome.
- `qa-report.md` is written with every step, the environment, results, defects and screenshots.

## 8. Defect reporting

One entry per defect:
- **Title:** area: symptom.
- **Environment:** OS, browser and version, viewport, theme, data set.
- **Steps**, **expected** result, **actual** result.
- **Evidence:** a screenshot or a short video.
- **Severity:**
  - High: data loss, crash, or the new tab is unusable.
  - Medium: a feature is broken but there is a workaround.
  - Low: cosmetic.

Put the defects in `qa-report.md`. When fixed, link the commit and add a regression test where practical.

## 9. Known gaps to close in the combined pass

- **`e2e/cockpit-tools.spec.ts` is partly stale.** It still expects:
  - the old card scrollbar (`cards-scrollbar`), where there are now paging dots;
  - the header "+ Sub" button;
  - "Zero pending 🎉";
  - subcategory delete moving sites to General.
- Specs are missing for:
  - the offline banner;
  - the recycle bin "Add to URL";
  - Uncategorized tiles on the deck;
  - the feed count reload after Settings;
  - the name-font cycling.
- **Real-mouse drag and drop.** Automation simulates HTML5 drag events, so test by hand on Linux Chrome at least once.
- **Native messaging on Linux.** Test manually with the Python helper, including a Snap/Flatpak browser.
- **Open decision:** "Add to URL" leaves the original in the bin, and restoring it later creates a duplicate. This needs a product decision.

## 10. Terminal box: test cases (Linux first)

The box sends the command over Chrome native messaging (`com.devdeck.terminal`) to a small desktop helper. The helper opens the OS terminal and runs the command visibly.
- **Linux:** a Python host tries `x-terminal-emulator`, `gnome-terminal`, `konsole`, `xfce4-terminal`, `kitty`, `alacritty`, then `xterm`, and runs the command with `bash -lc`. Admin mode prefixes `sudo`.
- **Windows:** a PowerShell host, with UAC for admin mode.
- **macOS:** Terminal.app via `osascript`.

Nothing is hard-coded to PowerShell: the prompt sign (`PS>` or `$`) and the wording come from the OS the browser reports.

| # | Case | Expected |
|---|---|---|
| T1 | The page is opened from `localhost` or as a file, not as the extension | The hint "This page is not running as the installed DevDeck extension…" with **Set up →**. Nothing runs. |
| T2 | Extension loaded, helper **not** installed | "The desktop helper is not installed yet — set it up in Settings → Profile." |
| T3 | Linux: Settings → Profile → terminal helper → download the installer, run `sh ~/Downloads/devdeck-terminal-setup.sh`, then **Test connection** | "Connected (linux)" |
| T4 | Linux: type `ls -la` → Enter | A new terminal window opens and runs it, then stays open in a login shell. The box shows "Running in your terminal — see the new window". |
| T5 | Linux: admin on, `apt list --upgradable` | The window asks for the sudo password. The prompt sign changes to `#` and the box border turns amber. |
| T6 | No supported terminal emulator installed | Error "No terminal emulator found" |
| T7 | ↑ / ↓ | Walks the last 30 commands |
| T8 | Esc | Clears the notice and blurs |
| T9 | A different extension ID (helper manifest `allowed_origins`) | The helper refuses; the box shows the setup hint |
| T10 | Windows: the same as T3–T5, using the PowerShell installer | A PowerShell window, with UAC for admin |

## 11. Baseline, 2026-10-19 (final check before the combined pass)

| Check | Result |
|---|---|
| `tsc -b --noEmit` | Clean |
| Vitest | 212 / 212 pass |
| `npm run build:demo` | OK (`dist/` = demo build) |
| Playwright `chromium` (93) | **82 pass, 1 flaky, 10 fail.** None of the failures is a product regression. |

**The 10 failures:**

| Spec | Cause | Action in the combined pass |
|---|---|---|
| `ui-rigorous.spec.ts` ×2 | Expect `cards-scrollbar`; the row now pages with dots (`cards-pager`) | Rewrite against the pager |
| `cockpit-tools.spec.ts`: overview jump | Counts the deck cards while the overview is open, but the overview now *replaces* the cards (0 visible) | Count the categories from the store or before opening |
| `feeds.spec.ts` ×2 | Expect a radiogroup of radios; topics are now multi-select toggle buttons (`group`, `aria-pressed`) | Update the roles, and add a multi-select case |
| `processing.spec.ts` ×2 | Expect the region "Processing: Focus"; it's now "Processing: Currently processing" | Update the names |
| `appearance.spec.ts`: Multi-Timezone | Expects "New York" by default; the default zones are now empty | Update. Also see the finding below. |
| `appearance.spec.ts`: Auto theme, accent | **Timing only.** They pass when run alone, and time out under full-suite load on this machine. | Raise the timeout for theme-transition tests, or run them serially |

**Finding:** the zone picker in Settings → Appearance still uses the curated
28-city list and allows 3 zones. The clock face's own search uses the full
world list (`@vvo/tzdb`) and allows 2. Unify them on the world list, with one limit.

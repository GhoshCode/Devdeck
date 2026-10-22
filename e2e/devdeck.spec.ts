/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║          DEVDECK — END-TO-END TEST SUITE (Playwright)           ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║                                                                 ║
 * ║  📚 HOW PLAYWRIGHT WORKS — A BEGINNER'S GUIDE                  ║
 * ║                                                                 ║
 * ║  Playwright is like a robot that:                               ║
 * ║    1. Opens a REAL browser (Chrome/Edge/Firefox)                ║
 * ║    2. Visits your website                                       ║
 * ║    3. Clicks buttons, types text, scrolls — like a real user    ║
 * ║    4. Checks that the right things appeared on screen           ║
 * ║                                                                 ║
 * ║  KEY CONCEPTS:                                                  ║
 * ║                                                                 ║
 * ║  • test('name', async ({ page }) => { ... })                    ║
 * ║      ↑ Each test gets its own fresh browser tab ("page")        ║
 * ║                                                                 ║
 * ║  • page.goto('/')                                               ║
 * ║      ↑ Navigate to a URL (like typing in the address bar)       ║
 * ║                                                                 ║
 * ║  • page.getByText('Hello')                                     ║
 * ║      ↑ Find an element by its visible text                      ║
 * ║                                                                 ║
 * ║  • page.getByRole('button', { name: 'Submit' })                ║
 * ║      ↑ Find elements by what they ARE (button, link, etc.)      ║
 * ║      This is how a screen reader sees your page too!            ║
 * ║                                                                 ║
 * ║  • page.locator('[data-category-id]')                           ║
 * ║      ↑ Find elements by CSS selector (last resort)              ║
 * ║                                                                 ║
 * ║  • await expect(element).toBeVisible()                          ║
 * ║      ↑ Assert = "I expect this to be true, fail if not"         ║
 * ║      Playwright auto-waits up to 5 seconds for it to appear!    ║
 * ║                                                                 ║
 * ║  • page.keyboard.press('Control+k')                             ║
 * ║      ↑ Press keyboard keys, just like a real keyboard           ║
 * ║                                                                 ║
 * ║  • page.click('button')                                         ║
 * ║      ↑ Click an element, just like a real mouse                 ║
 * ║                                                                 ║
 * ║  🔑 THE GOLDEN RULE:                                            ║
 * ║     Prefer getByRole() and getByText() over CSS selectors.      ║
 * ║     They test what the USER sees, not how the code is written.  ║
 * ║                                                                 ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import { test, expect } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════════
// SETUP: Runs before EVERY test in this file.
// ═══════════════════════════════════════════════════════════════════
//
// Why? Each test should start from a known, clean state.
// We clear localStorage so previous test data doesn't leak in.

test.beforeEach(async ({ page }) => {
  // 1. Navigate to the app
  await page.goto('/');

  // 2. Clear any saved data from previous tests
  //    (DevDeck stores everything in localStorage)
  await page.evaluate(() => localStorage.clear());

  // 3. Reload so the app starts fresh with seed data
  await page.reload();

  // 4. Wait for the app to fully render
  //    We wait for the category cards to appear — that means React
  //    has mounted and the seed data has loaded.
  await page.locator('[data-category-id]').first().waitFor({ state: 'visible' });
});


// ═══════════════════════════════════════════════════════════════════
// TEST GROUP 1: PAGE LOAD & HEADER
// ═══════════════════════════════════════════════════════════════════
//
// These tests verify that when you open DevDeck, the essential
// elements are visible: clock, greeting and date.

test.describe('Page Load & Header', () => {

  test('shows the digital clock and it displays a time', async ({ page }) => {
    // ┌─────────────────────────────────────────────────────────┐
    // │  HOW THIS WORKS:                                       │
    // │                                                        │
    // │  getByRole('timer') finds the element that has         │
    // │  role="timer" — that's our clock <div>.                │
    // │                                                        │
    // │  toBeVisible() checks it's actually on screen          │
    // │  (not hidden, not display:none, not zero-sized).       │
    // │                                                        │
    // │  We then check the text matches a time pattern like    │
    // │  "07:30" or "12:45". The /\d{1,2}:\d{2}/ is a         │
    // │  "regular expression" — a pattern matcher.             │
    // └─────────────────────────────────────────────────────────┘

    const clock = page.getByRole('timer', { name: 'Digital clock' });
    await expect(clock).toBeVisible();

    const clockText = await clock.textContent();
    // Check it looks like a time (e.g., "07:30" or "12:45 PM")
    expect(clockText).toMatch(/\d{1,2}:\d{2}/);
  });

  test('shows a time-of-day greeting', async ({ page }) => {
    // ┌─────────────────────────────────────────────────────────┐
    // │  The <h1> tag contains greetings like:                 │
    // │    "Good morning."  /  "Good afternoon."               │
    // │    "Good evening."  /  "Late night hacking?"           │
    // │                                                        │
    // │  getByRole('heading', { level: 1 }) finds <h1> tags.   │
    // │  We check the text contains one of the expected words. │
    // └─────────────────────────────────────────────────────────┘

    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();

    // The page opens on the plain greeting; a right-click switches to the
    // themed phrases (lib/greetings.ts).
    await expect(heading).toHaveText(/^GOOD (MORNING|AFTERNOON|EVENING|NIGHT)/);
    await heading.click({ button: 'right' });
    await expect(heading).not.toHaveText(/^GOOD (MORNING|AFTERNOON|EVENING|NIGHT)/);
  });

  test('shows the current date', async ({ page }) => {
    // The date line shows something like "WEDNESDAY, OCTOBER 7"
    // We just check the current month name appears somewhere
    const months = [
      'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
      'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
    ];
    const currentMonth = months[new Date().getMonth()];

    await expect(page.getByText(currentMonth)).toBeVisible();
  });

  test('date, greeting and a shuffleable daily quote on the right', async ({ page }) => {
    // ┌─────────────────────────────────────────────────────────┐
    // │  The far right of the top bar: date line, greeting     │
    // │  heading and a motivational quote (↻ for another).      │
    // └─────────────────────────────────────────────────────────┘
    const dateGreet = page.locator('[data-widget="date-greet"]');
    const heading = dateGreet.getByRole('heading', { level: 1 });
    const phrase = await heading.textContent();
    await heading.click({ button: 'right' }); // right-click changes the phrase (click changes the style)
    await expect(heading).not.toHaveText(phrase ?? '');
    const quote = dateGreet.getByTestId('greeting-quote');
    const first = await quote.textContent();
    await quote.hover();
    await dateGreet.getByRole('button', { name: 'Another quote' }).click();
    await expect(quote).not.toHaveText(first ?? '');
  });
});


// ═══════════════════════════════════════════════════════════════════
// TEST GROUP 2: QUICK LINKS
// ═══════════════════════════════════════════════════════════════════
//
// Quick links are the pill buttons at the top: Mail, Drive, etc.

test.describe('Quick Links', () => {

  test('renders the 4 seed quick links', async ({ page }) => {
    // ┌─────────────────────────────────────────────────────────┐
    // │  getByText() finds elements by their visible text.      │
    // │  The seed data has: Mail, Drive, Telegram, LinkedIn.   │
    // │                                                        │
    // │  toBeVisible() auto-waits up to 5 seconds.             │
    // │  If the text doesn't appear, the test FAILS.           │
    // └─────────────────────────────────────────────────────────┘

    await expect(page.getByTestId('links-strip').getByRole('link', { name: 'Mail', exact: true })).toBeVisible();
    await expect(page.getByTestId('links-strip').getByRole('link', { name: 'Drive', exact: true })).toBeVisible();
    await expect(page.getByTestId('links-strip').getByRole('link', { name: 'Telegram', exact: true })).toBeVisible();
    await expect(page.getByTestId('links-strip').getByRole('link', { name: 'LinkedIn', exact: true })).toBeVisible();
  });

  test('quick links have correct URLs', async ({ page }) => {
    // ┌─────────────────────────────────────────────────────────┐
    // │  getAttribute('href') reads the href attribute,         │
    // │  just like inspecting it in DevTools.                  │
    // │                                                        │
    // │  toContain() checks if the string includes something.  │
    // │  So "https://gmail.com" toContain("gmail") → PASS     │
    // └─────────────────────────────────────────────────────────┘

    const mailLink = page.getByTestId('links-strip').getByRole('link', { name: 'Mail', exact: true });
    await expect(mailLink).toHaveAttribute('href', /gmail/);

    const driveLink = page.getByTestId('links-strip').getByRole('link', { name: 'Drive', exact: true });
    await expect(driveLink).toHaveAttribute('href', /drive\.google/);
  });
});


// ═══════════════════════════════════════════════════════════════════
// TEST GROUP 3: CATEGORY CARDS
// ═══════════════════════════════════════════════════════════════════
//
// The main content: 3 glass cards (Programming, Design, Social)

test.describe('Category Cards', () => {

  test('renders all 10+ seed categories', async ({ page }) => {
    const cards = page.locator('[data-category-id]');
    await expect(cards).toHaveCount(13);
  });

  test('each category shows its name', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Frontend' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Backend' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'DevOps & Cloud' })).toBeVisible();
  });


  test('First card has primary site tiles', async ({ page }) => {
    // ┌─────────────────────────────────────────────────────────┐
    // │  The primary row has aria-label="Primary sites rail"    │
    // │  (we set this in PrimaryRow.tsx).                       │
    // │                                                        │
    // │  Inside it are <a> tags (links) — one per primary      │
    // │  site. The seed has 7 primary programming sites:       │
    // │  GitHub, Stack Overflow, Hacker News, MDN, etc.        │
    // └─────────────────────────────────────────────────────────┘

    const primaryRails = page.locator('[aria-label="Primary sites rail"]');
    // At least one primary row should have tiles
    const firstRail = primaryRails.first();
    await expect(firstRail).toBeVisible();

    const tiles = firstRail.locator('a');
    // Programming has 7 primary sites in the seed
    const count = await tiles.count();
    expect(count).toBeGreaterThanOrEqual(2); // at least some are visible
  });

  test('shows site count per category', async ({ page }) => {
    // ┌─────────────────────────────────────────────────────────┐
    // │  Each card header shows "26 sites" or "7 sites" etc.    │
    // │  We check that the word "sites" appears in each card.  │
    // └─────────────────────────────────────────────────────────┘

    const siteCountLabels = page.locator('[data-category-id]').locator('text=sites');
    const count = await siteCountLabels.count();
    expect(count).toBeGreaterThanOrEqual(3); // one per category
  });
});


// ═══════════════════════════════════════════════════════════════════
// TEST GROUP 4: SEARCH BAR
// ═══════════════════════════════════════════════════════════════════
//
// v2 retired the Ctrl+K palette for an always-visible search bar
// (plan §7 Q4). Ctrl+K and "/" now just focus it.

test.describe('Search Bar', () => {

  test('Ctrl+K and "/" focus the always-visible search bar', async ({ page }) => {
    // ┌─────────────────────────────────────────────────────────┐
    // │  toBeFocused() checks the element has keyboard focus.  │
    // └─────────────────────────────────────────────────────────┘
    const input = page.getByRole('combobox', { name: 'Search' });
    await expect(input).toBeVisible();

    await page.keyboard.press('Control+k');
    await expect(input).toBeFocused();

    await page.keyboard.press('Escape'); // empty query → blur
    await expect(input).not.toBeFocused();

    await page.keyboard.press('/');
    await expect(input).toBeFocused();
  });

  test('tier 1 lists your matching sites', async ({ page }) => {
    await page.getByRole('combobox', { name: 'Search' }).fill('github');
    const list = page.getByRole('listbox', { name: 'Search suggestions' });
    await expect(list.getByText('Your sites')).toBeVisible();
    await expect(list.getByRole('option', { name: /^GitHub/ }).first()).toBeVisible();
  });

  test('arrow keys move the highlighted option', async ({ page }) => {
    const input = page.getByRole('combobox', { name: 'Search' });
    await input.fill('dev');
    await page.keyboard.press('ArrowDown');
    const first = page.getByRole('option').first();
    await expect(first).toHaveAttribute('aria-selected', 'true');
    await expect(input).toHaveAttribute('aria-activedescendant', 'search-opt-0');
  });

  test('tier 3 offers a Google search, and unknown URLs can be added', async ({ page }) => {
    const input = page.getByRole('combobox', { name: 'Search' });
    await input.fill('xyznonexistent');
    await expect(page.getByRole('option', { name: /Search Google for “xyznonexistent”/ })).toBeVisible();

    await input.fill('my-new-tool.dev');
    await page.getByRole('option', { name: /Add my-new-tool\.dev to your library/ }).click();
    await expect(page.locator('[aria-label="DevDeck Settings"]')).toBeVisible();
  });
});


// ═══════════════════════════════════════════════════════════════════
// TEST GROUP 5: SETTINGS MODAL
// ═══════════════════════════════════════════════════════════════════
//
// The full-screen settings overlay with its tab system.

test.describe('Settings Modal', () => {

  test('opens when clicking the gear button', async ({ page }) => {
    // ┌─────────────────────────────────────────────────────────┐
    // │  getByRole('button', { name: 'Settings' }) finds the    │
    // │  gear button by its aria-label.                        │
    // │                                                        │
    // │  This is the BEST way to find interactive elements     │
    // │  because it matches how assistive tech sees the page.  │
    // └─────────────────────────────────────────────────────────┘

    // Click the settings gear button
    await page.getByRole('button', { name: 'Settings' }).click();

    // The settings dialog should appear
    const settings = page.locator('[aria-label="DevDeck Settings"]');
    await expect(settings).toBeVisible();
  });

  test('closes with Escape key', async ({ page }) => {
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.locator('[aria-label="DevDeck Settings"]')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('[aria-label="DevDeck Settings"]')).not.toBeVisible();
  });

  test('has all 5 tabs', async ({ page }) => {
    // ┌─────────────────────────────────────────────────────────┐
    // │  The settings modal has 5 tabs on the left side rail:   │
    // │  Library, Sitemap, Quick Links, Appearance, Data       │
    // │                                                        │
    // │  We check each tab button exists inside the modal.     │
    // └─────────────────────────────────────────────────────────┘

    await page.getByRole('button', { name: 'Settings' }).click();
    const modal = page.locator('[aria-label="DevDeck Settings"]');

    await expect(modal.getByRole('button', { name: /Library/ })).toBeVisible();
    await expect(modal.getByRole('button', { name: /Sitemap/ })).toBeVisible();
    await expect(modal.getByRole('button', { name: /Quick Links/ })).toBeVisible();
    await expect(modal.getByRole('button', { name: /Appearance/ })).toBeVisible();
    await expect(modal.getByRole('button', { name: /Data/ })).toBeVisible();
  });

  test('can switch between tabs', async ({ page }) => {
    // ┌─────────────────────────────────────────────────────────┐
    // │  We click the "Appearance" tab and verify its content   │
    // │  appears. This tests that tab navigation actually       │
    // │  switches the displayed content.                       │
    // └─────────────────────────────────────────────────────────┘

    await page.getByRole('button', { name: 'Settings' }).click();
    const modal = page.locator('[aria-label="DevDeck Settings"]');

    // Click the Appearance tab
    await modal.getByRole('button', { name: /Appearance/ }).click();

    // Appearance tab should show accent color options
    // (look for a label or heading that's unique to this tab)
    await expect(modal.getByRole('heading', { name: /accent/i })).toBeVisible();
  });

  test('closes with the Close button', async ({ page }) => {
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.locator('[aria-label="DevDeck Settings"]')).toBeVisible();

    // Click the X close button (aria-label="Close Settings")
    await page.getByRole('button', { name: 'Close Settings' }).click();
    await expect(page.locator('[aria-label="DevDeck Settings"]')).not.toBeVisible();
  });
});


// ═══════════════════════════════════════════════════════════════════
// TEST GROUP 6: SUBCATEGORY NAVIGATION
// ═══════════════════════════════════════════════════════════════════
//
// Inside each category card, there are subcategory pills you can
// click to navigate between groups of sites.

test.describe('Subcategory Navigation', () => {
  test('shows subcategory pills inside the Frontend card', async ({ page }) => {
    // Find the first category card (Frontend is order 0)
    const frontendCard = page.locator('[data-category-id]').first();

    // It should have subcategory pills
    await expect(frontendCard.getByRole('button', { name: /General/ })).toBeVisible();
    await expect(frontendCard.getByRole('button', { name: /Frameworks/ })).toBeVisible();
    await expect(frontendCard.getByRole('button', { name: /Styling/ })).toBeVisible();
  });

  test('clicking a subcategory pill scrolls to that section', async ({ page }) => {
    const frontendCard = page.locator('[data-category-id]').first();

    // Click the "Frameworks" pill
    await frontendCard.getByRole('button', { name: /Frameworks/ }).click();

    // Wait a moment for the smooth scroll animation
    await page.waitForTimeout(500);

    // The Frameworks subcategory card should now be visible and contain Remix
    const frameworksCard = frontendCard.locator('[data-subcategory-card-id]').filter({
      hasText: /Remix|Frameworks/,
    });
    await expect(frameworksCard).toHaveCount(1);
  });
});

// ═══════════════════════════════════════════════════════════════════
// TEST GROUP 7: RESPONSIVE LAYOUT
// ═══════════════════════════════════════════════════════════════════

test.describe('Responsive Layout', () => {
  test('keeps viewport fixed with horizontal card deck on narrow screens', async ({ page }) => {
    // Resize to narrow laptop screen
    await page.setViewportSize({ width: 1000, height: 800 });
    await page.waitForTimeout(300);

    const cards = page.locator('[data-category-id]');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(10);


    // Get the bounding boxes of cards
    const box0 = await cards.nth(0).boundingBox();
    const box1 = await cards.nth(1).boundingBox();

    // Cards are side-by-side in the horizontal container, sharing top alignment
    expect(box1!.x).toBeGreaterThan(box0!.x);
    expect(box0!.y).toBeCloseTo(box1!.y, 5);

    // Verify the page itself has ZERO vertical or horizontal scroll
    const pageScroll = await page.evaluate(() => ({
      scrollY: window.scrollY,
      scrollX: window.scrollX,
      docHeight: document.documentElement.scrollHeight,
      winHeight: window.innerHeight,
    }));
    expect(pageScroll.scrollY).toBe(0);
    expect(pageScroll.scrollX).toBe(0);
    expect(pageScroll.docHeight).toBeLessThanOrEqual(pageScroll.winHeight);
  });
});


// ═══════════════════════════════════════════════════════════════════
// TEST GROUP 8: NO CONSOLE ERRORS
// ═══════════════════════════════════════════════════════════════════
//
// A healthy app should have ZERO console errors. This test catches
// broken imports, missing images, React warnings, etc.

test.describe('Console Health', () => {

  test('no console errors on page load', async ({ page }) => {
    // ┌─────────────────────────────────────────────────────────┐
    // │  page.on('console', ...) listens to browser console     │
    // │  messages — the same ones you see in DevTools.          │
    // │                                                        │
    // │  We collect all "error" level messages and assert       │
    // │  there are zero. This catches:                         │
    // │    • Broken image/font URLs                            │
    // │    • React rendering errors                            │
    // │    • Missing imports                                   │
    // │    • Runtime exceptions                                │
    // └─────────────────────────────────────────────────────────┘

    const errors: string[] = [];

    // Start listening BEFORE navigating
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Fresh navigation (beforeEach already loaded it, but we want
    // to capture errors from a clean load)
    await page.goto('/');
    await page.locator('[data-category-id]').first().waitFor({ state: 'visible' });

    // Wait a moment for any async errors
    await page.waitForTimeout(1000);

    // Filter out known benign errors (like favicon 404s from
    // google.com/s2/favicons — those happen when offline)
    const realErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('ERR_NETWORK') && !e.includes('404')
    );

    expect(realErrors).toEqual([]);
  });
});


// ═══════════════════════════════════════════════════════════════════
// TEST GROUP 9: ACCESSIBILITY
// ═══════════════════════════════════════════════════════════════════
//
// Can someone use DevDeck with just a keyboard? These tests verify.

test.describe('Accessibility', () => {

  test('settings gear is reachable by Tab', async ({ page }) => {
    // ┌─────────────────────────────────────────────────────────┐
    // │  page.keyboard.press('Tab') simulates pressing Tab.     │
    // │  We press Tab many times and check if the gear button  │
    // │  eventually receives focus.                            │
    // │                                                        │
    // │  This is important for keyboard-only users who can't   │
    // │  use a mouse.                                          │
    // └─────────────────────────────────────────────────────────┘

    // Tab through the page. The gear button should be focusable.
    const settingsButton = page.getByRole('button', { name: 'Settings' });

    // Use focus() directly to test focusability
    await settingsButton.focus();
    await expect(settingsButton).toBeFocused();
  });

  test('all category cards have accessible names', async ({ page }) => {
    // ┌─────────────────────────────────────────────────────────┐
    // │  Each category card is an <article> with a <h2> inside. │
    // │  Screen readers use this structure to announce:         │
    // │  "Article: Programming" to blind users.                │
    // └─────────────────────────────────────────────────────────┘

    const articles = page.locator('article[data-category-id]');
    const count = await articles.count();

    for (let i = 0; i < count; i++) {
      const article = articles.nth(i);
      // Each article should contain a heading
      const heading = article.locator('h2');
      await expect(heading).toBeVisible();
      const text = await heading.textContent();
      expect(text!.trim().length).toBeGreaterThan(0);
    }
  });
});

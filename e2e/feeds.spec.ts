import { test, expect, type Page } from '@playwright/test';

// Phase 5 — I (news 1–4, jobs 5–8) and J (topic chips). Sources are stubbed
// so the test is deterministic and offline.

const now = Math.floor(Date.now() / 1000);

async function stubFeeds(page: Page) {
  await page.route('https://hn.algolia.com/api/v1/search?**', (r) =>
    r.fulfill({
      json: {
        hits: [
          { objectID: '1', title: 'New AI agents ship in browsers', url: 'https://n/1', created_at_i: now - 60, points: 300 },
          { objectID: '2', title: 'Kubernetes 2.0 released', url: 'https://n/2', created_at_i: now - 120, points: 200 },
          { objectID: '3', title: 'A history of email', url: 'https://n/3', created_at_i: now - 180, points: 100 },
        ],
      },
    }),
  );
  await page.route('https://dev.to/api/articles?**', (r) =>
    r.fulfill({
      json: [
        { id: 10, title: 'React compiler deep dive', url: 'https://d/10', tag_list: ['react'], published_at: new Date((now - 240) * 1000).toISOString() },
        { id: 11, title: 'CSS anchor positioning', url: 'https://d/11', tag_list: ['css'], published_at: new Date((now - 300) * 1000).toISOString() },
      ],
    }),
  );
  await page.route('https://remotive.com/api/**', (r) =>
    r.fulfill({
      json: {
        jobs: [
          { id: 20, title: 'Senior Frontend Engineer', url: 'https://j/20', company_name: 'Stripe', tags: ['react'], publication_date: new Date((now - 60) * 1000).toISOString() },
          { id: 21, title: 'ML Platform Engineer', url: 'https://j/21', company_name: 'OpenAI', tags: ['ai'], publication_date: new Date((now - 90) * 1000).toISOString() },
        ],
      },
    }),
  );
  await page.route('https://hn.algolia.com/api/v1/search_by_date?**', (r) =>
    r.fulfill({ json: { hits: [{ objectID: '30', title: 'Linear (YC) Is Hiring a Rust Engineer', created_at_i: now - 400 }] } }),
  );
}

test.beforeEach(async ({ page }) => {
  await stubFeeds(page);
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('[data-category-id]').first().waitFor({ state: 'visible' });
});

test('news and jobs list up to 20 items each, numbered and newest first', async ({ page }) => {
  const news = page.getByRole('region', { name: 'Tech news' });
  const jobs = page.getByRole('region', { name: 'Developer jobs' });
  await expect(news.locator('[data-feed-item]')).toHaveCount(5); // every fixture story (up to 20)
  await expect(news.locator('[data-feed-item]').first()).toContainText('1');
  await expect(news.locator('[data-feed-item]').first()).toContainText('New AI agents ship in browsers');

  await expect(jobs.locator('[data-feed-item]')).toHaveCount(3);
  await expect(jobs.locator('[data-feed-item]').first()).toContainText('21'); // jobs are numbered after the news section's 20
  await expect(jobs.locator('[data-feed-item]').first()).toContainText('Stripe');
});

test('topic chips filter both panels; "ai" does not match "email"', async ({ page }) => {
  const chips = page.getByRole('group', { name: 'Filter feeds by topic' });
  await expect(chips.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');

  await chips.getByRole('button', { name: '#AI' }).click();
  const news = page.getByRole('region', { name: 'Tech news' });
  await expect(news.locator('[data-feed-item]')).toHaveCount(1);
  await expect(news).toContainText('New AI agents');
  await expect(news).not.toContainText('email');
  await expect(page.getByRole('region', { name: 'Developer jobs' }).locator('[data-feed-item]')).toHaveCount(1);

  // several topics at once: an item matching any of them shows
  await chips.getByRole('button', { name: '#Frontend' }).click();
  await expect(chips.getByRole('button', { name: '#AI' })).toHaveAttribute('aria-pressed', 'true');
  await expect(chips.getByRole('button', { name: '#Frontend' })).toHaveAttribute('aria-pressed', 'true');
  await expect(news).toContainText('2 topics');

  await chips.getByRole('button', { name: 'All' }).click();
  await expect(chips.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
  await expect(news.locator('[data-feed-item]')).toHaveCount(5);
});

test('a topic added in Settings → Scraping appears as a chip', async ({ page }) => {
  await page.getByRole('button', { name: 'Manage topics and sources' }).click();
  const modal = page.getByRole('dialog', { name: 'DevDeck Settings' });
  await modal.getByRole('textbox', { name: 'New topic label' }).fill('#Rust');
  await modal.getByRole('textbox', { name: 'New topic keywords' }).fill('rust');
  await modal.getByRole('button', { name: 'Add', exact: true }).click();
  await page.keyboard.press('Escape');

  await page.getByRole('group', { name: 'Filter feeds by topic' }).getByRole('button', { name: '#Rust' }).click();
  const jobs = page.getByRole('region', { name: 'Developer jobs' });
  await expect(jobs.locator('[data-feed-item]')).toHaveCount(1);
  await expect(jobs).toContainText('Rust Engineer');
});

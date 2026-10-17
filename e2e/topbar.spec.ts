import { test, expect } from '@playwright/test';

// v2 top bar (IMPLEMENTATION_PLAN Phase 1): TIME faces, To-Do, Command Prompt,
// Git setup and the A/B weather card.

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('[data-category-id]').first().waitFor({ state: 'visible' });
});

test('top bar renders every widget slot', async ({ page }) => {
  for (const widget of ['time-cluster', 'todo', 'git', 'date-greet']) {
    await expect(page.locator(`[data-widget="${widget}"]`)).toBeVisible();
  }
  await expect(page.getByTestId('weather-uv')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Command prompt' })).toBeVisible();
});

test('clock style switches in Settings → Appearance; Cyberpunk has no city row', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: /Appearance/ }).click();
  await page.getByRole('radio', { name: 'Cyberpunk 2077' }).click();
  await page.keyboard.press('Escape');

  const clock = page.getByRole('timer', { name: 'Digital clock' });
  await expect(clock).toHaveAttribute('data-clock-style', 'cyberpunk');
  await expect(clock).toContainText('WORLD TIME');
  for (const city of ['LA', 'New York', 'London', 'Paris', 'Kyiv']) {
    await expect(clock).not.toContainText(city);
  }
});

test('to-do: add, expand, complete into the archive, restore', async ({ page }) => {
  const widget = page.getByTestId('todo-widget');
  await widget.getByRole('button', { name: 'Add a task' }).click();
  const panel = page.getByRole('dialog', { name: 'All tasks' });
  await panel.getByRole('textbox', { name: 'New task' }).fill('Write e2e tests');
  await panel.getByRole('textbox', { name: 'New task' }).press('Enter');
  await expect(panel.getByText('Write e2e tests')).toBeVisible();

  await panel.getByRole('button', { name: 'Complete "Write e2e tests"' }).click();
  await expect(panel.getByText('Write e2e tests')).toHaveCount(0);

  await panel.getByRole('button', { name: /^Archive/ }).click();
  const archive = page.getByRole('dialog', { name: 'Archived tasks' });
  await expect(archive.getByText('Write e2e tests')).toBeVisible();
  await archive.getByRole('button', { name: 'Restore "Write e2e tests"' }).click();
  await archive.getByRole('button', { name: 'Back to tasks' }).click();
  await expect(page.getByRole('dialog', { name: 'All tasks' }).getByText('Write e2e tests')).toBeVisible();
});

test('to-do: overdue tasks pin to the top in the danger zone', async ({ page }) => {
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('devdeck') ?? '{"state":{},"version":2}');
    raw.state.todos = [
      { id: 'a', text: 'Not urgent', order: 0, dueDate: null, dueTime: null, createdAt: 0, archivedAt: null },
      { id: 'b', text: 'Way overdue', order: 1, dueDate: '2020-01-01', dueTime: '09:00', createdAt: 0, archivedAt: null },
    ];
    localStorage.setItem('devdeck', JSON.stringify(raw));
  });
  await page.reload();
  const rows = page.getByTestId('todo-widget').locator('li[data-todo-id]');
  await expect(rows.first()).toHaveAttribute('data-overdue', 'true');
  await expect(rows.first()).toContainText('Way overdue');
});

test('command prompt evaluates calc and flags unknown commands', async ({ page }) => {
  const prompt = page.getByRole('textbox', { name: 'Command prompt' });
  await prompt.fill('calc (2+3)*4');
  await prompt.press('Enter');
  await expect(page.getByTestId('command-result')).toHaveText('(2+3)*4 = 20');

  await prompt.fill('ipconfig');
  await prompt.press('Enter');
  await expect(page.getByTestId('command-result')).toContainText('Unknown command');
  await page.getByRole('button', { name: 'Administrator mode' }).click();
  await expect(page.getByRole('button', { name: 'Administrator mode' })).toHaveAttribute('aria-pressed', 'true');
});

test('git widget asks for a username when none is set', async ({ page }) => {
  await expect(page.getByTestId('git-widget').getByRole('textbox', { name: 'GitHub username' })).toBeVisible();
});

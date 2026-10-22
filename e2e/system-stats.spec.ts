import { expect, test } from '@playwright/test';

// CPU / RAM meters read chrome.system (extension only). Chrome reports CPU
// temperatures on ChromeOS only, so a stub stands in for both cases.
const stub = (temperatures: number[]) => `
  window.chrome = window.chrome || {};
  window.chrome.system = {
    cpu: { getInfo: (cb) => { window.__t = (window.__t || 0) + 1000; cb({ processors: [{ usage: { user: 1, kernel: 1, idle: window.__t * 0.6, total: window.__t } }], temperatures: ${JSON.stringify(temperatures)} }); } },
    memory: { getInfo: (cb) => cb({ capacity: 16 * 2 ** 30, availableCapacity: 6 * 2 ** 30 }) },
  };`;

test('shows the hottest CPU temperature when Chrome reports one (ChromeOS)', async ({ page }) => {
  await page.addInitScript(stub([48.6, 55.2, 0]));
  await page.goto('/');
  const stats = page.getByTestId('system-stats');
  await expect(stats).toBeVisible();
  await expect(page.getByTestId('cpu-temp')).toHaveText('55°');
  await expect(stats.locator('[title*="°C"]')).toHaveAttribute('title', /55 °C/);
  await expect(stats).toContainText('RAM');
  await expect(stats).toContainText('63%'); // 10 of 16 GB used
});

test('shows no temperature where Chrome reports none (Windows, macOS, Linux)', async ({ page }) => {
  await page.addInitScript(stub([]));
  await page.goto('/');
  await expect(page.getByTestId('system-stats')).toBeVisible();
  await expect(page.getByTestId('cpu-temp')).toHaveCount(0);
});

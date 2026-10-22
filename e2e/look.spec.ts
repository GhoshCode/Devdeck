import { expect, test, type Page } from '@playwright/test';

// Background video, a default theme per mode, interface size, the browser
// tab and the calendar header — the 2026-10-22 "look" round.

async function openAppearance(page: Page) {
  await page.goto('/');
  await page.locator('[data-category-id]').first().waitFor();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'DevDeck Settings' });
  await modal.getByRole('button', { name: /Appearance/ }).click();
  return modal;
}

test('background video: too big is refused; a real video plays behind everything and can be removed', async ({ page }) => {
  const modal = await openAppearance(page);
  const upload = modal.getByLabel('Upload a background video');

  // over the limit
  await upload.setInputFiles({ name: 'big.mp4', mimeType: 'video/mp4', buffer: Buffer.alloc(21 * 1024 * 1024) });
  await expect(modal.getByRole('alert')).toContainText('the limit is 20 MB');

  // a real one-second WebM, recorded in the page from a canvas
  const bytes = await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 36;
    const g = c.getContext('2d')!;
    const rec = new MediaRecorder(c.captureStream(15), { mimeType: 'video/webm' });
    const parts: Blob[] = [];
    rec.ondataavailable = (e) => parts.push(e.data);
    const done = new Promise((r) => (rec.onstop = r));
    rec.start();
    for (let i = 0; i < 12; i++) {
      g.fillStyle = `hsl(${i * 30} 70% 50%)`;
      g.fillRect(0, 0, 64, 36);
      await new Promise((r) => setTimeout(r, 70));
    }
    rec.stop();
    await done;
    return Array.from(new Uint8Array(await new Blob(parts, { type: 'video/webm' }).arrayBuffer()));
  });
  await upload.setInputFiles({ name: 'loop.webm', mimeType: 'video/webm', buffer: Buffer.from(bytes) });
  await expect(modal.getByTestId('video-on')).toBeVisible();
  const video = page.getByTestId('background-video');
  await expect(video).toHaveAttribute('src', /^blob:/);
  expect(await video.evaluate((v: HTMLVideoElement) => v.muted && v.loop)).toBe(true);

  // it survives a reload (kept in IndexedDB)
  await page.reload();
  await expect(page.getByTestId('background-video')).toHaveAttribute('src', /^blob:/);

  const again = await openAppearance(page);
  await again.getByRole('button', { name: 'Remove video' }).click();
  await expect(page.getByTestId('background-video')).toHaveCount(0);
});

test('each mode can have its own default theme', async ({ page }) => {
  const modal = await openAppearance(page);
  await modal.getByRole('combobox', { name: 'Default dark theme' }).click();
  const pick = page.getByRole('option').nth(1);
  const name = (await pick.textContent())!.replace('✓', '').trim();
  await pick.click();
  await expect(modal.getByRole('combobox', { name: 'Default dark theme' })).toContainText(name);
  // light mode remembers its own choice without changing the current (dark) look
  await modal.getByRole('combobox', { name: 'Default light theme' }).click();
  await page.getByRole('option').first().click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('interface size: Auto by default; a manual size zooms and the dashboard still fills the window', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 950 });
  const modal = await openAppearance(page);
  expect(await page.evaluate(() => document.documentElement.style.zoom)).toBe(''); // 100 % at this width
  await modal.getByRole('switch', { name: 'Auto' }).click();
  const slider = modal.getByRole('slider', { name: 'Size' });
  await slider.fill('110');
  await expect.poll(() => page.evaluate(() => document.documentElement.style.zoom)).toBe('1.1');
  await page.keyboard.press('Escape');
  const fills = await page.getByTestId('dashboard').evaluate((el) => {
    const r = el.getBoundingClientRect();
    return [Math.round(r.width), Math.round(r.height), innerWidth, innerHeight];
  });
  expect(Math.abs(fills[0] - fills[2])).toBeLessThanOrEqual(2);
  expect(Math.abs(fills[1] - fills[3])).toBeLessThanOrEqual(2);
});

test('the browser tab: accent icon and a title that types commands', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-category-id]').first().waitFor();
  await expect.poll(() => page.evaluate(() => document.querySelector<HTMLLinkElement>('link[rel~="icon"]')?.href ?? '')).toMatch(/^data:image\/png/);
  const seen = new Set<string>();
  for (let i = 0; i < 8; i++) {
    seen.add(await page.title());
    await page.waitForTimeout(150);
  }
  expect([...seen].some((t) => t.startsWith('❯ '))).toBe(true);
  expect(seen.size).toBeGreaterThan(2); // it is typing
});

test('calendar header: bigger summary numbers and a taller search', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-category-id]').first().waitFor();
  await page.getByRole('button', { name: /calendar/i }).first().click();
  await page.locator('.cmdcal').waitFor();
  expect(await page.locator('.cc-kpi-value').first().evaluate((el) => getComputedStyle(el).fontSize)).toBe('17px');
  expect((await page.locator('.cc-search').boundingBox())!.height).toBeGreaterThanOrEqual(44);
});

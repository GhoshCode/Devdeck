// Manual-QA toolkit for Playwright: what a human tester checks by eye, made
// measurable and recorded. Used by the `qa` project (npm run qa).
//
//   step()           named step + numbered screenshot, attached to the report
//   measureFrames()  frame timing while an interaction runs (smoothness)
//   measureLoad()    when each component appears, plus LCP and layout shift
//   contrastAudit()  WCAG colour-contrast violations (axe-core)
//   watchConsole()   collects console errors and page crashes
//   seedDeck()       deterministic state: theme, sample to-dos, processing

import { test, type Page, type TestInfo } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ARTIFACTS = 'qa-artifacts';

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

function testDir(info: TestInfo): string {
  const dir = join(ARTIFACTS, slug(info.titlePath.slice(1).join(' ')));
  mkdirSync(dir, { recursive: true });
  return dir;
}

// ---- Steps with screenshots -------------------------------------------------

const stepCounters = new WeakMap<TestInfo, number>();

export async function step<T>(page: Page, info: TestInfo, name: string, body: () => Promise<T>): Promise<T> {
  return test.step(name, async () => {
    const result = await body();
    const n = (stepCounters.get(info) ?? 0) + 1;
    stepCounters.set(info, n);
    const path = join(testDir(info), `${String(n).padStart(2, '0')}-${slug(name)}.png`);
    await page.screenshot({ path });
    await info.attach(`${n}. ${name}`, { path, contentType: 'image/png' });
    return result;
  });
}

// ---- Metrics reporting ------------------------------------------------------

export async function report(info: TestInfo, name: string, data: unknown): Promise<void> {
  const body = JSON.stringify(data, null, 2);
  writeFileSync(join(testDir(info), `${slug(name)}.json`), body);
  await info.attach(name, { body, contentType: 'application/json' });
  console.log(`\n[QA] ${info.title} — ${name}\n${body}`);
}

// ---- Smoothness -------------------------------------------------------------

export interface FrameStats {
  durationMs: number;
  frames: number;
  avgFps: number;
  worstFrameMs: number;
  p95FrameMs: number;
  jankFrames: number; // frames slower than 50 ms — a visible stutter
  longTasks: number; // main-thread tasks over 50 ms
  verdict: 'smooth' | 'minor jank' | 'janky';
}

// Records every animation frame (and long tasks) while `action` runs and for
// `settleMs` afterwards, so animations started by the action are included.
export async function measureFrames(page: Page, action: () => Promise<void>, settleMs = 600): Promise<FrameStats> {
  await page.evaluate(() => {
    const w = window as unknown as { __qa: { frames: number[]; longTasks: number; stop: boolean; obs?: PerformanceObserver } };
    w.__qa = { frames: [], longTasks: 0, stop: false };
    let last = performance.now();
    const tick = (t: number) => {
      w.__qa.frames.push(t - last);
      last = t;
      if (!w.__qa.stop) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    try {
      w.__qa.obs = new PerformanceObserver((list) => {
        w.__qa.longTasks += list.getEntries().length;
      });
      w.__qa.obs.observe({ entryTypes: ['longtask'] });
    } catch {
      // longtask not supported — frames still tell the story
    }
  });
  const start = Date.now();
  await action();
  await page.waitForTimeout(settleMs);
  const durationMs = Date.now() - start;
  const raw = await page.evaluate(() => {
    const w = window as unknown as { __qa: { frames: number[]; longTasks: number; stop: boolean; obs?: PerformanceObserver } };
    w.__qa.stop = true;
    w.__qa.obs?.disconnect();
    return { frames: w.__qa.frames.slice(1), longTasks: w.__qa.longTasks };
  });
  const sorted = [...raw.frames].sort((a, b) => a - b);
  const total = raw.frames.reduce((a, b) => a + b, 0);
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
  const jank = raw.frames.filter((f) => f > 50).length;
  const avgFps = total ? (raw.frames.length / total) * 1000 : 0;
  return {
    durationMs,
    frames: raw.frames.length,
    avgFps: Math.round(avgFps),
    worstFrameMs: Math.round(sorted.at(-1) ?? 0),
    p95FrameMs: Math.round(p95),
    jankFrames: jank,
    longTasks: raw.longTasks,
    verdict: jank === 0 && avgFps >= 50 ? 'smooth' : jank <= 2 && avgFps >= 40 ? 'minor jank' : 'janky',
  };
}

// ---- Loading ----------------------------------------------------------------

export interface LoadStats {
  componentsMs: Record<string, number | 'missing'>; // time from navigation until visible
  lcpMs: number | null;
  cls: number;
}

export async function measureLoad(page: Page, url: string, components: Record<string, string>, timeoutMs = 15_000): Promise<LoadStats> {
  await page.addInitScript(() => {
    const w = window as unknown as { __qaLoad: { lcp: number | null; cls: number } };
    w.__qaLoad = { lcp: null, cls: 0 };
    new PerformanceObserver((l) => {
      const last = l.getEntries().at(-1);
      if (last) w.__qaLoad.lcp = last.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries() as Array<PerformanceEntry & { value: number; hadRecentInput: boolean }>) {
        if (!e.hadRecentInput) w.__qaLoad.cls += e.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  const t0 = Date.now();
  await page.goto(url);
  const componentsMs: LoadStats['componentsMs'] = {};
  await Promise.all(
    Object.entries(components).map(async ([name, selector]) => {
      try {
        await page.locator(selector).first().waitFor({ state: 'visible', timeout: timeoutMs });
        componentsMs[name] = Date.now() - t0;
      } catch {
        componentsMs[name] = 'missing';
      }
    }),
  );
  await page.waitForTimeout(1000); // let late layout shifts register
  const { lcp, cls } = await page.evaluate(() => (window as unknown as { __qaLoad: { lcp: number | null; cls: number } }).__qaLoad);
  return { componentsMs, lcpMs: lcp === null ? null : Math.round(lcp), cls: Math.round(cls * 1000) / 1000 };
}

// ---- Contrast ---------------------------------------------------------------

export interface ContrastIssue {
  target: string;
  text: string;
  ratio: string;
  required: string;
  fg: string;
  bg: string;
}

// axe-core's color-contrast rule (WCAG 2 AA: 4.5:1 body text, 3:1 large text).
export async function contrastAudit(page: Page, include?: string): Promise<ContrastIssue[]> {
  let builder = new AxeBuilder({ page }).withRules(['color-contrast']);
  if (include) builder = builder.include(include);
  const result = await builder.analyze();
  return result.violations.flatMap((v) =>
    v.nodes.map((n) => {
      const d = (n.any[0]?.data ?? {}) as { contrastRatio?: number; expectedContrastRatio?: string; fgColor?: string; bgColor?: string };
      return {
        target: n.target.join(' '),
        text: (n.html.replace(/<[^>]+>/g, '').trim() || n.html).slice(0, 60),
        ratio: d.contrastRatio ? d.contrastRatio.toFixed(2) : '?',
        required: d.expectedContrastRatio ?? '?',
        fg: d.fgColor ?? '?',
        bg: d.bgColor ?? '?',
      };
    }),
  );
}

// ---- Console ----------------------------------------------------------------

export function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    // Favicon 404s from third-party sites are expected noise.
    if (m.type() === 'error' && !/favicon|404|ERR_NAME_NOT_RESOLVED/i.test(m.text())) errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

// ---- Deterministic state ----------------------------------------------------

export async function seedDeck(page: Page, opts: { theme: 'dark' | 'light' }): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('[data-category-id]').first().waitFor();
  await page.evaluate((theme) => {
    const raw = JSON.parse(localStorage.getItem('devdeck') ?? '{"state":{},"version":2}');
    const s = raw.state;
    const pad = (n: number) => String(n).padStart(2, '0');
    const d = new Date();
    const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    s.todos = [
      { id: 't1', text: 'Renew SSL cert', order: 0, dueDate: '2026-01-02', dueTime: null, createdAt: 0, archivedAt: null },
      { id: 't2', text: 'Ship DevDeck release', order: 1, dueDate: today, dueTime: '23:30', createdAt: 0, archivedAt: null },
      { id: 't3', text: 'Review PR #42', order: 2, dueDate: null, dueTime: null, createdAt: 0, archivedAt: null },
    ];
    const sch = { enabled: true, frequency: 'hourly', daysOfWeek: [1, 2, 3, 4, 5], timeOfDay: '09:00', from: '2026-01', to: '2026-12' };
    s.processing = [
      { id: 'p1', name: 'DevDeck Core', url: 'https://github.com', siteId: null, section: 'Focus', order: 0, schedule: sch },
      { id: 'p2', name: 'API Gateway', url: 'https://vercel.com', siteId: null, section: 'Queue', order: 1, schedule: sch },
    ];
    s.settings = {
      ...(s.settings ?? {}),
      githubUsername: 'GhoshCode',
      manualCity: 'Kolkata',
      useGeolocation: false,
      themeMode: theme,
      presetTheme: theme === 'light' ? 'default-light' : 'default-dark',
      accentColor: theme === 'light' ? '#007aff' : '#ff2e9a',
      backgroundImage: null,
    };
    localStorage.setItem('devdeck', JSON.stringify(raw));
  }, opts.theme);
  await page.reload();
  await page.locator('[data-category-id]').first().waitFor();
}

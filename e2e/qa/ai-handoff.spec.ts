import { chromium, expect, test, type BrowserContext } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// Alt+Enter hand-off to the AI sites, end to end through the built extension:
// DevDeck parks the prompt, opens the site, and public/ai-content.js types it
// into the prompt box and presses send. The real sites need a sign-in, so each
// is replaced by a stand-in page with the same prompt box and send button the
// content script looks for (the button only enables once there is text, like
// the real ones). Run `npm run build` before this spec.

test.use({ video: 'off', trace: 'off' });

const editorFor = {
  gemini: '<rich-textarea><div class="ql-editor" contenteditable="true" style="min-height:40px"></div></rich-textarea><button class="send-button" disabled>Send</button>',
  chatgpt: '<form><div id="prompt-textarea" contenteditable="true" style="min-height:40px"></div><button data-testid="send-button" disabled>Send</button></form>',
  claude: '<fieldset><div class="ProseMirror" contenteditable="true" style="min-height:40px"></div></fieldset><button aria-label="Send message" disabled>Send</button>',
} as const;

const standIn = (site: keyof typeof editorFor) => '<!doctype html><html><body>' + editorFor[site] + '</body></html>';

// The stand-in's behaviour (inline scripts don't run on a fulfilled page, so it
// comes in as an init script): send enables once there is text; a click on it
// records what was sent.
const behaviour = () => {
  document.addEventListener('input', () => {
    const editor = document.querySelector('[contenteditable]') as HTMLElement | null;
    const send = document.querySelector('button') as HTMLButtonElement | null;
    if (editor && send) send.disabled = !editor.innerText.trim();
  }, true);
  document.addEventListener('click', (e) => {
    const send = document.querySelector('button');
    if (e.target !== send || (send as HTMLButtonElement).disabled) return;
    e.preventDefault();
    document.body.dataset.sent = (document.querySelector('[contenteditable]') as HTMLElement).innerText;
  }, true);
};

const lines = Array.from({ length: 45 }, (_, i) => `Line ${i + 1}: explain step ${i + 1} of the migration plan in detail`);
const PROMPT = lines.join('\n');

async function launch(): Promise<{ context: BrowserContext; id: string }> {
  const dist = resolve('dist');
  const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'devdeck-ai-')), {
    channel: 'chromium',
    headless: true,
    args: [
      `--disable-extensions-except=${dist}`,
      `--load-extension=${dist}`,
      // never reach the real AI sites: their names resolve nowhere, the stand-ins answer instead
      '--host-resolver-rules=MAP gemini.google.com 0.0.0.0, MAP chatgpt.com 0.0.0.0, MAP chat.openai.com 0.0.0.0, MAP claude.ai 0.0.0.0',
    ],
  });
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  await context.addInitScript(behaviour);
  await context.route('https://gemini.google.com/**', (r) => r.fulfill({ contentType: 'text/html', body: standIn('gemini') }));
  await context.route('https://chatgpt.com/**', (r) => r.fulfill({ contentType: 'text/html', body: standIn('chatgpt') }));
  await context.route('https://claude.ai/**', (r) => r.fulfill({ contentType: 'text/html', body: standIn('claude') }));
  return { context, id: new URL(worker.url()).host };
}

for (const site of ['gemini', 'chatgpt', 'claude'] as const) {
  test(`Alt+Enter sends a 45-line prompt to ${site}`, async () => {
    const { context, id } = await launch();
    try {
      const page = await context.newPage();
      await page.goto(`chrome-extension://${id}/index.html`);
      await page.locator('[data-category-id]').first().waitFor({ timeout: 15_000 });
      // pick the AI by scrolling on its icon, one notch at a time (Gemini → ChatGPT → Claude)
      const names = { gemini: 'Gemini', chatgpt: 'ChatGPT', claude: 'Claude' };
      for (let i = 0; i < 4; i++) {
        const toggle = page.getByRole('button', { name: /mode$/ }).first();
        if ((await toggle.getAttribute('aria-label')) === `${names[site]} mode`) break;
        await toggle.hover();
        await page.mouse.wheel(0, 100);
        await page.waitForTimeout(300); // one step per notch
      }
      await expect(page.getByRole('button', { name: `${names[site]} mode` })).toBeVisible();

      const search = page.getByRole('combobox', { name: 'Search' });
      await search.fill(PROMPT);
      await expect(page.getByTestId('search-panel')).toBeVisible(); // long text: the panel holds it
      const [tab] = await Promise.all([context.waitForEvent('page'), search.press('Alt+Enter')]);
      await tab.waitForLoadState();
      await expect.poll(() => tab.evaluate(() => document.body.dataset.sent ?? null), { timeout: 15_000 }).not.toBeNull();
      const sent = (await tab.evaluate(() => document.body.dataset.sent))!;
      const got = sent.split('\n').map((l) => l.trim()).filter(Boolean);
      expect(got).toEqual(lines); // every line, in order, nothing lost
      await expect(search).toHaveValue(''); // DevDeck's box is cleared
    } finally {
      await context.close();
    }
  });
}

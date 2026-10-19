import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

// Search bar → Gemini hand-off and voice input.
//   • web build: prompt goes to the clipboard, Gemini opens in a new tab
//   • extension: public/ai-content.js types the parked prompt into
//     Gemini's box and sends it — exercised here against a stand-in page
//     with Gemini's editor markup.

const CONTENT_SCRIPT = path.resolve('public/ai-content.js');

// Gemini's prompt box: a Quill editor inside <rich-textarea>, with a send
// button that stays disabled until the editor has text.
const FAKE_GEMINI = `<!doctype html><html><body>
  <rich-textarea><div class="ql-editor" contenteditable="true" role="textbox"></div></rich-textarea>
  <button class="send-button" aria-label="Send message" disabled>Send</button>
  <script>
    window.sent = [];
    const editor = () => document.querySelector('.ql-editor');
    const send = document.querySelector('.send-button');
    document.addEventListener('input', () => { send.disabled = !editor().textContent.trim(); });
    send.addEventListener('click', () => window.sent.push(editor().textContent));
  </script>
</body></html>`;

async function openFakeGemini(page: Page, pending: unknown, delayEditorMs = 0) {
  await page.context().route('https://gemini.google.com/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: delayEditorMs
        ? FAKE_GEMINI.replace('<rich-textarea>', '<template id="later"><rich-textarea>').replace(
            '</rich-textarea>',
            `</rich-textarea></template><script>setTimeout(() => document.body.prepend(document.getElementById('later').content.cloneNode(true)), ${delayEditorMs});</script>`,
          )
        : FAKE_GEMINI,
    }),
  );
  await page.addInitScript((item) => {
    const store: Record<string, unknown> = item ? { 'devdeck.aiPrompt': item } : {};
    (window as unknown as { chrome: unknown; removed: string[] }).removed = [];
    (window as unknown as { chrome: unknown }).chrome = {
      storage: {
        local: {
          get: async (key: string) => (key in store ? { [key]: store[key] } : {}),
          remove: async (key: string) => {
            delete store[key];
            (window as unknown as { removed: string[] }).removed.push(key);
          },
        },
      },
    };
  }, pending);
  await page.goto('https://gemini.google.com/app');
  await page.addScriptTag({ path: CONTENT_SCRIPT });
}

test.describe('content script on Gemini', () => {
  test('types the parked prompt and sends it', async ({ page }) => {
    await openFakeGemini(page, { text: 'explain react server components', at: Date.now() });
    await expect.poll(() => page.evaluate(() => (window as unknown as { sent: string[] }).sent)).toEqual([
      'explain react server components',
    ]);
    expect(await page.evaluate(() => (window as unknown as { removed: string[] }).removed)).toEqual([
      'devdeck.aiPrompt',
    ]);
  });

  test('waits for an editor that renders late', async ({ page }) => {
    await openFakeGemini(page, { text: 'late editor', at: Date.now() }, 1200);
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { sent: string[] }).sent), { timeout: 6000 })
      .toEqual(['late editor']);
  });

  test('drops a stale prompt without typing it', async ({ page }) => {
    await openFakeGemini(page, { text: 'old prompt', at: Date.now() - 5 * 60_000 });
    await page.waitForTimeout(800);
    await expect(page.locator('.ql-editor')).toHaveText('');
    expect(await page.evaluate(() => (window as unknown as { removed: string[] }).removed)).toEqual([
      'devdeck.aiPrompt',
    ]);
  });

  test('does nothing when Gemini is opened directly', async ({ page }) => {
    await openFakeGemini(page, null);
    await page.waitForTimeout(500);
    await expect(page.locator('.ql-editor')).toHaveText('');
  });
});

test.describe('search bar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.locator('[data-category-id]').first().waitFor({ state: 'visible' });
  });

  test('Gemini mode: Enter copies the prompt and opens a new Gemini tab', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await context.route('https://gemini.google.com/**', (route) => route.fulfill({ body: 'gemini' }));

    const toggle = page.getByRole('button', { name: 'Gemini mode' });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    const search = page.getByRole('combobox', { name: 'Search' });
    await expect(search).toBeFocused();
    await expect(search).toHaveAttribute('placeholder', 'Ask Gemini anything…');

    await search.fill('what is a monad');
    const options = page.getByRole('listbox', { name: 'Search suggestions' }).getByRole('option');
    await expect(options.first()).toHaveText(/Ask Gemini “what is a monad”/);
    await expect(page.getByText('Suggestions', { exact: true })).toHaveCount(0); // no Google tier

    const popup = context.waitForEvent('page');
    await search.press('Enter');
    expect((await popup).url()).toBe('https://gemini.google.com/app');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('what is a monad');
    await expect(page.getByTestId('search-hint')).toContainText('Prompt copied');

    // The mode survives a reload.
    await page.reload();
    await expect(page.getByRole('button', { name: 'Gemini mode' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('Gemini mode off: Enter still searches Google', async ({ page }) => {
    await page.context().route('https://www.google.com/**', (route) => route.fulfill({ body: 'google' }));
    const search = page.getByRole('combobox', { name: 'Search' });
    await search.fill('vite config');
    const [tab] = await Promise.all([page.waitForEvent('popup'), search.press('Enter')]);
    await tab.waitForURL(/google\.com\/search\?q=vite/);
  });

  test('voice input streams words into the box', async ({ page }) => {
    await page.addInitScript(() => {
      class FakeRecognition {
        onresult: ((e: unknown) => void) | null = null;
        onend: (() => void) | null = null;
        onerror: ((e: unknown) => void) | null = null;
        start() {
          const result = (text: string, isFinal: boolean) => ({ resultIndex: 0, results: [{ isFinal, 0: { transcript: text } }] });
          setTimeout(() => this.onresult?.(result('open the', false)), 150);
          setTimeout(() => this.onresult?.(result('open the docs', true)), 400);
          setTimeout(() => this.onend?.(), 500);
        }
        stop() {}
        abort() {}
      }
      Object.assign(window, { SpeechRecognition: FakeRecognition, webkitSpeechRecognition: FakeRecognition });
    });
    await page.context().grantPermissions(['microphone']);
    await page.reload();
    await page.locator('[data-category-id]').first().waitFor({ state: 'visible' });

    const mic = page.getByRole('button', { name: 'Search by voice' });
    await mic.click();
    await expect(page.getByRole('button', { name: 'Stop voice input' })).toHaveAttribute('aria-pressed', 'true');
    const search = page.getByRole('combobox', { name: 'Search' });
    await expect(search).toHaveValue('open the docs');
    await expect(search).toBeFocused();
    await expect(page.getByRole('button', { name: 'Search by voice' })).toHaveAttribute('aria-pressed', 'false');
  });

  test('voice input reports a blocked microphone', async ({ page }) => {
    await page.addInitScript(() => {
      class DeniedRecognition {
        onerror: ((e: { error: string }) => void) | null = null;
        onend: (() => void) | null = null;
        start() {
          setTimeout(() => {
            this.onerror?.({ error: 'not-allowed' });
            this.onend?.();
          }, 100);
        }
        stop() {}
        abort() {}
      }
      Object.assign(window, { SpeechRecognition: DeniedRecognition, webkitSpeechRecognition: DeniedRecognition });
    });
    await page.context().grantPermissions(['microphone']);
    await page.reload();
    await page.locator('[data-category-id]').first().waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Search by voice' }).click();
    await expect(page.getByTestId('search-hint')).toContainText('Microphone access is blocked');
  });
});

test.describe('other AI providers', () => {
  test('content script types and sends on ChatGPT, and ignores prompts meant for another site', async ({ page }) => {
    const body = `<!doctype html><html><body>
      <div id="prompt-textarea" contenteditable="true"></div>
      <button data-testid="send-button" disabled>Send</button>
      <script>
        window.sent = [];
        const ed = () => document.getElementById('prompt-textarea');
        const send = document.querySelector('[data-testid=send-button]');
        document.addEventListener('input', () => { send.disabled = !ed().textContent.trim(); });
        send.addEventListener('click', () => window.sent.push(ed().textContent));
      </script></body></html>`;
    await page.context().route('https://chatgpt.com/**', (route) => route.fulfill({ contentType: 'text/html', body }));
    const run = async (item: unknown) => {
      await page.addInitScript((it) => {
        const store: Record<string, unknown> = { 'devdeck.aiPrompt': it };
        (window as unknown as { chrome: unknown }).chrome = {
          storage: { local: { get: async (k: string) => (k in store ? { [k]: store[k] } : {}), remove: async (k: string) => void delete store[k] } },
        };
      }, item);
      await page.goto('https://chatgpt.com/');
      await page.addScriptTag({ path: CONTENT_SCRIPT });
    };
    await run({ text: 'refactor this hook', at: Date.now(), site: 'chatgpt' });
    await expect.poll(() => page.evaluate(() => (window as unknown as { sent: string[] }).sent)).toEqual(['refactor this hook']);
  });

  test('Perplexity runs straight from the link', async ({ page, context }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.locator('[data-category-id]').first().waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const modal = page.getByRole('dialog', { name: 'DevDeck Settings' });
    await modal.getByRole('button', { name: /Profile/ }).click();
    await modal.getByRole('radio', { name: /^Perplexity/ }).click();
    await page.keyboard.press('Escape');
    await context.route('https://www.perplexity.ai/**', (route) => route.fulfill({ body: 'pplx' }));
    await page.getByRole('button', { name: 'Perplexity mode' }).click();
    const search = page.getByRole('combobox', { name: 'Search' });
    await search.fill('best rust web framework');
    const [tab] = await Promise.all([page.waitForEvent('popup'), search.press('Enter')]);
    await tab.waitForURL(/perplexity\.ai\/search\?q=best%20rust%20web%20framework/);
  });
});

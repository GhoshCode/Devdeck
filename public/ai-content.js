// DevDeck → AI chat hand-off (content script on Gemini, ChatGPT and Claude).
// The new-tab page parks the prompt in chrome.storage.local and opens the
// site; this types it into the site's prompt box and sends it. The prompt is
// removed as soon as it is read, only used on the site it was meant for, and
// ignored if it is older than a minute, so opening the site any other way
// never replays an old prompt.
(() => {
  const KEY = 'devdeck.aiPrompt'; // keep in sync with src/services/ai.ts
  const FRESH_MS = 60_000;
  const EDITOR_TIMEOUT_MS = 20_000;
  const SEND_TIMEOUT_MS = 6_000;

  // Prompt box and send button per site, most specific selector first.
  const SITES = {
    gemini: {
      host: /(^|\.)gemini\.google\.com$/,
      editor: ['rich-textarea .ql-editor[contenteditable="true"]', '[contenteditable="true"][role="textbox"]'],
      send: ['button.send-button', 'button[aria-label*="Send" i]'],
    },
    chatgpt: {
      host: /(^|\.)chatgpt\.com$|(^|\.)chat\.openai\.com$/,
      editor: ['#prompt-textarea[contenteditable="true"]', 'div.ProseMirror[contenteditable="true"]', 'textarea#prompt-textarea', 'form textarea'],
      send: ['button[data-testid="send-button"]', '#composer-submit-button', 'button[aria-label*="Send" i]'],
    },
    claude: {
      host: /(^|\.)claude\.ai$/,
      editor: ['div.ProseMirror[contenteditable="true"]', '[contenteditable="true"][role="textbox"]', 'fieldset [contenteditable="true"]'],
      send: ['button[aria-label="Send message"]', 'button[aria-label*="Send" i]'],
    },
  };

  const site = Object.entries(SITES).find(([, s]) => s.host.test(location.hostname));
  if (!site) return;
  const [siteId, cfg] = site;

  const first = (selectors) => {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  };
  const findEditor = () => first(cfg.editor);
  const findSend = () => {
    const button = first(cfg.send);
    if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true') return null;
    return button;
  };

  // Resolves with fn()'s first truthy result, or null after `ms`.
  const waitFor = (fn, ms) =>
    new Promise((resolve) => {
      const hit = fn();
      if (hit) return resolve(hit);
      const observer = new MutationObserver(() => {
        const found = fn();
        if (!found) return;
        observer.disconnect();
        clearTimeout(timer);
        resolve(found);
      });
      observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
      const timer = setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, ms);
    });

  const typeInto = (editor, text) => {
    editor.focus();
    if (editor instanceof HTMLTextAreaElement || editor instanceof HTMLInputElement) {
      // React-controlled fields need the native setter so the framework sees the change.
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(editor), 'value').set;
      setter.call(editor, text);
      editor.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
    const selection = window.getSelection();
    selection.selectAllChildren(editor);
    selection.collapseToEnd();
    // insertText goes through the editor's own input handling (Quill /
    // ProseMirror), so the site sees a real edit and enables its send button.
    if (!document.execCommand('insertText', false, text) || !editor.textContent.trim()) {
      editor.textContent = text;
      editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    }
  };

  const pressEnter = (editor) => {
    const init = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
    editor.dispatchEvent(new KeyboardEvent('keydown', init));
    editor.dispatchEvent(new KeyboardEvent('keyup', init));
  };

  chrome.storage.local.get(KEY).then(async (items) => {
    const pending = items[KEY];
    if (!pending || (pending.site && pending.site !== siteId)) return;
    await chrome.storage.local.remove(KEY);
    if (typeof pending.text !== 'string' || !pending.text || Date.now() - pending.at > FRESH_MS) return;

    const editor = await waitFor(findEditor, EDITOR_TIMEOUT_MS);
    if (!editor) return;
    typeInto(editor, pending.text);
    const send = await waitFor(findSend, SEND_TIMEOUT_MS);
    if (send) send.click();
    else pressEnter(editor);
  });
})();

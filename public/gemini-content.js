// DevDeck → Gemini hand-off (content script on gemini.google.com).
// The new-tab page parks the prompt in chrome.storage.local and opens Gemini;
// this types it into Gemini's prompt box and sends it. The prompt is removed
// as soon as it is read and ignored if it is older than a minute, so opening
// Gemini any other way never replays an old prompt.
(() => {
  const KEY = 'devdeck.geminiPrompt'; // keep in sync with src/services/gemini.ts
  const FRESH_MS = 60_000;
  const EDITOR_TIMEOUT_MS = 20_000;
  const SEND_TIMEOUT_MS = 5_000;

  const findEditor = () =>
    document.querySelector('rich-textarea .ql-editor[contenteditable="true"]') ||
    document.querySelector('[contenteditable="true"][role="textbox"]');

  const findSend = () => {
    const button = document.querySelector('button.send-button, button[aria-label*="Send" i]');
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
    const selection = window.getSelection();
    selection.selectAllChildren(editor);
    selection.collapseToEnd();
    // insertText goes through the editor's own input handling (Quill), so
    // Gemini sees a real edit and enables its send button.
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
    if (!pending) return;
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

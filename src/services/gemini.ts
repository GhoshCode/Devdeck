// "Ask Gemini" mode of the search bar. Gemini has no URL parameter that
// fills its prompt, so the hand-off depends on where DevDeck runs:
//   • extension → the prompt is parked in chrome.storage.local and the tab
//                 goes to gemini.google.com; public/gemini-content.js picks it
//                 up there, types it into the prompt box and sends it.
//   • website   → no script can reach Gemini's page, so the prompt goes to
//                 the clipboard and Gemini opens in a new tab, ready to paste.

import { isExtension } from '../lib/env';

export const GEMINI_URL = 'https://gemini.google.com/app';
// Shared with public/gemini-content.js — keep the two in sync.
export const GEMINI_PROMPT_KEY = 'devdeck.geminiPrompt';

interface ChromeStorage {
  storage?: { local?: { set(items: Record<string, unknown>): Promise<void> } };
}

export type GeminiHandoff = 'auto' | 'clipboard' | 'manual';

export async function askGemini(
  text: string,
  opts: { newTab?: boolean; navigate?: (url: string, newTab: boolean) => void } = {},
): Promise<GeminiHandoff> {
  const prompt = text.trim();
  const navigate =
    opts.navigate ??
    ((url: string, newTab: boolean) => (newTab ? window.open(url, '_blank', 'noopener') : window.location.assign(url)));

  if (isExtension()) {
    const chrome = (globalThis as { chrome?: ChromeStorage }).chrome;
    try {
      await chrome?.storage?.local?.set({ [GEMINI_PROMPT_KEY]: { text: prompt, at: Date.now() } });
      navigate(GEMINI_URL, !!opts.newTab);
      return 'auto';
    } catch {
      // fall through to the clipboard path
    }
  }

  let copied = false;
  try {
    await navigator.clipboard.writeText(prompt);
    copied = true;
  } catch {
    // clipboard blocked — Gemini still opens
  }
  // On the web the tab must survive so the user can see the paste hint.
  navigate(GEMINI_URL, true);
  return copied ? 'clipboard' : 'manual';
}

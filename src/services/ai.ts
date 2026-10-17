// AI mode of the search bar: with the toggle on, Enter opens a new chat with
// the chosen assistant and the text already sent.
//   • Gemini, ChatGPT, Claude — no URL parameter reliably sends a prompt, so in
//     the extension the prompt is parked in chrome.storage.local and
//     public/ai-content.js types it into the site's prompt box and presses send.
//     On the website the prompt goes to the clipboard and the site opens in a
//     new tab, ready to paste.
//   • Perplexity and custom URLs — the query goes in the URL ({q}), which
//     runs it directly everywhere.

import { isExtension } from '../lib/env';

export type AiProviderId = 'gemini' | 'chatgpt' | 'claude' | 'perplexity' | 'custom';

export interface AiProvider {
  id: AiProviderId;
  name: string;
  url: string; // new-chat page, or a template with {q}
  via: 'script' | 'url';
  color: string;
}

export const AI_PROVIDERS: readonly AiProvider[] = [
  { id: 'gemini', name: 'Gemini', url: 'https://gemini.google.com/app', via: 'script', color: '#9b72cb' },
  { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com/', via: 'script', color: '#10a37f' },
  { id: 'claude', name: 'Claude', url: 'https://claude.ai/new', via: 'script', color: '#d97757' },
  { id: 'perplexity', name: 'Perplexity', url: 'https://www.perplexity.ai/search?q={q}', via: 'url', color: '#20b8cd' },
];

// Shared with public/ai-content.js — keep the two in sync.
export const AI_PROMPT_KEY = 'devdeck.aiPrompt';

export function aiProvider(id: AiProviderId | undefined, customUrl?: string): AiProvider {
  if (id === 'custom' && customUrl?.includes('{q}')) {
    let host = 'Custom AI';
    try {
      host = new URL(customUrl.replace('{q}', '')).hostname.replace(/^www\./, '');
    } catch {
      // keep the generic name
    }
    return { id: 'custom', name: host, url: customUrl, via: 'url', color: '#8b5cf6' };
  }
  return AI_PROVIDERS.find((p) => p.id === id) ?? AI_PROVIDERS[0];
}

interface ChromeStorage {
  storage?: { local?: { set(items: Record<string, unknown>): Promise<void> } };
}

export type AiHandoff = 'auto' | 'clipboard' | 'manual';

export async function askAi(
  provider: AiProvider,
  text: string,
  opts: { newTab?: boolean; navigate?: (url: string, newTab: boolean) => void } = {},
): Promise<AiHandoff> {
  const prompt = text.trim();
  const navigate =
    opts.navigate ??
    ((url: string, newTab: boolean) => (newTab ? window.open(url, '_blank', 'noopener') : window.location.assign(url)));

  if (provider.via === 'url') {
    navigate(provider.url.replaceAll('{q}', encodeURIComponent(prompt)), !!opts.newTab);
    return 'auto';
  }

  if (isExtension()) {
    const chrome = (globalThis as { chrome?: ChromeStorage }).chrome;
    try {
      await chrome?.storage?.local?.set({ [AI_PROMPT_KEY]: { text: prompt, at: Date.now(), site: provider.id } });
      navigate(provider.url, !!opts.newTab);
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
    // clipboard blocked — the site still opens
  }
  // On the web the tab must survive so the user can see the paste hint.
  navigate(provider.url, true);
  return copied ? 'clipboard' : 'manual';
}

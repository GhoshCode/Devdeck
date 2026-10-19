import type { ModeLook, Settings, ThemeMode } from '../types';
import { SONOMA_ACCENT } from './skin';

// Theme-mode switching for Settings → Appearance and the "Auto" (follow the
// OS) option. Each mode remembers its own look — preset, accent, backdrop —
// so Light ↔ Dark round trips bring back what the user chose for each.
// public/theme-init.js mirrors lookFor() for the first paint; keep in sync.

export const DEFAULT_LOOK: Record<ThemeMode, ModeLook> = {
  dark: { presetTheme: 'default-dark', accentColor: '#ff2e9a', backgroundImage: null },
  light: { presetTheme: 'default-light', accentColor: SONOMA_ACCENT, backgroundImage: null },
};

type ModeSettings = Pick<Settings, 'themeMode' | 'presetTheme' | 'accentColor' | 'backgroundImage' | 'modeLooks'>;

export const lookFor = (s: ModeSettings, mode: ThemeMode): ModeLook => s.modeLooks?.[mode] ?? DEFAULT_LOOK[mode];

// The settings patch that moves to `mode`: saves the current look under the
// current mode and restores the one remembered for `mode`. Empty when already there.
export function switchModePatch(s: ModeSettings, mode: ThemeMode): Partial<Settings> {
  const current = s.themeMode ?? 'dark';
  if (current === mode) return {};
  const saved: ModeLook = {
    presetTheme: s.presetTheme ?? DEFAULT_LOOK[current].presetTheme,
    accentColor: s.accentColor,
    backgroundImage: s.backgroundImage,
  };
  return { themeMode: mode, ...lookFor(s, mode), modeLooks: { ...s.modeLooks, [current]: saved } };
}

export const systemMode = (): ThemeMode =>
  window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

// WCAG contrast of white text on `hex` (accent buttons use white labels).
export function contrastWithWhite(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 21;
  const n = parseInt(m[1], 16);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return 1.05 / (L + 0.05);
}

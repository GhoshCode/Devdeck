import type { ThemeMode } from '../types';

export interface PresetTheme {
  id: string;
  name: string;
  mode: ThemeMode;
  accentColor: string;
  gradient: string | null;
  // Thumbnail for the preset picker when `gradient` is null (skins draw
  // their own backdrop, so there is nothing to copy into backgroundImage).
  swatch?: string;
  description: string;
}

export const PRESET_THEMES: readonly PresetTheme[] = [
  {
    id: 'default-dark',
    name: 'Obsidian Violet',
    mode: 'dark',
    accentColor: '#ff2e9a',
    gradient: null,
    description: 'Default futuristic obsidian glass with violet particles',
  },
  {
    id: 'default-light',
    // Id kept so existing light-mode users move to Sonoma Glass automatically.
    // No gradient: the skin (src/lib/skin.ts) paints its own backdrop.
    name: 'Sonoma Glass',
    mode: 'light',
    accentColor: '#007aff',
    gradient: null,
    swatch:
      'radial-gradient(at 0% 0%, rgba(120, 170, 255, 0.75), transparent 60%), radial-gradient(at 100% 0%, rgba(190, 160, 255, 0.6), transparent 60%), radial-gradient(at 100% 100%, rgba(255, 170, 200, 0.55), transparent 60%), linear-gradient(160deg, #e9eefb, #f7eef2)',
    description: 'macOS-style frosted glass with clear, layered depth',
  },
  {
    id: 'pure-light',
    name: 'Absolute Light',
    mode: 'light',
    accentColor: '#4f46e5',
    gradient:
      'radial-gradient(at 10% 10%, rgba(224, 231, 255, 0.7) 0px, transparent 50%), radial-gradient(at 90% 90%, rgba(241, 245, 249, 0.8) 0px, transparent 55%), linear-gradient(135deg, #e8edf5 0%, #edf2f8 50%, #e2e8f0 100%)',
    description: 'Ultra-clean pure light mode with radiant slate backdrop',
  },
  {
    id: 'solar-light',
    name: 'Solar Amber',
    mode: 'light',
    accentColor: '#b45309',
    gradient: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 50%, #fde68a 100%)',
    description: 'Warm glowing sunlight with golden amber hues',
  },
  {
    id: 'sky-light',
    name: 'Sky Azure',
    mode: 'light',
    accentColor: '#0284c7',
    gradient: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #bae6fd 100%)',
    description: 'Clear azure daylight with crisp sky gradients',
  },
  {
    id: 'lavender-light',
    name: 'Lavender Mist',
    mode: 'light',
    accentColor: '#7c3aed',
    gradient:
      'radial-gradient(at 15% 10%, rgba(221, 214, 254, 0.9), transparent 55%), radial-gradient(at 85% 90%, rgba(251, 207, 232, 0.7), transparent 55%), linear-gradient(135deg, #f5f3ff 0%, #faf5ff 50%, #fdf2f8 100%)',
    description: 'Soft violet morning haze with a rose glow',
  },
  {
    id: 'matcha-light',
    name: 'Matcha',
    mode: 'light',
    accentColor: '#15803d',
    gradient: 'linear-gradient(135deg, #f0fdf4 0%, #ecfccb 55%, #d9f99d 100%)',
    description: 'Calm green tea tones for long focus sessions',
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Neon',
    mode: 'dark',
    accentColor: '#00f0ff',
    gradient: 'linear-gradient(135deg, #090214 0%, #17042a 35%, #2a0845 70%, #03081e 100%)',
    description: 'High-octane neon cyan & purple electric night',
  },
  {
    id: 'aurora',
    name: 'Aurora Borealis',
    mode: 'dark',
    accentColor: '#10b981',
    gradient: 'linear-gradient(135deg, #04141d 0%, #002d44 35%, #005456 70%, #081e37 100%)',
    description: 'Arctic nocturnal waves of deep teal and glowing emerald',
  },
  {
    id: 'sunset',
    name: 'Sunset Horizon',
    mode: 'dark',
    accentColor: '#f59e0b',
    gradient: 'linear-gradient(135deg, #180922 0%, #35082e 40%, #521832 70%, #150620 100%)',
    description: 'Warm twilight dusk with amber and rose horizons',
  },
  {
    id: 'midnight',
    name: 'Midnight Abyss',
    mode: 'dark',
    accentColor: '#38bdf8',
    gradient: 'linear-gradient(135deg, #040610 0%, #080d22 45%, #0b1335 80%, #02040b 100%)',
    description: 'Deep oceanic trench navy with sapphire starlight',
  },
  {
    id: 'emerald',
    name: 'Emerald Matrix',
    mode: 'dark',
    accentColor: '#22c55e',
    gradient: 'linear-gradient(135deg, #020f06 0%, #042111 45%, #08381d 80%, #010803 100%)',
    description: 'Deep forest cyberpunk matrix with emerald glow',
  },
  {
    id: 'obsidian-monochrome',
    name: 'Obsidian Slate',
    mode: 'dark',
    accentColor: '#94a3b8',
    gradient: 'linear-gradient(135deg, #090a0c 0%, #111317 50%, #181b22 100%)',
    description: 'Ultra-minimalist stealth monochrome carbon glass',
  },
  {
    id: 'sequoia',
    name: 'Sequoia Dusk',
    mode: 'dark',
    accentColor: '#fb7185',
    gradient:
      'radial-gradient(at 80% 0%, rgba(190, 60, 40, 0.55), transparent 55%), radial-gradient(at 0% 100%, rgba(120, 30, 80, 0.55), transparent 55%), linear-gradient(160deg, #1a0b10 0%, #2a0f18 50%, #12070c 100%)',
    description: 'Redwood embers fading into a wine-dark night',
  },
  {
    id: 'nebula',
    name: 'Nebula',
    mode: 'dark',
    accentColor: '#a78bfa',
    gradient:
      'radial-gradient(at 20% 20%, rgba(99, 102, 241, 0.45), transparent 50%), radial-gradient(at 80% 70%, rgba(236, 72, 153, 0.35), transparent 55%), linear-gradient(135deg, #0a0820 0%, #120a2e 50%, #070512 100%)',
    description: 'Indigo and magenta gas clouds in deep space',
  },
];

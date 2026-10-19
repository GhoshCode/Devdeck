import type { ThemeMode } from '../types';

export type ThemeCategory = 'macos' | 'light' | 'vibrant' | 'nature' | 'jewel' | 'pastel' | 'solids';

export const THEME_CATEGORIES: ReadonlyArray<{
  id: ThemeCategory;
  label: string;
}> = [
  { id: 'macos', label: 'macOS' },
  { id: 'light', label: 'Light' },
  { id: 'vibrant', label: 'Vibrant' },
  { id: 'nature', label: 'Nature' },
  { id: 'jewel', label: 'Jewel' },
  { id: 'pastel', label: 'Pastel' },
  { id: 'solids', label: 'Solids' },
];

export interface PresetTheme {
  id: string;
  name: string;
  category: ThemeCategory;
  mode: ThemeMode;
  accentColor: string;
  gradient: string | null;
  // Thumbnail for the preset picker when `gradient` is null (skins draw
  // their own backdrop, so there is nothing to copy into backgroundImage).
  swatch?: string;
  description: string;
}

// default-dark / default-light keep their ids: the Sonoma skin (src/lib/skin.ts)
// and stored settings depend on them.
export const PRESET_THEMES: readonly PresetTheme[] = [
  {
    id: 'default-dark',
    name: 'Obsidian Violet',
    category: 'macos',
    mode: 'dark',
    accentColor: '#ff2e9a',
    gradient: null,
    description: 'Default futuristic obsidian glass with violet particles',
  },
  {
    id: 'sequoia',
    name: 'Sequoia Dusk',
    category: 'macos',
    mode: 'dark',
    accentColor: '#fb7185',
    gradient:
      'radial-gradient(at 80% 0%, rgba(190, 60, 40, 0.55), transparent 55%), radial-gradient(at 0% 100%, rgba(120, 30, 80, 0.55), transparent 55%), linear-gradient(160deg, #1a0b10 0%, #2a0f18 50%, #12070c 100%)',
    description: 'Redwood embers fading into a wine-dark night',
  },
  {
    id: 'macos-sonoma',
    name: 'Sonoma Horizon',
    category: 'macos',
    mode: 'dark',
    accentColor: '#ff2e9a',
    gradient:
      'radial-gradient(at 0% 0%, rgba(244, 63, 94, 0.45) 0px, transparent 55%), radial-gradient(at 100% 0%, rgba(245, 158, 11, 0.4) 0px, transparent 50%), radial-gradient(at 50% 100%, rgba(139, 92, 246, 0.45) 0px, transparent 60%), radial-gradient(at 0% 100%, rgba(99, 102, 241, 0.35) 0px, transparent 50%), linear-gradient(135deg, #0b0713 0%, #150928 45%, #0d061c 100%)',
    description: 'Flagship macOS Sonoma twilight dusk mesh with warm amber & obsidian glass',
  },
  {
    id: 'macos-sequoia',
    name: 'Sequoia Redwood',
    category: 'macos',
    mode: 'dark',
    accentColor: '#2dd4bf',
    gradient:
      'radial-gradient(at 0% 0%, rgba(20, 184, 166, 0.38) 0px, transparent 55%), radial-gradient(at 100% 100%, rgba(16, 185, 129, 0.32) 0px, transparent 50%), radial-gradient(at 50% 50%, rgba(5, 150, 105, 0.28) 0px, transparent 60%), linear-gradient(135deg, #02120e 0%, #06231b 45%, #02140e 100%)',
    description: 'Deep cedar twilight, emerald pine fog, and dark alpine frosted glass',
  },
  {
    id: 'macos-ventura',
    name: 'Ventura Silk',
    category: 'macos',
    mode: 'dark',
    accentColor: '#f97316',
    gradient:
      'radial-gradient(at 20% 20%, rgba(249, 115, 22, 0.45) 0px, transparent 50%), radial-gradient(at 80% 80%, rgba(236, 72, 153, 0.4) 0px, transparent 55%), radial-gradient(at 50% 100%, rgba(168, 85, 247, 0.35) 0px, transparent 60%), linear-gradient(135deg, #0d041a 0%, #200635 45%, #0a0216 100%)',
    description: 'Vibrant abstract orange-amber silk ribbon on cosmic indigo',
  },
  {
    id: 'macos-monterey',
    name: 'Monterey Peak',
    category: 'macos',
    mode: 'dark',
    accentColor: '#af52de',
    gradient:
      'radial-gradient(at 10% 10%, rgba(192, 132, 252, 0.4) 0px, transparent 50%), radial-gradient(at 90% 90%, rgba(244, 63, 94, 0.35) 0px, transparent 55%), linear-gradient(135deg, #0f0520 0%, #28084a 50%, #0d041c 100%)',
    description: 'Deep violet, dusk magenta, and obsidian mountain dusk',
  },
  {
    id: 'macos-bigsur',
    name: 'Big Sur Coast',
    category: 'macos',
    mode: 'dark',
    accentColor: '#007aff',
    gradient:
      'radial-gradient(at 0% 0%, rgba(14, 165, 233, 0.45) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(99, 102, 241, 0.35) 0px, transparent 55%), radial-gradient(at 50% 0%, rgba(56, 189, 248, 0.3) 0px, transparent 50%), linear-gradient(135deg, #030d22 0%, #07193b 50%, #020919 100%)',
    description: 'Azure Californian coastal ocean, golden sunlight, and sapphire depth',
  },
  {
    id: 'default-light',
    name: 'Sonoma Glass',
    category: 'light',
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
    category: 'light',
    mode: 'light',
    accentColor: '#4f46e5',
    gradient:
      'radial-gradient(at 10% 10%, rgba(224, 231, 255, 0.7) 0px, transparent 50%), radial-gradient(at 90% 90%, rgba(241, 245, 249, 0.8) 0px, transparent 55%), linear-gradient(135deg, #e8edf5 0%, #edf2f8 50%, #e2e8f0 100%)',
    description: 'Ultra-clean pure light mode with radiant slate backdrop',
  },
  {
    id: 'solar-light',
    name: 'Solar Amber',
    category: 'light',
    mode: 'light',
    accentColor: '#b45309',
    gradient: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 50%, #fde68a 100%)',
    description: 'Warm glowing sunlight with golden amber hues',
  },
  {
    id: 'sky-light',
    name: 'Sky Azure',
    category: 'light',
    mode: 'light',
    accentColor: '#0284c7',
    gradient: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #bae6fd 100%)',
    description: 'Clear azure daylight with crisp sky gradients',
  },
  {
    id: 'paper-white',
    name: 'Minimal Porcelain',
    category: 'light',
    mode: 'light',
    accentColor: '#0f172a',
    gradient: 'linear-gradient(135deg, #fbfbfd 0%, #f4f5f8 50%, #eceef3 100%)',
    description: 'Studio gallery off-white porcelain with crisp graphite typography',
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Neon',
    category: 'vibrant',
    mode: 'dark',
    accentColor: '#00f0ff',
    gradient: 'linear-gradient(135deg, #090214 0%, #17042a 35%, #2a0845 70%, #03081e 100%)',
    description: 'High-octane neon cyan & purple electric night',
  },
  {
    id: 'sunset',
    name: 'Sunset Horizon',
    category: 'vibrant',
    mode: 'dark',
    accentColor: '#f59e0b',
    gradient: 'linear-gradient(135deg, #180922 0%, #35082e 40%, #521832 70%, #150620 100%)',
    description: 'Warm twilight dusk with amber and rose horizons',
  },
  {
    id: 'vibrant-vaporwave',
    name: 'Vaporwave 80s',
    category: 'vibrant',
    mode: 'dark',
    accentColor: '#f43f5e',
    gradient:
      'radial-gradient(at 0% 0%, rgba(244, 63, 94, 0.5) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(6, 182, 212, 0.45) 0px, transparent 55%), linear-gradient(135deg, #18002e 0%, #3b0764 40%, #831843 75%, #082f49 100%)',
    description: 'Electric magenta sunset, glowing cyan grid, and retro-futuristic twilight',
  },
  {
    id: 'vibrant-solar',
    name: 'Solar Flare',
    category: 'vibrant',
    mode: 'dark',
    accentColor: '#f59e0b',
    gradient:
      'radial-gradient(at 10% 20%, rgba(245, 158, 11, 0.45) 0px, transparent 55%), radial-gradient(at 90% 80%, rgba(239, 68, 68, 0.4) 0px, transparent 50%), linear-gradient(135deg, #1c0500 0%, #450a0a 40%, #78350f 75%, #180500 100%)',
    description: 'Molten gold radiance, burning crimson horizons, and stellar warmth',
  },
  {
    id: 'vibrant-neon-tropic',
    name: 'Neon Tropic',
    category: 'vibrant',
    mode: 'dark',
    accentColor: '#ec4899',
    gradient:
      'radial-gradient(at 100% 0%, rgba(20, 184, 166, 0.45) 0px, transparent 55%), radial-gradient(at 0% 100%, rgba(236, 72, 153, 0.45) 0px, transparent 55%), linear-gradient(135deg, #0a041c 0%, #1e1b4b 40%, #4c0519 75%, #042f2e 100%)',
    description: 'Hot flamingo pink, vibrant turquoise reefs, and nocturnal tropical glow',
  },
  {
    id: 'aurora',
    name: 'Aurora Borealis',
    category: 'nature',
    mode: 'dark',
    accentColor: '#10b981',
    gradient: 'linear-gradient(135deg, #04141d 0%, #002d44 35%, #005456 70%, #081e37 100%)',
    description: 'Arctic nocturnal waves of deep teal and glowing emerald',
  },
  {
    id: 'emerald',
    name: 'Emerald Matrix',
    category: 'nature',
    mode: 'dark',
    accentColor: '#22c55e',
    gradient: 'linear-gradient(135deg, #020f06 0%, #042111 45%, #08381d 80%, #010803 100%)',
    description: 'Deep forest cyberpunk matrix with emerald glow',
  },
  {
    id: 'nature-terracotta',
    name: 'Terracotta Canyon',
    category: 'nature',
    mode: 'dark',
    accentColor: '#ea580c',
    gradient:
      'radial-gradient(at 20% 20%, rgba(234, 88, 12, 0.4) 0px, transparent 50%), radial-gradient(at 80% 80%, rgba(217, 119, 6, 0.35) 0px, transparent 50%), linear-gradient(135deg, #1b0c07 0%, #3a150c 40%, #7c2d12 75%, #180905 100%)',
    description: 'Warm desert sandstone, baked ochre clay, and sunset canyon dusk',
  },
  {
    id: 'nature-ocean',
    name: 'Deep Ocean Abyss',
    category: 'nature',
    mode: 'dark',
    accentColor: '#06b6d4',
    gradient:
      'radial-gradient(at 10% 20%, rgba(6, 182, 212, 0.45) 0px, transparent 50%), radial-gradient(at 90% 80%, rgba(14, 165, 233, 0.35) 0px, transparent 50%), linear-gradient(135deg, #020b17 0%, #04203b 50%, #020914 100%)',
    description: 'Bioluminescent cyan, aquatic turquoise reef, and sapphire oceanic trench',
  },
  {
    id: 'midnight',
    name: 'Midnight Abyss',
    category: 'jewel',
    mode: 'dark',
    accentColor: '#38bdf8',
    gradient: 'linear-gradient(135deg, #040610 0%, #080d22 45%, #0b1335 80%, #02040b 100%)',
    description: 'Deep oceanic trench navy with sapphire starlight',
  },
  {
    id: 'nebula',
    name: 'Nebula',
    category: 'jewel',
    mode: 'dark',
    accentColor: '#a78bfa',
    gradient:
      'radial-gradient(at 20% 20%, rgba(99, 102, 241, 0.45), transparent 50%), radial-gradient(at 80% 70%, rgba(236, 72, 153, 0.35), transparent 55%), linear-gradient(135deg, #0a0820 0%, #120a2e 50%, #070512 100%)',
    description: 'Indigo and magenta gas clouds in deep space',
  },
  {
    id: 'jewel-amethyst',
    name: 'Imperial Amethyst',
    category: 'jewel',
    mode: 'dark',
    accentColor: '#a855f7',
    gradient:
      'radial-gradient(at 20% 20%, rgba(168, 85, 247, 0.45) 0px, transparent 50%), radial-gradient(at 80% 80%, rgba(217, 70, 239, 0.35) 0px, transparent 55%), linear-gradient(135deg, #0e021c 0%, #220538 50%, #090114 100%)',
    description: 'Royal purple velvet, dark plum wine, and celestial obsidian starlight',
  },
  {
    id: 'jewel-sapphire',
    name: 'Royal Sapphire',
    category: 'jewel',
    mode: 'dark',
    accentColor: '#3b82f6',
    gradient:
      'radial-gradient(at 0% 0%, rgba(59, 130, 246, 0.45) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(99, 102, 241, 0.4) 0px, transparent 50%), linear-gradient(135deg, #03081c 0%, #081438 50%, #020614 100%)',
    description: 'Deep sovereign cobalt, midnight blue velvet, and starry sapphire depth',
  },
  {
    id: 'jewel-ruby',
    name: 'Ruby Velvet',
    category: 'jewel',
    mode: 'dark',
    accentColor: '#f43f5e',
    gradient:
      'radial-gradient(at 30% 20%, rgba(244, 63, 94, 0.4) 0px, transparent 50%), linear-gradient(135deg, #17030a 0%, #380718 45%, #590a26 75%, #120207 100%)',
    description: 'Rich burgundy noir, black cherry wine, and burnished rose velvet',
  },
  {
    id: 'jewel-topaz',
    name: 'Midnight Topaz',
    category: 'jewel',
    mode: 'dark',
    accentColor: '#eab308',
    gradient:
      'radial-gradient(at 20% 10%, rgba(234, 179, 8, 0.35) 0px, transparent 50%), linear-gradient(135deg, #0c0e14 0%, #181c26 50%, #0a0b10 100%)',
    description: 'Lustrous golden topaz illumination over titanium charcoal slate',
  },
  {
    id: 'lavender-light',
    name: 'Lavender Mist',
    category: 'pastel',
    mode: 'light',
    accentColor: '#7c3aed',
    gradient:
      'radial-gradient(at 15% 10%, rgba(221, 214, 254, 0.9), transparent 55%), radial-gradient(at 85% 90%, rgba(251, 207, 232, 0.7), transparent 55%), linear-gradient(135deg, #f5f3ff 0%, #faf5ff 50%, #fdf2f8 100%)',
    description: 'Soft violet morning haze with a rose glow',
  },
  {
    id: 'matcha-light',
    name: 'Matcha',
    category: 'pastel',
    mode: 'light',
    accentColor: '#15803d',
    gradient: 'linear-gradient(135deg, #f0fdf4 0%, #ecfccb 55%, #d9f99d 100%)',
    description: 'Calm green tea tones for long focus sessions',
  },
  {
    id: 'pastel-peach',
    name: 'Peach Sorbet',
    category: 'pastel',
    mode: 'light',
    accentColor: '#f97316',
    gradient:
      'radial-gradient(at 10% 10%, rgba(254, 215, 170, 0.8) 0px, transparent 50%), radial-gradient(at 90% 90%, rgba(254, 205, 211, 0.7) 0px, transparent 50%), linear-gradient(135deg, #fff7ed 0%, #ffedd5 50%, #fdf2f8 100%)',
    description: 'Sunlit apricot peach, soft rose quartz, and warm marshmallow cream',
  },
  {
    id: 'pastel-nordic',
    name: 'Nordic Fog',
    category: 'pastel',
    mode: 'light',
    accentColor: '#475569',
    gradient:
      'radial-gradient(at 20% 20%, rgba(226, 232, 240, 0.9) 0px, transparent 50%), radial-gradient(at 80% 80%, rgba(203, 213, 225, 0.7) 0px, transparent 50%), linear-gradient(135deg, #f8fafc 0%, #f1f5f9 50%, #e2e8f0 100%)',
    description: 'Muted Scandinavian slate, mist grey fog, and soft frosted linen',
  },
  {
    id: 'obsidian-monochrome',
    name: 'Obsidian Slate',
    category: 'solids',
    mode: 'dark',
    accentColor: '#94a3b8',
    gradient: 'linear-gradient(135deg, #090a0c 0%, #111317 50%, #181b22 100%)',
    description: 'Ultra-minimalist stealth monochrome carbon glass',
  },
  {
    id: 'macos-midnight-pro',
    name: 'Studio Midnight',
    category: 'solids',
    mode: 'dark',
    accentColor: '#8e8e93',
    gradient:
      'radial-gradient(at 50% 0%, rgba(56, 189, 248, 0.15) 0px, transparent 60%), linear-gradient(135deg, #050608 0%, #0b0d13 50%, #11141c 100%)',
    description: 'Apple Studio Display matte carbon obsidian with subtle sapphire illumination',
  },
  {
    id: 'macos-space-black',
    name: 'Space Black',
    category: 'solids',
    mode: 'dark',
    accentColor: '#6366f1',
    gradient: 'linear-gradient(135deg, #020203 0%, #07080a 50%, #0d0e12 100%)',
    description: 'Pure deep stealth Space Black with micro-frosted specular borders',
  },
  {
    id: 'solid-titanium',
    name: 'Liquid Titanium',
    category: 'solids',
    mode: 'dark',
    accentColor: '#94a3b8',
    gradient: 'linear-gradient(135deg, #12141a 0%, #1f232e 50%, #2b303d 100%)',
    description: 'Industrial brushed slate titanium with silver specular sheen',
  },
];

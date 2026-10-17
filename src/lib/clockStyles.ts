// Every TIME widget face, in the order the clock cycles through them and the
// Settings → Appearance gallery lists them. Pure data (no React) so the store
// can validate saved settings against it.

export const CLOCK_STYLE_INFO = [
  { id: 'dseg7', name: 'Digital (DSEG7)', desc: '7-segment retro digital' },
  { id: 'cyberpunk', name: 'Cyberpunk 2077', desc: 'Condensed HUD, chromatic split' },
  { id: 'macos', name: 'macOS Minimal', desc: 'San Francisco, light weight' },
  { id: 'glass-pro', name: 'Glassmorphic Pro', desc: 'Frosted pane, bold numerals' },
  { id: 'neumorphic', name: 'Neumorphic', desc: 'Raised pill, lit segments' },
  { id: 'ambient-neumorphic', name: 'Ambient Neumorphic', desc: 'Soft extruded slab' },
  { id: 'dot-matrix', name: 'Dot Matrix', desc: 'LED dot grid' },
  { id: 'micro-pixel', name: 'Micro-Pixel Sleek', desc: 'Fine square pixels' },
  { id: 'holographic', name: 'Holographic', desc: 'Orbital rings, glowing digits' },
  { id: 'cyberpunk-hud', name: 'Cyberpunk HUD', desc: 'Telemetry frame' },
  { id: 'split-geometric', name: 'Split Geometric', desc: 'Heavy numerals, sliced' },
  { id: 'scifi-segmented', name: 'Sci-Fi Segmented', desc: 'Octagon frame, segments' },
  { id: 'diffused-glow', name: 'Diffused Glow', desc: 'Thin numerals, soft bloom' },
  { id: 'gradient-frost', name: 'Dynamic Gradient Frost', desc: 'Gradient digits, date' },
  { id: 'prism-glass', name: 'Prism Glass', desc: 'Iridescent glass edge' },
  { id: 'linear-outline', name: 'Linear Outline', desc: 'Stroked numerals' },
  { id: 'dev-mono', name: 'Developer Monospace', desc: 'HH:MM:SS + status line' },
  { id: 'cli-chrono', name: 'CLI Terminal (Chrono)', desc: 'Terminal window prompt' },
  { id: 'cli-sophisticated', name: 'CLI Sophisticated', desc: 'Prompt, status, cursor' },
] as const;

export type ClockStyle = (typeof CLOCK_STYLE_INFO)[number]['id'];

export const CLOCK_STYLES: readonly ClockStyle[] = CLOCK_STYLE_INFO.map((c) => c.id);

export const CLOCK_STYLE_NAMES = Object.fromEntries(CLOCK_STYLE_INFO.map((c) => [c.id, c.name])) as Record<ClockStyle, string>;
export const CLOCK_STYLE_DESC = Object.fromEntries(CLOCK_STYLE_INFO.map((c) => [c.id, c.desc])) as Record<ClockStyle, string>;

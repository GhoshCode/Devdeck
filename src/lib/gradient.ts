import type { GradientStudio, ThemeMode } from '../types';

// Appearance → Gradient Studio: turns a studio design into CSS and decides
// whether the result reads as a light or a dark backdrop.

export const DEFAULT_STUDIO: GradientStudio = {
  type: 'linear',
  angle: 135,
  position: '50% 50%',
  stops: [
    { color: '#0b0713', at: 0 },
    { color: '#3b0764', at: 50 },
    { color: '#f59e0b', at: 100 },
  ],
};

export const STUDIO_PALETTES: ReadonlyArray<{ name: string; studio: GradientStudio }> = [
  { name: 'Twilight Dusk', studio: DEFAULT_STUDIO },
  {
    name: 'Ocean Reef',
    studio: { ...DEFAULT_STUDIO, angle: 120, stops: stops('#020b17', '#0284c7', '#38bdf8') },
  },
  {
    name: 'Alpine Pine',
    studio: { ...DEFAULT_STUDIO, angle: 140, stops: stops('#02140e', '#059669', '#34d399') },
  },
  {
    name: 'Cyber Neon',
    studio: { ...DEFAULT_STUDIO, stops: stops('#090214', '#c026d3', '#00f0ff') },
  },
  {
    name: 'Peach Sorbet',
    studio: { ...DEFAULT_STUDIO, stops: stops('#fff7ed', '#fed7aa', '#f472b6') },
  },
  {
    name: 'Nordic Fog',
    studio: { ...DEFAULT_STUDIO, stops: stops('#f8fafc', '#cbd5e1', '#64748b') },
  },
  {
    name: 'Radial Amethyst',
    studio: { ...DEFAULT_STUDIO, type: 'radial', stops: stops('#a855f7', '#220538', '#090114') },
  },
  {
    name: 'Gold Velvet',
    studio: { ...DEFAULT_STUDIO, angle: 90, stops: stops('#1c1917', '#78350f', '#f59e0b') },
  },
  {
    name: 'Aurora Sweep',
    studio: { ...DEFAULT_STUDIO, type: 'conic', angle: 200, stops: stops('#04141d', '#10b981', '#6366f1', '#04141d') },
  },
  {
    name: 'Morning Mist',
    studio: { ...DEFAULT_STUDIO, angle: 160, stops: stops('#eef2ff', '#fdf2f8', '#ecfeff') },
  },
];

function stops(...colors: string[]) {
  return colors.map((color, i) => ({ color, at: Math.round((i / (colors.length - 1)) * 100) }));
}

export function gradientCss(g: GradientStudio): string {
  const list = [...g.stops]
    .sort((a, b) => a.at - b.at)
    .map((s) => `${s.color} ${s.at}%`)
    .join(', ');
  if (g.type === 'radial') return `radial-gradient(circle at ${g.position}, ${list})`;
  if (g.type === 'conic') return `conic-gradient(from ${g.angle}deg at ${g.position}, ${list})`;
  return `linear-gradient(${g.angle}deg, ${list})`;
}

const luminance = (hex: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
};

// The mode whose text colours read best on this gradient (average luminance).
export function modeForGradient(g: GradientStudio): ThemeMode {
  const avg = g.stops.reduce((sum, s) => sum + luminance(s.color), 0) / g.stops.length;
  return avg > 0.4 ? 'light' : 'dark';
}

// The most saturated stop — a natural accent for the gradient.
export function accentFromGradient(g: GradientStudio): string {
  const sat = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255;
    const gr = (n >> 8) & 255;
    const b = n & 255;
    const max = Math.max(r, gr, b);
    const min = Math.min(r, gr, b);
    return max === 0 ? 0 : ((max - min) / max) * (max / 255);
  };
  return [...g.stops].sort((a, b) => sat(b.color) - sat(a.color))[0].color;
}

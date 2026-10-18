// Colours for new categories: the first palette colour no category uses yet,
// so a new heading never repeats an existing one. When the palette runs out,
// a golden-angle hue far from every colour in use.

export const CATEGORY_PALETTE = [
  '#38bdf8', '#34d399', '#f59e0b', '#818cf8', '#c084fc', '#f472b6', '#22d3ee', '#f87171',
  '#a3e635', '#2dd4bf', '#fb923c', '#e879f9', '#facc15', '#60a5fa', '#fb7185', '#4ade80',
  '#a78bfa', '#14b8a6', '#eab308', '#0ea5e9',
];

const hexToHue = (hex: string): number | null => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return null;
  const d = max - min;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};

const hslToHex = (h: number, s: number, l: number) => {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))))
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

export function nextFreeColor(used: readonly string[]): string {
  const taken = new Set(used.map((c) => c.toLowerCase()));
  const free = CATEGORY_PALETTE.find((c) => !taken.has(c));
  if (free) return free;
  const hues = used.map(hexToHue).filter((h): h is number => h !== null);
  let best = 0;
  let bestGap = -1;
  for (let i = 0; i < 36; i++) {
    const h = (i * 137.508) % 360;
    const gap = Math.min(...hues.map((u) => Math.min(Math.abs(u - h), 360 - Math.abs(u - h))), 360);
    if (gap > bestGap) {
      bestGap = gap;
      best = h;
    }
  }
  return hslToHex(best, 0.75, 0.62);
}

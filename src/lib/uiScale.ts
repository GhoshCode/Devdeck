// Interface size. Chrome already applies the system's display scaling; this
// adds DevDeck's own fit on top: Auto keeps 100 % on ordinary desktop widths,
// shrinks a little on small laptop screens and grows on very wide ones. A
// manual size (Settings → Appearance) overrides it. Phones and tablets keep 100 %.

export const UI_SCALE_MIN = 0.8;
export const UI_SCALE_MAX = 1.25;

const round = (n: number) => Math.round(n * 20) / 20; // 5 % steps

export function autoScale(width: number): number {
  if (width < 1024) return 1;
  if (width < 1440) return Math.max(UI_SCALE_MIN, round(width / 1440));
  if (width > 2200) return Math.min(UI_SCALE_MAX, round(width / 2200));
  return 1;
}

export const clampScale = (n: number) => Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, round(n)));

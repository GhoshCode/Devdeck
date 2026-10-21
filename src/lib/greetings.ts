// The greeting's first phrase: themed by time of day, 5–8 per segment.
//   09:00–15:00 office · 15:00–20:00 casual-pro · 20:00–02:00 geek ·
//   02:00–09:00 night crawler (cyberpunk). Click the greeting to re-roll.

export type GreetSegment = 'office' | 'afternoon' | 'geek' | 'night';

export const GREETINGS: Record<GreetSegment, readonly string[]> = {
  office: ['STANDUP SURVIVED', 'INBOX ZERO, IN THEORY', 'SHIPPING SEASON', 'SYNERGY LOADING', 'CIRCLING BACK', 'CALENDAR TETRIS CHAMP', 'COFFEE-DRIVEN DEVELOPMENT', 'DEPLOY WITH CONFIDENCE'],
  afternoon: ['AFTERNOON MOMENTUM', 'GOLDEN HOUR COMMITS', 'ONE MORE PR', 'WRAPPING UP STRONG', 'TEA, THEN TESTS', 'SHIP IT BY SUNSET', 'CLEAN DIFFS, CALM MIND'],
  geek: ['LATE-NIGHT HACKING', 'GEEK MODE: ON', 'IT COMPILES — SHIP IT', 'SUDO MAKE ME A SANDWICH', 'HELLO, WORLD — AGAIN', 'DEBUGGING IN THE DARK', 'RUBBER DUCK ON DUTY', 'PUSH --FORCE OF HABIT'],
  night: ['NIGHT CRAWLER ONLINE', 'JACKED INTO THE MAINFRAME', 'ROOT ACCESS GRANTED', 'NEON CODE, NO SLEEP', 'GHOST IN THE SHELL', 'BREACHING THE FIREWALL', 'SYSTEM OVERRIDE ENGAGED', 'WAKE UP, NETRUNNER'],
};

export function segmentOf(d: Date): GreetSegment {
  const h = d.getHours();
  if (h >= 9 && h < 15) return 'office';
  if (h >= 15 && h < 20) return 'afternoon';
  if (h >= 20 || h < 2) return 'geek';
  return 'night';
}

// The phrase for a segment and a roll number (any integer; wraps around).
export const greetingPhrase = (seg: GreetSegment, roll: number) => {
  const list = GREETINGS[seg];
  return list[((roll % list.length) + list.length) % list.length];
};

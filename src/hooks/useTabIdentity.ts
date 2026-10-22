import { useEffect } from 'react';

// The browser tab: an icon drawn in the accent colour (a ">_" prompt), and a
// title that types short shell commands like a terminal — "❯ npm run dev▌" —
// then clears and types the next. Static ("DevDeck ❯▌") when the system asks
// for reduced motion or the option is off.

const COMMANDS = ['git pull', 'npm run dev', 'ls -la', 'git push', 'make test', 'docker ps', 'htop', 'npm i', 'git log', 'cargo run'];
const STATIC_TITLE = 'DevDeck ❯▌';
const TYPE_MS = 110;
const HOLD_MS = 2200;

function drawIcon(accent: string): string {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (!g) return '';
  g.fillStyle = accent;
  g.beginPath();
  g.roundRect(4, 4, 56, 56, 14);
  g.fill();
  g.fillStyle = 'rgba(0, 0, 0, 0.28)';
  g.beginPath();
  g.roundRect(4, 34, 56, 26, [0, 0, 14, 14]);
  g.fill();
  g.fillStyle = '#ffffff';
  g.font = 'bold 30px ui-monospace, Consolas, monospace';
  g.textBaseline = 'middle';
  g.fillText('>_', 11, 33);
  return c.toDataURL('image/png');
}

export function useTabIdentity(accent: string, animate: boolean) {
  useEffect(() => {
    if (!accent) return;
    let link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    const url = drawIcon(accent);
    if (url) link.href = url;
  }, [accent]);

  useEffect(() => {
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!animate || still) {
      document.title = STATIC_TITLE;
      return;
    }
    let cmd = 0;
    let shown = 0;
    let phase: 'type' | 'hold' | 'clear' = 'type';
    let timer = 0;
    const step = () => {
      const text = COMMANDS[cmd];
      if (phase === 'type') {
        shown += 1;
        document.title = `❯ ${text.slice(0, shown)}▌`;
        if (shown >= text.length) phase = 'hold';
        timer = window.setTimeout(step, phase === 'hold' ? HOLD_MS : TYPE_MS);
      } else if (phase === 'hold') {
        phase = 'clear';
        document.title = STATIC_TITLE;
        timer = window.setTimeout(step, 900);
      } else {
        cmd = (cmd + 1) % COMMANDS.length;
        shown = 0;
        phase = 'type';
        timer = window.setTimeout(step, TYPE_MS);
      }
    };
    step();
    return () => {
      window.clearTimeout(timer);
      document.title = 'DevDeck';
    };
  }, [animate]);
}

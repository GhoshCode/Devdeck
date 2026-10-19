// The top alert panel drawn on OTHER websites (injected by the service worker
// with chrome.scripting). It must be completely self-contained: Chrome copies
// this function's source into the page, so it can't use imports or anything
// outside its own body. It renders the same designs as the in-page
// AlertCenter (including the calendar capsule), inside a shadow root so the
// site's CSS can't touch it.

import type { AlertData } from './alertEvents';

export type OverlayTheme = { accent: string; light: boolean };

export function renderAlertOverlay(alert: AlertData, theme: OverlayTheme): void {
  const HOST_ID = 'devdeck-alert-host';
  type W = Window & { __devdeckAlerts?: { add: (a: AlertData) => void } };
  const w = window as W;
  if (w.__devdeckAlerts) {
    w.__devdeckAlerts.add(alert);
    return;
  }

  const A = theme.accent || '#ec4899';
  const L = !!theme.light;
  const bg = L ? `color-mix(in srgb, ${A} 6%, #ffffff)` : `color-mix(in srgb, ${A} 16%, #14131b)`;
  const css = `
    :host { all: initial; }
    .stack { position: fixed; top: 12px; left: 50%; transform: translateX(-50%); z-index: 2147483647;
      display: flex; flex-direction: column; align-items: center; gap: 10px; width: max-content; max-width: 94vw;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; pointer-events: none; }
    .card { pointer-events: auto; box-sizing: border-box; background: ${bg}; color: ${L ? '#0f172a' : '#f8fafc'};
      border: 1px solid color-mix(in srgb, ${A} ${L ? 50 : 55}%, ${L ? '#cbd5e1' : '#2a2836'}); border-radius: 10px;
      box-shadow: 0 14px 34px -14px rgba(0,0,0,${L ? 0.35 : 0.7}), 0 2px 6px rgba(0,0,0,${L ? 0.1 : 0.35});
      animation: drop .55s cubic-bezier(.2,1.25,.35,1) both; }
    .card.out { animation: lift .2s ease-in both; }
    @keyframes drop { from { transform: translateY(-140px); opacity: 0; } to { transform: none; opacity: 1; } }
    @keyframes lift { to { transform: translateY(-50px); opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { .card, .card.out { animation: none; } }
    .row { display: flex; align-items: center; gap: 14px; }
    .title { font-size: 17px; font-weight: 600; line-height: 1.3; color: ${L ? '#0f172a' : '#f8fafc'}; margin: 4px 0 0; }
    .sub { font-size: 13.5px; font-weight: 500; color: ${L ? '#334155' : '#cbd5e1'}; margin: 2px 0 0; }
    .eye { font: 700 11.5px/1.2 ui-monospace, "JetBrains Mono", monospace; letter-spacing: .12em;
      color: color-mix(in srgb, ${A} ${L ? 75 : 60}%, ${L ? '#000' : '#fff'}); margin: 0; }
    .trunc { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .btn { all: unset; cursor: pointer; font-size: 13.5px; font-weight: 600; padding: 6px 14px; border-radius: 6px; white-space: nowrap;
      color: ${L ? '#0f172a' : '#f1f5f9'}; background: ${L ? '#f1f5f9' : '#2a2836'}; border: 1px solid ${L ? '#cbd5e1' : '#3b3948'}; }
    .btn:hover { background: ${L ? '#e2e8f0' : '#353344'}; }
    .btn.pri { color: #fff; background: ${A}; border-color: ${A}; }
    .btn.pri:hover { filter: brightness(1.08); }
    .x { all: unset; cursor: pointer; width: 32px; height: 32px; display: grid; place-items: center; border-radius: 6px; color: ${L ? '#475569' : '#cbd5e1'}; flex: none; }
    .x:hover { background: ${L ? '#f1f5f9' : '#2a2836'}; }
    .ico { width: 48px; height: 48px; border-radius: 8px; display: grid; place-items: center; flex: none;
      background: ${L ? '#f8fafc' : '#1f1d29'}; box-shadow: 0 0 0 2px ${A}; }
    .ico img { width: 28px; height: 28px; border-radius: 6px; }
    .spot { width: min(680px, 94vw); padding: 14px 16px; }
    .pill { max-width: min(700px, 94vw); padding: 8px 8px 8px 12px; font-size: 15px; }
    .pill img { width: 24px; height: 24px; border-radius: 6px; flex: none; }
    .todo { position: relative; width: min(540px, 94vw); padding: 14px 12px 14px 20px; display: flex; gap: 14px; align-items: flex-start; overflow: hidden; }
    .todo::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--stripe, ${A}); }
    .check { all: unset; cursor: pointer; width: 20px; height: 20px; border-radius: 50%; border: 2px solid ${L ? '#64748b' : '#94a3b8'}; flex: none; margin-top: 2px; }
    .check:hover { border-color: ${A}; background: ${A}; }
    .acts { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
    .sum { width: min(560px, 94vw); padding: 16px; }
    .badge { width: 40px; height: 40px; border-radius: 8px; display: grid; place-items: center; flex: none; color: ${L ? '#b45309' : '#fbbf24'}; background: ${L ? '#fef3c7' : '#3a2e12'}; }
    .counts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 12px; }
    .cnt { border-radius: 6px; padding: 8px 12px; background: ${L ? '#f8fafc' : '#1f1d29'}; border: 1px solid ${L ? '#e2e8f0' : '#2f2d3b'}; }
    .cnt b { display: block; font: 700 21px/1.2 ui-monospace, monospace; }
    .more { pointer-events: auto; all: unset; cursor: pointer; pointer-events: auto; font-size: 13px; font-weight: 600; padding: 6px 16px; border-radius: 6px;
      background: ${bg}; color: ${L ? '#0f172a' : '#f1f5f9'}; border: 1px solid color-mix(in srgb, ${A} 50%, transparent); }
    .brand { font: 600 10.5px/1 ui-monospace, monospace; letter-spacing: .14em; opacity: .55; margin-left: auto; }
    .cal { border-radius: 999px; padding: 1.5px; border: 0; background: conic-gradient(from var(--a, 0deg), var(--cat), transparent 35%, var(--cat) 70%, transparent);
      box-shadow: 0 0 22px -4px var(--cat), 0 14px 34px -14px rgba(0,0,0,${L ? 0.35 : 0.7}); }
    .cal-in { display: flex; align-items: center; gap: 12px; border-radius: 999px; padding: 6px; max-width: min(760px, 94vw);
      background: ${L ? 'rgba(255,255,255,.92)' : 'rgba(14,13,20,.9)'}; backdrop-filter: blur(18px); }
    .cal-ico { width: 44px; height: 44px; border-radius: 999px; display: grid; place-items: center; flex: none; color: var(--cat);
      background: color-mix(in srgb, var(--cat) 18%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--cat) 55%, transparent); }
    .cal-ico svg { animation: ring 2.4s ease-in-out infinite; transform-origin: 50% 10%; }
    @keyframes ring { 0%, 70%, 100% { transform: none; } 75% { transform: rotate(14deg); } 80% { transform: rotate(-12deg); } 85% { transform: rotate(8deg); } 90% { transform: rotate(-4deg); } }
    .cal-eye { display: flex; align-items: center; gap: 8px; font: 700 10.5px/1.2 ui-monospace, monospace; letter-spacing: .14em; color: var(--cat); margin: 0; }
    .cal-when { padding: 1px 8px; border-radius: 999px; font-variant-numeric: tabular-nums; color: ${L ? '#0f172a' : '#fff'}; background: color-mix(in srgb, var(--cat) 30%, transparent); }
    .cal .title { font-size: 15px; margin: 1px 0 0; }
    .cal .sub { font-size: 12px; margin: 0; font-variant-numeric: tabular-nums; }
    .pb { all: unset; cursor: pointer; font-size: 12.5px; font-weight: 600; padding: 6px 12px; border-radius: 999px; white-space: nowrap;
      color: ${L ? '#0f172a' : '#f1f5f9'}; background: ${L ? 'rgba(15,23,42,.06)' : 'rgba(255,255,255,.08)'}; }
    .pb:hover { background: ${L ? 'rgba(15,23,42,.12)' : 'rgba(255,255,255,.16)'}; }
    .pb.pri { color: #fff; background: var(--cat); }
    @media (prefers-reduced-motion: reduce) { .cal-ico svg { animation: none; } }
  `;

  const host = document.createElement('div');
  host.id = HOST_ID;
  const root = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = css;
  const stack = document.createElement('div');
  stack.className = 'stack';
  root.append(style, stack);
  (document.body ?? document.documentElement).appendChild(host);

  const list: AlertData[] = [];
  let expanded = false;

  const send = (action: string, a: AlertData) => {
    try {
      (globalThis as { chrome?: { runtime?: { sendMessage: (m: unknown) => void } } }).chrome?.runtime?.sendMessage({ type: 'devdeck:overlay-action', action, alert: a });
    } catch {
      // the extension was reloaded — nothing to tell
    }
  };
  const el = (tag: string, cls?: string, text?: string) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const favicon = (url?: string) => {
    const img = document.createElement('img');
    try {
      const rt = (globalThis as { chrome?: { runtime?: { getURL?: (p: string) => string } } }).chrome?.runtime;
      img.src = rt?.getURL ? `${rt.getURL('/_favicon/')}?pageUrl=${encodeURIComponent(url ?? '')}&size=64` : `https://www.google.com/s2/favicons?domain=${new URL(url ?? '').hostname}&sz=64`;
    } catch {
      img.style.display = 'none';
    }
    img.alt = '';
    img.onerror = () => (img.style.visibility = 'hidden');
    return img;
  };
  const xIcon = () => {
    const b = el('button', 'x') as HTMLButtonElement;
    b.setAttribute('aria-label', 'Dismiss');
    b.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';
    return b;
  };

  const remove = (a: AlertData, card?: HTMLElement) => {
    const i = list.findIndex((x) => x.key === a.key);
    if (i >= 0) list.splice(i, 1);
    if (card) {
      card.style.animation = '';
      card.classList.add('out');
      setTimeout(render, 190);
    } else render();
    if (!list.length)
      setTimeout(() => {
        if (list.length) return;
        host.remove();
        w.__devdeckAlerts = undefined;
      }, 260);
  };

  const card = (a: AlertData): HTMLElement => {
    const btn = (label: string, action: string, pri = false) => {
      const b = el('button', pri ? 'btn pri' : 'btn', label) as HTMLButtonElement;
      b.onclick = () => {
        send(action, a);
        remove(a, c);
      };
      return b;
    };
    let c: HTMLElement;
    const x = xIcon();
    if (a.kind === 'calendar') {
      const COLORS: Record<string, string> = { meeting: A, call: '#6366f1', vip: '#eab308', 'deep-work': '#94a3b8', deadline: '#f43f5e', travel: '#f97316' };
      c = el('div', 'card cal');
      c.style.setProperty('--cat', COLORS[a.category ?? 'meeting'] ?? A);
      const inner = el('div', 'cal-in');
      const ico = el('span', 'cal-ico');
      ico.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';
      const t = el('div');
      t.style.cssText = 'flex:1;min-width:0';
      const eye = el('p', 'cal-eye');
      const when = el('span', 'cal-when');
      eye.append(el('span', 'trunc', a.eyebrow ?? 'CALENDAR'), when);
      const tick = () => {
        const now = Date.now();
        const s = a.startsAt ?? now;
        const e = a.endsAt ?? now;
        const mins = Math.ceil((s - now) / 60000);
        when.textContent = now < s ? `Starts in ${mins >= 60 ? `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ''}` : `${mins}m`}` : now < e ? 'Now' : 'Ended';
        if (!c.isConnected && c.dataset.mounted) clearInterval(iv);
      };
      const iv = setInterval(tick, 1000);
      tick();
      c.dataset.mounted = '1';
      t.append(eye, el('p', 'title trunc', a.title), ...(a.sub ? [el('p', 'sub trunc', a.sub)] : []));
      const pill = (label: string, action: string, pri = false) => {
        const b = el('button', pri ? 'pb pri' : 'pb', label) as HTMLButtonElement;
        b.onclick = () => {
          clearInterval(iv);
          if (action !== 'ack') send(action, a);
          remove(a, c);
        };
        return b;
      };
      inner.append(ico, t, pill('Acknowledge', 'ack', true), pill('Snooze 5m', 'snooze'), pill('Jump to slot', 'open'));
      c.append(inner);
    } else if (a.kind === 'queue') {
      c = el('div', 'card pill row');
      const text = el('div', 'trunc');
      text.style.minWidth = '0';
      const lead = el('b', '', 'Up next: ');
      text.append(lead, document.createTextNode(a.title));
      if (a.sub) text.append(el('span', 'sub', ` · ${a.sub}`));
      c.append(favicon(a.url), text, btn('Open', 'open', true), btn('Snooze 10m', 'snooze'), x);
    } else if (a.kind === 'todo') {
      c = el('div', 'card todo');
      const stripe = a.priority === 1 ? '#ef4444' : a.priority === 2 ? '#f59e0b' : a.priority === 3 ? '#3b82f6' : '';
      if (stripe) c.style.setProperty('--stripe', stripe);
      const check = el('button', 'check') as HTMLButtonElement;
      check.title = 'Mark done';
      check.onclick = () => {
        send('done', a);
        remove(a, c);
      };
      const body = el('div');
      body.style.cssText = 'flex:1;min-width:0';
      const acts = el('div', 'acts');
      acts.append(btn('Mark done', 'done', true), btn('Open', 'open'), btn('Snooze 10m', 'snooze'));
      body.append(el('p', 'eye', a.eyebrow ?? 'TO-DO DUE'), el('p', 'title', a.title), ...(a.sub ? [el('p', 'sub trunc', a.sub)] : []), acts);
      c.append(check, body, x);
    } else if (a.kind === 'overdue') {
      c = el('div', 'card sum');
      const top = el('div', 'row');
      const badge = el('span', 'badge');
      badge.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M5 3 2 6M22 6l-3-3"/></svg>';
      const t = el('div');
      t.style.cssText = 'flex:1;min-width:0';
      t.append(el('p', 'title', `You have ${a.title} items`), ...(a.list?.length ? [el('p', 'sub trunc', a.list.join(' · '))] : []));
      top.append(badge, t, btn('Review', 'open', true), x);
      const counts = el('div', 'counts');
      const ct = a.counts ?? { todos: 0, queue: 0, processing: 0 };
      for (const [label, n] of [['To-dos', ct.todos], ['Queue', ct.queue], ['Currently processing', ct.processing]] as const) {
        const cell = el('div', 'cnt');
        cell.append(el('span', 'sub', label), el('b', '', String(n)));
        counts.append(cell);
      }
      c.append(top, counts);
    } else {
      c = el('div', 'card spot row');
      const ico = el('span', 'ico');
      ico.append(favicon(a.url));
      const t = el('div');
      t.style.cssText = 'flex:1;min-width:0';
      t.append(el('p', 'eye', a.eyebrow ?? 'CURRENTLY PROCESSING · NOW'), el('p', 'title trunc', `Time to work on ${a.title}`), ...(a.sub ? [el('p', 'sub trunc', a.sub)] : []));
      c.append(ico, t, btn('Open', 'open', true), btn('Snooze 10m', 'snooze'), x);
    }
    x.onclick = () => remove(a, c);
    if (a.kind === 'calendar') {
      // stays until acknowledged, snoozed or opened
      c.setAttribute('role', 'alert');
      c.addEventListener('animationend', () => {
        if (!c.classList.contains('out')) c.style.animation = 'none';
      });
      return c;
    }

    c.setAttribute('role', 'alert');
    // drop in once; re-ordering the stack later must not replay it
    c.addEventListener('animationend', () => {
      if (!c.classList.contains('out')) c.style.animation = 'none';
    });
    // auto-hide, paused while hovered
    let left = a.kind === 'overdue' ? 20000 : 12000;
    let started = Date.now();
    let timer = setTimeout(() => remove(a, c), left);
    c.onmouseenter = () => {
      clearTimeout(timer);
      left -= Date.now() - started;
    };
    c.onmouseleave = () => {
      started = Date.now();
      timer = setTimeout(() => remove(a, c), Math.max(1500, left));
    };
    return c;
  };

  const cards = new Map<string, HTMLElement>();
  function render() {
    const shown = expanded ? list : list.slice(0, 3);
    for (const [k, n] of cards) if (!shown.some((a) => a.key === k)) {
      n.remove();
      cards.delete(k);
    }
    stack.textContent = '';
    for (const a of shown) {
      let n = cards.get(a.key);
      if (!n) {
        n = card(a);
        cards.set(a.key, n);
      }
      stack.append(n);
    }
    const hidden = list.length - shown.length;
    if (hidden > 0) {
      const more = el('button', 'more', `+${hidden} more reminder${hidden === 1 ? '' : 's'}`) as HTMLButtonElement;
      more.onclick = () => {
        expanded = true;
        render();
      };
      stack.append(more);
    }
  }

  w.__devdeckAlerts = {
    add(a: AlertData) {
      if (list.some((x) => x.key === a.key)) return;
      list.unshift(a);
      render();
    },
  };
  w.__devdeckAlerts.add(alert);
}

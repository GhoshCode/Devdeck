import { afterEach, describe, expect, it } from 'vitest';
import { renderAlertOverlay } from './alertOverlay';
import type { AlertData } from './alertEvents';

const theme = { accent: '#14b8a6', light: false };
const rem = (id: string, n: number, kind: 'processing' | 'queue' = 'queue'): AlertData => ({ key: `${kind}:${id}:${n}`, kind, title: id, itemId: id });
const shadow = () => document.getElementById('devdeck-alert-host')!.shadowRoot!;
const text = () => shadow().textContent ?? '';

describe('alert overlay on other websites', () => {
  afterEach(() => {
    document.getElementById('devdeck-alert-host')?.remove();
    (window as { __devdeckAlerts?: unknown }).__devdeckAlerts = undefined;
  });

  it('counts a repeating site on its card (×N) instead of stacking cards', () => {
    renderAlertOverlay(rem('Kotlin', 1), theme);
    renderAlertOverlay(rem('Kotlin', 2), theme);
    renderAlertOverlay(rem('Kotlin', 3), theme);
    expect(shadow().querySelectorAll('[role="alert"]')).toHaveLength(1);
    expect(text()).toContain('Kotlin  ×3');
  });

  it('groups three or more reminders into one card, with Clear all on top', () => {
    for (const id of ['Kotlin', 'Grafana', 'Bitbucket']) renderAlertOverlay(rem(id, 1), theme);
    expect(text()).toContain('3 reminders now');
    expect(shadow().querySelectorAll('[role="alert"]')).toHaveLength(1);
    const stack = shadow().querySelector('.stack')!;
    expect(stack.firstElementChild!.className).toBe('clear'); // Clear all comes first
    expect(text()).toContain('Clear all (3)');
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { _resetAlerts, dismissAlerts, getAlerts, pushAlert, stackItems, type AlertData } from './alertStore';

const rem = (id: string, at: number, kind: 'processing' | 'queue' = 'processing'): AlertData => ({
  key: `${kind}:${id}:${at}`,
  kind,
  title: id,
  itemId: id,
});

describe('alert floods', () => {
  beforeEach(() => {
    localStorage.clear();
    _resetAlerts();
  });

  it('a site firing again while its card is up updates that card (×N), not a new one', () => {
    expect(pushAlert(rem('kotlin', 1))).toBe(true);
    expect(pushAlert(rem('kotlin', 2))).toBe(true);
    expect(pushAlert(rem('kotlin', 3))).toBe(true);
    expect(getAlerts()).toHaveLength(1);
    expect(getAlerts()[0].repeat).toBe(3);
    // another site is its own card
    pushAlert(rem('grafana', 3, 'queue'));
    expect(getAlerts()).toHaveLength(2);
  });

  it('three or more reminders up at once become one group; other alerts stay their own', () => {
    pushAlert({ key: 'todo:1', kind: 'todo', title: 'Ship' });
    pushAlert(rem('a', 1));
    pushAlert(rem('b', 1, 'queue'));
    expect(stackItems(getAlerts()).every((i) => i.type === 'one')).toBe(true); // two reminders: no group yet
    pushAlert(rem('c', 1));
    const items = stackItems(getAlerts());
    expect(items).toHaveLength(2);
    const group = items.find((i) => i.type === 'group');
    expect(group && group.type === 'group' && group.members.map((m) => m.title).sort()).toEqual(['a', 'b', 'c']);
    expect(items.some((i) => i.type === 'one' && i.a.kind === 'todo')).toBe(true);
  });

  it('dismisses a whole group at once', () => {
    for (const id of ['a', 'b', 'c']) pushAlert(rem(id, 1));
    dismissAlerts(getAlerts().map((a) => a.key));
    expect(getAlerts()).toHaveLength(0);
  });
});

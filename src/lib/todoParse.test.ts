import { describe, expect, test } from 'vitest';
import { parseQuickAdd } from './todoParse';

const NOW = new Date(2026, 9, 17, 10, 30); // Sat Oct 17 2026, 10:30

describe('parseQuickAdd', () => {
  test('priority, tags, date and time in one line', () => {
    expect(parseQuickAdd('Ship release notes #launch #Docs !p1 tomorrow 5pm', NOW)).toMatchObject({
      text: 'Ship release notes',
      tags: ['launch', 'docs'],
      priority: 1,
      dueDate: '2026-10-18',
      dueTime: '17:00',
    });
  });

  test('numeric hashes stay in the text', () => {
    expect(parseQuickAdd('Review PR #42', NOW)).toMatchObject({ text: 'Review PR #42', tags: [] });
  });

  test.each([
    ['Pay rent today', '2026-10-17', null],
    ['Call mom tonight', '2026-10-17', '21:00'],
    ['Standup monday 9:30am', '2026-10-19', '09:30'],
    ['Plan sprint next week', '2026-10-19', null],
    ['Hike this weekend', '2026-10-17', null],
    ['Renew domain in 3 days', '2026-10-20', null],
    ['Deploy in 2h', '2026-10-17', '12:30'],
    ['Taxes 2026-11-01', '2026-11-01', null],
    ['Demo Oct 20 at 14:00', '2026-10-20', '14:00'],
    ['Birthday 3 jan', '2027-01-03', null],
    ['Retro 24/10', '2026-10-24', null],
    ['Lunch noon', '2026-10-17', '12:00'],
    ['Wrap up eod', '2026-10-17', '18:00'],
    ['Backup 9am', '2026-10-18', '09:00'], // 9am already passed today
  ])('%s', (input, dueDate, dueTime) => {
    expect(parseQuickAdd(input, NOW)).toMatchObject({ dueDate, dueTime });
  });

  test('priority words and plain text', () => {
    expect(parseQuickAdd('Fix login !high', NOW)).toMatchObject({ text: 'Fix login', priority: 2 });
    expect(parseQuickAdd('Tidy desk p3', NOW)).toMatchObject({ text: 'Tidy desk', priority: 3 });
    expect(parseQuickAdd('Just a note', NOW)).toMatchObject({ text: 'Just a note', dueDate: null, priority: 0, matched: [] });
  });
});

import { describe, expect, it, test } from 'vitest';
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

describe('repeats', () => {
  // Sunday 18 Oct 2026, 10:00
  const sun = new Date(2026, 9, 18, 10, 0);
  it('reads daily / weekly / monthly / weekdays / every <day>', () => {
    expect(parseQuickAdd('Standup every weekday 9:30am', sun)).toMatchObject({ text: 'Standup', repeat: 'weekdays', dueDate: '2026-10-19', dueTime: '09:30' });
    expect(parseQuickAdd('Water plants daily 8pm', sun)).toMatchObject({ text: 'Water plants', repeat: 'daily', dueDate: '2026-10-18', dueTime: '20:00' });
    expect(parseQuickAdd('Backup weekly 9am', sun)).toMatchObject({ repeat: 'weekly', dueDate: '2026-10-19', dueTime: '09:00' }); // next 9am, then weekly
    expect(parseQuickAdd('Pay rent every month Nov 1', sun)).toMatchObject({ text: 'Pay rent', repeat: 'monthly', dueDate: '2026-11-01' });
    expect(parseQuickAdd('Team sync every friday 4pm', sun)).toMatchObject({ text: 'Team sync', repeat: 'weekly', dueDate: '2026-10-23', dueTime: '16:00' });
    expect(parseQuickAdd('Renew domain yearly', sun)).toMatchObject({ repeat: 'yearly', dueDate: '2026-10-18' });
    expect(parseQuickAdd('Call mum tomorrow', sun).repeat).toBeNull();
  });
});

describe('repeat phrases vs. titles', () => {
  const sun = new Date(2026, 9, 18, 10, 0);
  it('prefers "every …" and keeps a leading Daily/Weekly in the title', () => {
    expect(parseQuickAdd('Daily standup every weekday 9:30am #team', sun)).toMatchObject({ text: 'Daily standup', repeat: 'weekdays', dueDate: '2026-10-19', dueTime: '09:30' });
    expect(parseQuickAdd('Weekly report every friday 5pm', sun)).toMatchObject({ text: 'Weekly report', repeat: 'weekly', dueDate: '2026-10-23', dueTime: '17:00' });
    expect(parseQuickAdd('Daily journal', sun)).toMatchObject({ text: 'Daily journal', repeat: null });
    // early on a Sunday the 9:30 is still ahead, but a weekday task starts Monday
    expect(parseQuickAdd('Standup every weekday 9:30am', new Date(2026, 9, 18, 6, 0)).dueDate).toBe('2026-10-19');
  });
});

describe('day and month words inside titles', () => {
  const sun = new Date(2026, 9, 18, 6, 10);
  it('does not read Monthly / wedding / Friend / Marketing as dates', () => {
    expect(parseQuickAdd('Monthly newsletter every month Nov 3 #marketing', sun)).toMatchObject({ text: 'Monthly newsletter', repeat: 'monthly', dueDate: '2026-11-03' });
    expect(parseQuickAdd('Buy wedding gift', sun)).toMatchObject({ text: 'Buy wedding gift', dueDate: null });
    expect(parseQuickAdd("Friend's party", sun)).toMatchObject({ dueDate: null });
    expect(parseQuickAdd('Marketing 2 ideas', sun)).toMatchObject({ text: 'Marketing 2 ideas', dueDate: null });
    expect(parseQuickAdd('Sunset photos', sun).dueDate).toBeNull();
  });
  it('still reads full and short day / month names', () => {
    expect(parseQuickAdd('Ship it wednesday', sun).dueDate).toBe('2026-10-21');
    expect(parseQuickAdd('Ship it thurs', sun).dueDate).toBe('2026-10-22');
    expect(parseQuickAdd('Ship it March 5', sun).dueDate).toBe('2027-03-05');
    expect(parseQuickAdd('Ship it 5 sept', sun).dueDate).toBe('2027-09-05');
    expect(parseQuickAdd('Ship it Oct. 20', sun).dueDate).toBe('2026-10-20');
  });
});

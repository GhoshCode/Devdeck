// Greeting card content: the part of the day, a friendly line that fits the
// moment, and a daily motivational quote. Everything is deterministic for a
// given day and part of the day, so the card never flickers between renders.

export type DayPart = 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night' | 'late';

export interface DayPartInfo {
  part: DayPart;
  hello: string; // "Good morning"
  emoji: string;
}

export function dayPart(d: Date): DayPartInfo {
  const h = d.getHours();
  if (h >= 5 && h < 8) return { part: 'dawn', hello: 'Good morning', emoji: '🌅' };
  if (h >= 8 && h < 12) return { part: 'morning', hello: 'Good morning', emoji: '☀️' };
  if (h >= 12 && h < 17) return { part: 'afternoon', hello: 'Good afternoon', emoji: '🌤️' };
  if (h >= 17 && h < 21) return { part: 'evening', hello: 'Good evening', emoji: '🌆' };
  if (h >= 21) return { part: 'night', hello: 'Good night', emoji: '🌙' };
  return { part: 'late', hello: 'Hello, night owl', emoji: '🦉' };
}

const LINES: Record<DayPart, string[]> = {
  dawn: ['Early bird gets the cleanest commits 🐦', 'The quiet hours are the best hours ✨', 'Up before the bugs — nice ☕'],
  morning: [
    "Coffee's ready, and so is your deck ☕",
    "Let's make today count ✨",
    'Small steps, big ships 🚢',
    'A fresh day, a fresh branch 🌱',
  ],
  afternoon: [
    'Keep the momentum going 🚀',
    'A short walk can fix a long bug 🚶',
    "You're doing great — keep shipping 💪",
    'Hydrate, then iterate 💧',
  ],
  evening: [
    'Wrap up, ship it, unwind 🌇',
    'Great work today — almost there 🌟',
    'Time to commit and call it a day ✅',
  ],
  night: [
    "Wind down — tomorrow's bugs can wait 🌙",
    'Rest well, you earned it 😴',
    'Leave a note for tomorrow-you 📝',
  ],
  late: ['Burning the midnight oil? Remember to rest 💤', 'The best ideas come at 2 a.m. — the best fixes after sleep 🛌'],
};

// Day-specific lines win on their day (0 = Sunday).
const WEEKDAY: Partial<Record<number, string>> = {
  1: "Fresh week, fresh start — you've got this 💪",
  5: 'Happy Friday! The weekend is almost here 🎉',
  6: 'Weekend mode — build something just for fun 🎨',
  0: 'Slow Sunday — recharge for the week ahead ☕',
};

const dayIndex = (d: Date) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);

export function friendlyLine(d: Date): string {
  const { part } = dayPart(d);
  const special = WEEKDAY[d.getDay()];
  if (special && (part === 'morning' || part === 'dawn' || part === 'afternoon')) return special;
  const pool = LINES[part];
  return pool[dayIndex(d) % pool.length];
}

export interface Quote {
  text: string;
  author: string;
}

export const QUOTES: readonly Quote[] = [
  { text: 'The secret of getting ahead is getting started.', author: 'Mark Twain' },
  { text: 'It always seems impossible until it’s done.', author: 'Nelson Mandela' },
  { text: 'Simplicity is the soul of efficiency.', author: 'Austin Freeman' },
  { text: 'First, solve the problem. Then, write the code.', author: 'John Johnson' },
  { text: 'Make it work, make it right, make it fast.', author: 'Kent Beck' },
  { text: 'Well done is better than well said.', author: 'Benjamin Franklin' },
  { text: 'Quality is not an act, it is a habit.', author: 'Aristotle' },
  { text: 'Done is better than perfect.', author: 'Sheryl Sandberg' },
  { text: 'Talk is cheap. Show me the code.', author: 'Linus Torvalds' },
  { text: 'The best way to predict the future is to invent it.', author: 'Alan Kay' },
  { text: 'Stay hungry, stay foolish.', author: 'Steve Jobs' },
  { text: 'Every expert was once a beginner.', author: 'Helen Hayes' },
  { text: 'Action is the foundational key to all success.', author: 'Pablo Picasso' },
  { text: 'Dream big. Start small. Act now.', author: 'Robin Sharma' },
  { text: 'Programs must be written for people to read.', author: 'Harold Abelson' },
  { text: 'You don’t have to be great to start, but you have to start to be great.', author: 'Zig Ziglar' },
  { text: 'Believe you can and you’re halfway there.', author: 'Theodore Roosevelt' },
  { text: 'Great things are done by a series of small things brought together.', author: 'Vincent van Gogh' },
  { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
  { text: 'Focus on being productive instead of busy.', author: 'Tim Ferriss' },
  { text: 'Code is like humor. When you have to explain it, it’s bad.', author: 'Cory House' },
  { text: 'Fall seven times, stand up eight.', author: 'Japanese proverb' },
  { text: 'What we fear doing most is usually what we most need to do.', author: 'Tim Ferriss' },
  { text: 'Success is the sum of small efforts, repeated day in and day out.', author: 'Robert Collier' },
  { text: 'Creativity is intelligence having fun.', author: 'Albert Einstein' },
  { text: 'In the middle of difficulty lies opportunity.', author: 'Albert Einstein' },
  { text: 'Your limitation — it’s only your imagination.', author: 'Unknown' },
  { text: 'Little by little, one travels far.', author: 'J. R. R. Tolkien' },
  { text: 'Be so good they can’t ignore you.', author: 'Steve Martin' },
  { text: 'Perfection is achieved when there is nothing left to take away.', author: 'Antoine de Saint-Exupéry' },
  { text: 'The journey of a thousand miles begins with one step.', author: 'Lao Tzu' },
  { text: 'Keep going. Everything you need will come to you.', author: 'Unknown' },
  { text: 'Learning never exhausts the mind.', author: 'Leonardo da Vinci' },
  { text: 'Do what you can, with what you have, where you are.', author: 'Theodore Roosevelt' },
  { text: 'Fix the cause, not the symptom.', author: 'Steve Maguire' },
  { text: 'Happiness is not by chance, but by choice.', author: 'Jim Rohn' },
  { text: 'Make each day your masterpiece.', author: 'John Wooden' },
  { text: 'Start where you are. Use what you have. Do what you can.', author: 'Arthur Ashe' },
  { text: 'Inspiration exists, but it has to find you working.', author: 'Pablo Picasso' },
  { text: 'Today is a good day to have a great day.', author: 'Unknown' },
];

// Today's quote; `offset` steps through the list when the user shuffles.
export function quoteFor(d: Date, offset = 0): Quote {
  const n = QUOTES.length;
  return QUOTES[(((dayIndex(d) * 7 + offset) % n) + n) % n];
}

// Daily motivational quote for the greeting. Deterministic for a given day,
// so the quote never flickers between renders.

const dayIndex = (d: Date) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);

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

import { describeTimer, timerEnd, TIMER_UNITS, type TimerUnit } from '../../lib/timer';

// Pick a countdown length: a number, a unit, or a preset. It counts from the
// item's creation (`start`), so the preview shows exactly when it ends.

export type TimerChoice = { amount: number; unit: TimerUnit } | null;

const PRESETS: Array<{ amount: number; unit: TimerUnit }> = [
  { amount: 25, unit: 'minutes' },
  { amount: 1, unit: 'hours' },
  { amount: 4, unit: 'hours' },
  { amount: 1, unit: 'days' },
  { amount: 4, unit: 'days' },
  { amount: 7, unit: 'days' },
  { amount: 1, unit: 'months' },
  { amount: 3, unit: 'months' },
];
const UNIT_LABEL: Record<TimerUnit, string> = { minutes: 'Min', hours: 'Hours', days: 'Days', months: 'Months' };
const endFmt = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export function TimerPanel({ value, start, onChange }: { value: TimerChoice; start: number; onChange: (v: TimerChoice) => void }) {
  const amount = value?.amount ?? 1;
  const unit = value?.unit ?? 'days';
  const set = (a: number, u: TimerUnit) => onChange({ amount: Math.max(1, Math.min(9999, Math.round(a) || 1)), unit: u });
  const ended = value ? timerEnd({ ...value, start }) <= Date.now() : false;

  return (
    <div className="space-y-2.5">
      <p className="text-[11px] leading-snug text-white/55">
        Counts down from when it is set. Days and months show as “N left”, the last day as hh:mm:ss.
      </p>
      <div className="flex items-center gap-1.5">
        <div className="dtp-stepper flex h-8 items-center overflow-hidden rounded-lg border">
          <button type="button" aria-label="Less" onClick={() => set(amount - 1, unit)} className="h-full px-2 text-white/60 hover:bg-white/10 hover:text-white">
            −
          </button>
          <input
            type="number"
            min={1}
            max={9999}
            value={amount}
            aria-label="Timer length"
            onChange={(e) => set(Number(e.target.value), unit)}
            className="h-full w-10 bg-transparent text-center font-mono text-[12px] text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button type="button" aria-label="More" onClick={() => set(amount + 1, unit)} className="h-full px-2 text-white/60 hover:bg-white/10 hover:text-white">
            +
          </button>
        </div>
        <div role="radiogroup" aria-label="Timer unit" className="segmented flex flex-1 rounded-lg p-0.5">
          {TIMER_UNITS.map((u) => (
            <button
              key={u}
              type="button"
              role="radio"
              aria-checked={value?.unit === u}
              onClick={() => set(amount, u)}
              className={`flex-1 rounded-md px-0.5 py-1 text-[10px] font-semibold ${value?.unit === u ? 'segmented-on text-white' : 'text-white/55 hover:text-white/85'}`}
            >
              {UNIT_LABEL[u]}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-4 gap-1">
        {PRESETS.map((p) => {
          const on = value?.amount === p.amount && value.unit === p.unit;
          return (
            <button
              key={`${p.amount}${p.unit}`}
              type="button"
              aria-pressed={on}
              onClick={() => set(p.amount, p.unit)}
              className={`dtp-chip rounded-md border px-1 py-1 font-mono text-[10px] text-white/85 ${on ? 'is-active' : ''}`}
            >
              {describeTimer(p)}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className={value ? (ended ? 'text-red-300' : 'text-white/70') : 'text-white/40'}>
          {value ? `${ended ? 'Ended' : 'Ends'} ${endFmt.format(timerEnd({ ...value, start }))}` : 'No timer'}
        </span>
        {value && (
          <button type="button" onClick={() => onChange(null)} className="text-white/55 hover:text-red-300">
            Remove timer
          </button>
        )}
      </div>
    </div>
  );
}

import { useStore } from '../../store';

// Settings → Processing → Notifications. "All notifications" ticks and locks
// the other two; untick it to choose them one by one.
export function NotificationSettings() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const all = settings.notifyAll ?? false;
  const rows = [
    {
      key: 'notifyChrome' as const,
      label: 'Chrome built-in notifications',
      hint: 'System notifications from Chrome when DevDeck can’t show its own pop-up (another app in front, chrome:// pages).',
      on: all || (settings.notifyChrome ?? false),
    },
    {
      key: 'notifyPopups' as const,
      label: 'Alert pop-up notifications',
      hint: 'DevDeck’s alert cards at the top of the page — on DevDeck and on the website you’re viewing.',
      on: all || (settings.notifyPopups ?? true),
    },
  ];
  return (
    <section aria-label="Notifications" className="set-card space-y-4 rounded-2xl border p-5">
      <div>
        <h3 className="set-card-title text-[13.5px] font-semibold">How alerts reach you</h3>
        <p className="set-card-hint mt-0.5 text-[12px]">Reminders, due dates, timers and calendar alerts. Several at once are grouped; while a panel is open they wait behind a bell.</p>
      </div>
      <label className="flex cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          checked={all}
          onChange={(e) =>
            updateSettings(
              e.target.checked
                ? { notifyAll: true }
                : { notifyAll: false, notifyChrome: settings.notifyChrome ?? false, notifyPopups: settings.notifyPopups ?? true },
            )
          }
          className="mt-0.5 size-4 cursor-pointer accent-[var(--color-accent)]"
        />
        <span>
          <span className="block text-[13px] font-semibold text-white/90">All notifications</span>
          <span className="block text-[11px] text-white/50">Both kinds below. Untick to choose them one by one.</span>
        </span>
      </label>
      <div className="space-y-2.5 border-l border-white/10 pl-4">
        {rows.map((r) => (
          <label key={r.key} className={`flex items-start gap-2.5 ${all ? 'cursor-not-allowed opacity-45' : 'cursor-pointer'}`}>
            <input
              type="checkbox"
              checked={r.on}
              disabled={all}
              aria-describedby={`${r.key}-hint`}
              onChange={(e) => updateSettings({ [r.key]: e.target.checked })}
              className="mt-0.5 size-4 cursor-pointer accent-[var(--color-accent)] disabled:cursor-not-allowed"
            />
            <span>
              <span className="block text-[13px] font-medium text-white/85">{r.label}</span>
              <span id={`${r.key}-hint`} className="block text-[11px] text-white/50">
                {r.hint}
              </span>
            </span>
          </label>
        ))}
      </div>
    </section>
  );
}

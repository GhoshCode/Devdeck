import { useStore } from '../../store';
import { SettingsCard, SwitchRow } from './pages';

// Settings → Notifications. Alerts are DevDeck's own pop-ups — in the DevDeck
// tab, or drawn at the top of the website you're on.
export function NotificationSettings() {
  const on = useStore((s) => s.settings.notifyPopups ?? true);
  const updateSettings = useStore((s) => s.updateSettings);
  return (
    <SettingsCard title="How alerts reach you" hint="Reminders, due dates, timers and calendar alerts. Several at once are grouped; while a panel is open they wait behind a bell.">
      <SwitchRow
        label="Alert pop-ups"
        hint="Cards at the top of the page — on DevDeck and on the website you're viewing."
        checked={on}
        onChange={(v) => updateSettings({ notifyPopups: v })}
      />
    </SettingsCard>
  );
}

import { ProcessingEditor } from '../processing/ProcessingEditor';
import { NotificationSettings } from './NotificationSettings';

// Settings → Processing (plan Phase 6): the same editor the panel's cog opens.
export function ProcessingTab() {
  return (
    <div className="max-w-2xl space-y-6 p-6 text-sm text-white/90">
      <div className="pr-12">
        <h3 className="font-display text-[1rem] font-semibold text-white">Currently Processing</h3>
        <p className="text-xs text-white/50">
          Sites you're actively working on, grouped in sections, each with its own reminder schedule.
        </p>
      </div>
      <NotificationSettings />
      <ProcessingEditor />
    </div>
  );
}

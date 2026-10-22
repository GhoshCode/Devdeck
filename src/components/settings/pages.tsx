import { useState, type ReactNode } from 'react';
import { useStore } from '../../store';
import { clearCache } from '../../lib/cache';
import { WeatherSourcePicker } from './WeatherSourcePicker';

// Small settings pages and the card every settings page is built from. The
// shell (SettingsModal) owns each page's title and description; a page is
// just a stack of cards.

export function SettingsCard({ title, hint, aside, children }: { title: string; hint?: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={title} className="set-card space-y-4 rounded-2xl border p-5">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="set-card-title text-[13.5px] font-semibold">{title}</h3>
          {hint && <p className="set-card-hint mt-0.5 text-[12px] leading-relaxed">{hint}</p>}
        </div>
        {aside}
      </header>
      {children}
    </section>
  );
}

const field = 'set-field w-full rounded-xl border px-3.5 py-2.5 text-[13px] outline-none';
const label = 'set-label mb-1.5 block text-[11.5px] font-semibold';

export function SwitchRow({ label: text, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span className="min-w-0">
        <span className="set-row-label block text-[13px] font-medium">{text}</span>
        {hint && <span className="set-card-hint block text-[12px]">{hint}</span>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="set-switch mt-0.5 shrink-0" />
    </label>
  );
}

// Connections → GitHub: the commit heat-map in the top bar.
export function GitHubSettings() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const [showToken, setShowToken] = useState(false);
  const user = settings.githubUsername.trim();
  return (
    <div className="space-y-5">
      <SettingsCard title="Account" hint="Your public contributions show in the Git commits widget in the top bar.">
        <div>
          <label htmlFor="set-gh-user" className={label}>
            GitHub username
          </label>
          <input
            id="set-gh-user"
            aria-label="GitHub username"
            value={settings.githubUsername}
            onChange={(e) => updateSettings({ githubUsername: e.target.value.trim().replace(/^@/, '') })}
            placeholder="octocat"
            spellCheck={false}
            className={`${field} font-mono`}
          />
        </div>
      </SettingsCard>
      {user && (
        <SettingsCard title="Private contributions" hint="Optional. A classic token with the read:user scope adds private activity. Stored only in this browser, never exported.">
          <div className="flex gap-2">
            <input
              aria-label="Personal access token"
              type={showToken ? 'text' : 'password'}
              value={settings.githubToken}
              onChange={(e) => updateSettings({ githubToken: e.target.value.trim() })}
              placeholder="ghp_…"
              autoComplete="off"
              className={`${field} font-mono`}
            />
            <button type="button" onClick={() => setShowToken((s) => !s)} className="set-btn shrink-0 rounded-xl border px-3.5 text-[12px] font-medium">
              {showToken ? 'Hide' : 'Show'}
            </button>
          </div>
          <button type="button" onClick={() => clearCache('github')} className="set-link text-[12px] font-medium">
            Refresh contributions now
          </button>
        </SettingsCard>
      )}
    </div>
  );
}

// General → Weather & location: the weather and UV widget.
export function WeatherSettings() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  return (
    <div className="space-y-5">
      <SettingsCard title="Weather & UV">
        <SwitchRow
          label="Show weather"
          hint="Temperature and the UV index beside the date."
          checked={settings.weatherEnabled}
          onChange={(v) => updateSettings({ weatherEnabled: v })}
        />
      </SettingsCard>
      {settings.weatherEnabled && (
        <>
          <SettingsCard title="Location" hint="Where the forecast is for.">
            <SwitchRow
              label="Detect my location"
              hint="Asks the browser once; the city below is used if it can't."
              checked={settings.useGeolocation}
              onChange={(v) => updateSettings({ useGeolocation: v })}
            />
            <div>
              <label htmlFor="set-city" className={label}>
                City{settings.useGeolocation ? ' (fallback)' : ''}
              </label>
              <input id="set-city" value={settings.manualCity} onChange={(e) => updateSettings({ manualCity: e.target.value })} placeholder="e.g. Kolkata" className={field} />
            </div>
          </SettingsCard>
          <WeatherSourcePicker />
        </>
      )}
    </div>
  );
}

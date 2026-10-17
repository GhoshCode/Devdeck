import { useState } from 'react';
import { useStore } from '../../store';
import { clearCache } from '../../lib/cache';
import { WeatherSourcePicker } from './WeatherSourcePicker';

// Profile & data sources for the top-bar widgets: GitHub (Git commits) and
// location (Weather & UV). Phase 6 folds more into this tab.
export function ProfileTab() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const [showToken, setShowToken] = useState(false);

  const field =
    'w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs text-white placeholder-white/30 focus:border-white/20 focus:outline-none';
  const label = 'text-xs font-semibold text-white/80 uppercase tracking-wider block';

  return (
    <div className="space-y-6 p-6 sm:p-8">
      <div>
        <h3 className="font-display text-[1rem] font-semibold text-white tracking-wide">Profile</h3>
        <p className="mt-1 text-xs text-white/50">Accounts and location used by the top-bar widgets.</p>
      </div>

      <section className="glass-inner space-y-4 p-5 rounded-2xl border border-white/10">
        <div className="space-y-2">
          <label htmlFor="profile-gh-user" className={label}>
            GitHub Username
          </label>
          <input
            id="profile-gh-user"
            value={settings.githubUsername}
            onChange={(e) => updateSettings({ githubUsername: e.target.value.trim().replace(/^@/, '') })}
            placeholder="e.g. octocat"
            className={`${field} font-mono`}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="profile-gh-token" className={label}>
            Personal Access Token <span className="font-normal normal-case text-white/40">(optional)</span>
          </label>
          <div className="flex gap-2">
            <input
              id="profile-gh-token"
              type={showToken ? 'text' : 'password'}
              value={settings.githubToken}
              onChange={(e) => updateSettings({ githubToken: e.target.value.trim() })}
              placeholder="ghp_… — includes private contributions"
              autoComplete="off"
              className={`${field} font-mono`}
            />
            <button
              type="button"
              onClick={() => setShowToken((s) => !s)}
              className="rounded-xl bg-white/5 px-3 text-xs text-white/60 hover:bg-white/10"
            >
              {showToken ? 'Hide' : 'Show'}
            </button>
          </div>
          <p className="text-[11px] text-white/40">
            Stored only in this browser and never included in exports. A classic token with the{' '}
            <code className="font-mono">read:user</code> scope is enough.
          </p>
        </div>
        <button
          type="button"
          onClick={() => clearCache('github')}
          className="rounded-xl bg-white/5 px-3 py-1.5 text-xs text-white/60 hover:bg-white/10"
        >
          Clear cached contributions
        </button>
      </section>

      <section className="glass-inner space-y-4 p-5 rounded-2xl border border-white/10">
        <label className="flex items-center gap-2.5 text-xs text-white/80">
          <input
            type="checkbox"
            checked={settings.weatherEnabled}
            onChange={(e) => updateSettings({ weatherEnabled: e.target.checked })}
            className="accent-[var(--color-accent)]"
          />
          Show weather &amp; UV index
        </label>
        <label className="flex items-center gap-2.5 text-xs text-white/80">
          <input
            type="checkbox"
            checked={settings.useGeolocation}
            onChange={(e) => updateSettings({ useGeolocation: e.target.checked })}
            className="accent-[var(--color-accent)]"
          />
          Detect my location automatically
        </label>
        <div className="space-y-2">
          <label htmlFor="profile-city" className={label}>
            City {settings.useGeolocation && <span className="font-normal normal-case text-white/40">(fallback)</span>}
          </label>
          <input
            id="profile-city"
            value={settings.manualCity}
            onChange={(e) => updateSettings({ manualCity: e.target.value })}
            placeholder="e.g. Kolkata"
            className={field}
          />
        </div>
        <WeatherSourcePicker />
      </section>
    </div>
  );
}

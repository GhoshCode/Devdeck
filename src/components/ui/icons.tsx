// Small shared icons.

// The main settings control: a clean, rounded cog.
export function CogIcon({ className = 'size-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

// Wi-Fi with a slash — offline.
export function OfflineIcon({ className = 'size-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2.5 8.8a14 14 0 0 1 6.4-3.4M12 5a14 14 0 0 1 9.5 3.8" />
      <path d="M5.6 12.1a9.5 9.5 0 0 1 3.9-2.1M14.8 10.3a9.5 9.5 0 0 1 3.6 1.8" />
      <path d="M8.8 15.3a5 5 0 0 1 6.4 0" />
      <circle cx="12" cy="18.6" r="1" fill="currentColor" />
      <path d="M3 3l18 18" />
    </svg>
  );
}

// Two sliders — "adjust / manage" (feeds panel, Focus & Queue).
export function SlidersIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M3.5 8h9M18.5 8h2" />
      <circle cx="15.5" cy="8" r="3" />
      <path d="M3.5 16h2M11.5 16h9" />
      <circle cx="8.5" cy="16" r="3" />
    </svg>
  );
}

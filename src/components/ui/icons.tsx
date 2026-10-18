// Small shared icons.

// Two meshing gears — "manage / configure" (feeds, Focus & Queue).
export function GearsIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {/* large gear, open "C" hub */}
      <path d="M9.2 7.3l.6-1.8h1.9l.6 1.8 1.6.9 1.8-.6 1 1.6-1.3 1.4v1.8l1.3 1.4-1 1.6-1.8-.6-1.6.9-.6 1.8H9.8l-.6-1.8-1.6-.9-1.8.6-1-1.6 1.3-1.4v-1.8L4.8 8.5l1-1.6 1.8.6z" />
      <path d="M12.4 10.6a2.2 2.2 0 1 0 0 2.6" />
      {/* small gear */}
      <path d="M17.6 2.6l.4 1.1 1 .4 1-.5.8.8-.5 1 .4 1 1.1.4v1.2l-1.1.4-.4 1 .5 1-.8.8-1-.5-1 .4-.4 1.1h-1.2l-.4-1.1-1-.4-1 .5-.8-.8.5-1-.4-1-1.1-.4V5.9l1.1-.4.4-1-.5-1 .8-.8 1 .5 1-.4.4-1.1z" transform="translate(1 1) scale(0.9)" />
      <circle cx="17.7" cy="6.7" r="1.2" />
    </svg>
  );
}

// The main settings control: a bold cog.
export function CogIcon({ className = 'size-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10.3 2.8h3.4l.5 2.4 1.7.7 2-1.4 2.4 2.4-1.4 2 .7 1.7 2.4.5v3.4l-2.4.5-.7 1.7 1.4 2-2.4 2.4-2-1.4-1.7.7-.5 2.4h-3.4l-.5-2.4-1.7-.7-2 1.4-2.4-2.4 1.4-2-.7-1.7-2.4-.5v-3.4l2.4-.5.7-1.7-1.4-2 2.4-2.4 2 1.4 1.7-.7z" />
      <circle cx="12" cy="12" r="3.2" />
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

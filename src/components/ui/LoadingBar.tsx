// A thin accent loading bar for anything that waits on the network.
// With `value` (0–1) it fills as work completes; without it, a soft light
// sweeps along the track. It fades out when `active` turns false.

export function LoadingBar({
  active,
  value,
  label,
  className = '',
}: {
  active: boolean;
  value?: number;
  label?: string;
  className?: string;
}) {
  const determinate = typeof value === 'number';
  const pct = determinate ? Math.round(Math.min(1, Math.max(0, value)) * 100) : undefined;
  return (
    <span
      role={active ? 'progressbar' : undefined}
      aria-label={active ? (label ?? 'Loading') : undefined}
      aria-valuemin={determinate && active ? 0 : undefined}
      aria-valuemax={determinate && active ? 100 : undefined}
      aria-valuenow={active ? pct : undefined}
      aria-hidden={active ? undefined : true}
      className={`loading-bar pointer-events-none block h-[2px] overflow-hidden rounded-full transition-opacity duration-500 ${active ? 'opacity-100' : 'opacity-0'} ${className}`}
    >
      {determinate ? (
        <span className="loading-bar-fill block h-full rounded-full transition-[width] duration-300 ease-out" style={{ width: `${Math.max(4, pct ?? 0)}%` }} />
      ) : (
        <span className="loading-bar-sweep block h-full w-1/3 rounded-full" />
      )}
    </span>
  );
}

import { memo, useEffect, useState } from 'react';

// CPU and RAM use, beside the Settings button (extension only: needs the
// system.cpu / system.memory permissions; the website build shows nothing).
// CPU % = busy time / total time across all cores since the last sample.

interface CpuInfo {
  processors: Array<{ usage: { user: number; kernel: number; idle: number; total: number } }>;
}
interface MemInfo {
  capacity: number;
  availableCapacity: number;
}
interface SystemApi {
  cpu?: { getInfo: (cb: (i: CpuInfo) => void) => void };
  memory?: { getInfo: (cb: (i: MemInfo) => void) => void };
}
const systemApi = () => (globalThis as { chrome?: { system?: SystemApi } }).chrome?.system;

const SAMPLE_MS = 2000;

export const SystemStats = memo(function SystemStats() {
  const [stats, setStats] = useState<{ cpu: number | null; ram: number | null; usedGb: number; totalGb: number } | null>(null);

  useEffect(() => {
    const sys = systemApi();
    if (!sys?.cpu || !sys.memory) return;
    let last: { busy: number; total: number } | null = null;
    let alive = true;
    const sample = () => {
      sys.cpu!.getInfo((info) => {
        const busy = info.processors.reduce((n, p) => n + p.usage.total - p.usage.idle, 0);
        const total = info.processors.reduce((n, p) => n + p.usage.total, 0);
        const cpu = last && total > last.total ? Math.round(((busy - last.busy) / (total - last.total)) * 100) : null;
        last = { busy, total };
        sys.memory!.getInfo((m) => {
          if (!alive) return;
          const used = m.capacity - m.availableCapacity;
          setStats({ cpu, ram: Math.round((used / m.capacity) * 100), usedGb: used / 2 ** 30, totalGb: m.capacity / 2 ** 30 });
        });
      });
    };
    sample();
    const t = setInterval(sample, SAMPLE_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  if (!stats) return null;
  return (
    <div data-testid="system-stats" className="sys-stats glass-raised flex h-10 w-1/2 min-w-0 flex-col justify-center gap-1 rounded-xl px-2.5" aria-label="System usage">
      <Meter label="CPU" value={stats.cpu} title={stats.cpu === null ? 'Measuring CPU…' : `CPU ${stats.cpu}% across all cores`} />
      <Meter label="RAM" value={stats.ram} title={`RAM ${stats.usedGb.toFixed(1)} of ${stats.totalGb.toFixed(1)} GB used`} />
    </div>
  );
});

function Meter({ label, value, title }: { label: string; value: number | null; title: string }) {
  const v = value ?? 0;
  const tone = v >= 85 ? 'is-hot' : v >= 60 ? 'is-warm' : '';
  return (
    <div title={title} className="flex items-center gap-1.5 font-mono text-[9.5px] leading-none tabular-nums">
      <span className="w-6 shrink-0 font-semibold tracking-wider text-white/50">{label}</span>
      <span className="sys-track h-1 min-w-0 flex-1 overflow-hidden rounded-full">
        <span className={`sys-fill block h-full rounded-full ${tone}`} style={{ width: `${v}%` }} />
      </span>
      <span className="w-7 shrink-0 text-right text-white/75">{value === null ? '—' : `${v}%`}</span>
    </div>
  );
}

// Time zones for the Multi-Timezone clock face: a curated city list and the
// time / offset of a zone relative to the viewer's own clock.

export const ZONE_CHOICES: ReadonlyArray<{ tz: string; city: string }> = [
  { tz: 'America/Los_Angeles', city: 'San Francisco' },
  { tz: 'America/Denver', city: 'Denver' },
  { tz: 'America/Chicago', city: 'Chicago' },
  { tz: 'America/New_York', city: 'New York' },
  { tz: 'America/Toronto', city: 'Toronto' },
  { tz: 'America/Sao_Paulo', city: 'São Paulo' },
  { tz: 'Europe/London', city: 'London' },
  { tz: 'Europe/Dublin', city: 'Dublin' },
  { tz: 'Europe/Paris', city: 'Paris' },
  { tz: 'Europe/Berlin', city: 'Berlin' },
  { tz: 'Europe/Amsterdam', city: 'Amsterdam' },
  { tz: 'Europe/Stockholm', city: 'Stockholm' },
  { tz: 'Europe/Istanbul', city: 'Istanbul' },
  { tz: 'Africa/Lagos', city: 'Lagos' },
  { tz: 'Africa/Nairobi', city: 'Nairobi' },
  { tz: 'Asia/Dubai', city: 'Dubai' },
  { tz: 'Asia/Karachi', city: 'Karachi' },
  { tz: 'Asia/Kolkata', city: 'Kolkata' },
  { tz: 'Asia/Dhaka', city: 'Dhaka' },
  { tz: 'Asia/Bangkok', city: 'Bangkok' },
  { tz: 'Asia/Singapore', city: 'Singapore' },
  { tz: 'Asia/Shanghai', city: 'Shanghai' },
  { tz: 'Asia/Hong_Kong', city: 'Hong Kong' },
  { tz: 'Asia/Seoul', city: 'Seoul' },
  { tz: 'Asia/Tokyo', city: 'Tokyo' },
  { tz: 'Australia/Sydney', city: 'Sydney' },
  { tz: 'Pacific/Auckland', city: 'Auckland' },
  { tz: 'UTC', city: 'UTC' },
];

export const DEFAULT_ZONES = ['America/New_York', 'Asia/Tokyo'];

// Legacy IANA names some systems still report.
const ALIASES: Record<string, string> = { 'Asia/Calcutta': 'Asia/Kolkata', 'Asia/Saigon': 'Asia/Ho_Chi_Minh', 'Europe/Kiev': 'Europe/Kyiv' };

export const zoneCity = (tz: string) =>
  ZONE_CHOICES.find((z) => z.tz === (ALIASES[tz] ?? tz))?.city ?? tz.split('/').pop()!.replace(/_/g, ' ');

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function partsIn(now: Date, tz: string) {
  let fmt = fmtCache.get(tz);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23',
    });
    fmtCache.set(tz, fmt);
  }
  const p = Object.fromEntries(fmt.formatToParts(now).map((x) => [x.type, x.value]));
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour, m: +p.minute };
}

// The zone's wall-clock time and its offset from the viewer's local time.
export function zoneTime(now: Date, tz: string, h24: boolean) {
  const z = partsIn(now, tz);
  const zoneAsLocal = new Date(z.y, z.mo - 1, z.d, z.h, z.m);
  const localFloor = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes());
  const diffH = Math.round(((zoneAsLocal.getTime() - localFloor.getTime()) / 3_600_000) * 2) / 2;
  const hours = h24 ? z.h : z.h % 12 || 12;
  return {
    hours: String(hours).padStart(2, '0'),
    minutes: String(z.m).padStart(2, '0'),
    meridiem: h24 ? null : z.h >= 12 ? 'PM' : 'AM',
    offset: diffH === 0 ? '±0' : `${diffH > 0 ? '+' : '−'}${Math.abs(diffH)}h`,
  };
}

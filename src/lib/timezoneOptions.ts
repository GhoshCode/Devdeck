import { getTimeZones } from '@vvo/tzdb';

// Every time zone in the world (from @vvo/tzdb, which groups IANA aliases),
// labelled with its UTC offset, country, zone name and main cities. Loaded on
// demand by the Multi-Timezone city search, so the data stays out of the
// first paint.
export const timezoneOptions = getTimeZones().map((tz) => ({
  value: tz.name, // e.g. "Asia/Kolkata"
  // currentTimeFormat looks like "+05:30 India Standard Time - Kolkata, Mumbai, New Delhi"
  label: `(UTC${tz.currentTimeFormat.slice(0, 6)}) ${tz.countryName} — ${tz.alternativeName} (${tz.mainCities.join(', ')})`,
  searchKeywords: `${tz.name} ${tz.group.join(' ')} ${tz.countryName} ${tz.mainCities.join(' ')} ${tz.alternativeName} ${tz.abbreviation}`.toLowerCase(),
}));

export type TimezoneOption = (typeof timezoneOptions)[number];

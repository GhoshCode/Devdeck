import { describe, expect, test } from 'vitest';
import {
  describeWeather,
  fetchWeather,
  geocodeCity,
  metSymbolToWmo,
  placeFromTimezone,
  reverseGeocode,
  uvRisk,
} from './weather';

const jsonFetch = (body: unknown, ok = true) =>
  (async () => ({ ok, status: ok ? 200 : 500, json: async () => body })) as unknown as typeof fetch;

describe('uvRisk', () => {
  test.each([
    [0, 'low'],
    [2.4, 'low'],
    [3, 'moderate'],
    [5.4, 'moderate'],
    [6, 'high'],
    [8, 'very-high'],
    [10.4, 'very-high'],
    [11, 'extreme'],
  ])('%f → %s', (uv, risk) => {
    expect(uvRisk(uv)).toBe(risk);
  });
});

test('describeWeather maps WMO codes and day/night', () => {
  expect(describeWeather(0, true).icon).toBe('sun');
  expect(describeWeather(0, false).icon).toBe('moon');
  expect(describeWeather(63).icon).toBe('rain');
  expect(describeWeather(75).icon).toBe('snow');
  expect(describeWeather(96).icon).toBe('storm');
});

test('placeFromTimezone keeps the last segment, spaced', () => {
  expect(placeFromTimezone('America/Argentina/Buenos_Aires')).toBe('Buenos Aires');
});

describe('fetchWeather', () => {
  test('normalises the Open-Meteo current block', async () => {
    const data = await fetchWeather(
      { lat: 22.57, lon: 88.36, label: null, postcode: '700001' },
      jsonFetch({
        timezone: 'Asia/Kolkata',
        current: { temperature_2m: 26.6, weather_code: 51, uv_index: 6.2, is_day: 1 },
      }),
      1234,
    );
    expect(data).toEqual({
      temperature: 26.6,
      conditionCode: 51,
      conditionText: 'Drizzle',
      icon: 'rain',
      place: 'Kolkata',
      postcode: '700001',
      uvIndex: 6.2,
      uvRisk: 'high',
      source: 'Open-Meteo',
      fetchedAt: 1234,
    });
  });

  test('falls back to MET Norway when Open-Meteo is down', async () => {
    const fetcher = (async (url: string) =>
      url.includes('open-meteo')
        ? { ok: false, status: 503, json: async () => ({}) }
        : {
            ok: true,
            status: 200,
            json: async () => ({
              properties: {
                timeseries: [
                  {
                    data: {
                      instant: { details: { air_temperature: 21.4, ultraviolet_index_clear_sky: 3.1 } },
                      next_1_hours: { summary: { symbol_code: 'lightrainshowers_day' } },
                    },
                  },
                ],
              },
            }),
          }) as unknown as typeof fetch;
    const data = await fetchWeather({ lat: 12.97, lon: 77.59, label: 'Bengaluru', postcode: '560037' }, fetcher, 1);
    expect(data).toMatchObject({
      temperature: 21.4,
      icon: 'rain',
      place: 'Bengaluru',
      postcode: '560037',
      uvIndex: 3.1,
      uvRisk: 'moderate',
      source: 'MET Norway',
    });
  });

  test('reports the primary error when both sources fail', async () => {
    await expect(
      fetchWeather({ lat: 0, lon: 0, label: 'X', postcode: null }, jsonFetch({}, false)),
    ).rejects.toThrow('Weather request failed');
  });
});

test.each([
  ['clearsky_day', 0, true],
  ['clearsky_night', 0, false],
  ['partlycloudy_day', 2, true],
  ['heavyrainshowers_night', 80, false],
  ['heavyrain', 65, true],
  ['snow', 73, true],
  ['rainandthunder', 95, true],
  ['fog', 45, true],
])('metSymbolToWmo(%s) → %i', (symbol, code, isDay) => {
  expect(metSymbolToWmo(symbol)).toEqual({ code, isDay });
});

test('geocodeCity reports unknown cities and returns a postcode when known', async () => {
  await expect(geocodeCity('Nowhere', jsonFetch({}))).rejects.toThrow('City "Nowhere" not found');
  await expect(
    geocodeCity('Kolkata', jsonFetch({ results: [{ latitude: 1, longitude: 2, name: 'Kolkata', postcodes: ['700001'] }] })),
  ).resolves.toEqual({ lat: 1, lon: 2, label: 'Kolkata', postcode: '700001' });
});

test('reverseGeocode prefers the city and never throws', async () => {
  await expect(
    reverseGeocode(12.97, 77.59, jsonFetch({ city: 'Bengaluru', locality: 'Shanthala Nagar', postcode: '560037' })),
  ).resolves.toEqual({ label: 'Bengaluru', postcode: '560037' });
  await expect(reverseGeocode(0, 0, jsonFetch({}, false))).resolves.toEqual({ label: null, postcode: null });
});

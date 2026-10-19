import { expect, test } from 'vitest';
import { DEFAULT_LOOK, contrastWithWhite, switchModePatch } from './appearance';

const dark = {
  themeMode: 'dark' as const,
  presetTheme: 'aurora',
  accentColor: '#10b981',
  backgroundImage: 'linear-gradient(#000, #111)',
  modeLooks: undefined,
};

test('switching mode saves the current look and restores the defaults the first time', () => {
  const patch = switchModePatch(dark, 'light');
  expect(patch).toMatchObject({ themeMode: 'light', ...DEFAULT_LOOK.light });
  expect(patch.modeLooks?.dark).toEqual({
    presetTheme: 'aurora',
    accentColor: '#10b981',
    backgroundImage: 'linear-gradient(#000, #111)',
  });
});

test('a round trip brings back the look chosen for each mode', () => {
  const light = { ...dark, ...switchModePatch(dark, 'light') };
  const customized = { ...light, presetTheme: 'sky-light', accentColor: '#0284c7' };
  const back = { ...customized, ...switchModePatch(customized, 'dark') };
  expect(back).toMatchObject({ themeMode: 'dark', presetTheme: 'aurora', accentColor: '#10b981' });
  const again = switchModePatch(back, 'light');
  expect(again).toMatchObject({ themeMode: 'light', presetTheme: 'sky-light', accentColor: '#0284c7' });
});

test('no patch when already in that mode', () => {
  expect(switchModePatch(dark, 'dark')).toEqual({});
});

test('contrast of white text on accents', () => {
  expect(contrastWithWhite('#007aff')).toBeGreaterThan(4);
  expect(contrastWithWhite('#ffcc00')).toBeLessThan(2);
  expect(contrastWithWhite('nonsense')).toBe(21);
});

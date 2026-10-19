import { describe, expect, it } from 'vitest';
import { deriveNameFromUrl } from './utils';

describe('deriveNameFromUrl', () => {
  it('names a site after its main domain, not a subdomain', () => {
    expect(deriveNameFromUrl('https://news.ycombinator.com')).toBe('Ycombinator');
    expect(deriveNameFromUrl('https://www.github.com/trending')).toBe('Github');
    expect(deriveNameFromUrl('https://pandas.pydata.org')).toBe('Pandas');
    expect(deriveNameFromUrl('https://docs.python.org')).toBe('Python');
    expect(deriveNameFromUrl('https://esbuild.github.io')).toBe('Esbuild');
    expect(deriveNameFromUrl('dev.to')).toBe('Dev');
  });
});

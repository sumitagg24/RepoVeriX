import {
  truncate,
  clockTime,
  formatNumber,
  formatPercent,
  shortSha,
  fileBasename,
  titleCase,
  UUID_RE,
} from '../format';

describe('Format helpers', () => {
  it('truncates strings correctly', () => {
    expect(truncate('short', 10)).toBe('short');
    expect(truncate('this is a very long string indeed', 15)).toBe('this is a very…');
  });

  it('validates UUIDs', () => {
    expect(UUID_RE.test('12345678-1234-1234-1234-123456789abc')).toBe(true);
    expect(UUID_RE.test('not-a-uuid')).toBe(false);
  });

  it('formats numbers and percentages cleanly', () => {
    expect(formatNumber(12480)).toBe('12,480');
    expect(formatNumber(null)).toBe('None');
    expect(formatPercent(0.852, 1)).toBe('85.2%');
    expect(formatPercent(undefined)).toBe('None');
  });

  it('formats file basenames and short SHAs', () => {
    expect(fileBasename('src/app/page.tsx')).toBe('page.tsx');
    expect(shortSha('abcdef1234567890', 7)).toBe('abcdef1');
    expect(shortSha(null)).toBe('None');
  });

  it('transforms strings to titleCase', () => {
    expect(titleCase('sql_injection')).toBe('Sql Injection');
    expect(titleCase('cross-site-scripting')).toBe('Cross Site Scripting');
  });
});

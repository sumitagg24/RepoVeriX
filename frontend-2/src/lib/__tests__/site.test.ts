import { PRIVATE_ROUTE_PREFIXES, absoluteUrl, pageMetadata } from '@/lib/site';
import { formatNumber, shortSha, titleCase, truncate } from '@/lib/format';
import { duration, relativeTime } from '@/lib/dates';

describe('pageMetadata', () => {
  it('indexes public pages with a canonical URL', () => {
    const meta = pageMetadata({ title: 'Pricing', description: 'Plans', path: '/pricing' });
    expect(meta.alternates?.canonical).toContain('/pricing');
    expect(meta.robots).toEqual({ index: true, follow: true });
    expect(meta.openGraph?.title).toBe('Pricing · RepoVeriX');
  });

  it('blocks indexing when asked, for private surfaces', () => {
    const meta = pageMetadata({ title: 'Billing', description: 'Usage', path: '/billing', index: false });
    expect(meta.robots).toEqual({ index: false, follow: false, nocache: true });
  });

  it('builds absolute URLs against the configured site origin', () => {
    expect(absoluteUrl('/docs')).toBe(absoluteUrl('/docs'));
    expect(absoluteUrl('docs')).toBe(absoluteUrl('/docs'));
  });
});

describe('private route prefixes', () => {
  it('covers every authenticated area so robots and noindex agree', () => {
    for (const route of ['/dashboard', '/repositories', '/scans', '/findings', '/billing', '/settings']) {
      expect(PRIVATE_ROUTE_PREFIXES).toContain(route);
    }
  });
});

describe('format helpers', () => {
  it('formats counts and truncates safely', () => {
    expect(formatNumber(12480)).toBe('12,480');
    expect(formatNumber(null)).toBe('None');
    expect(truncate('short', 10)).toBe('short');
    expect(truncate('a much longer string', 10)).toHaveLength(10);
    expect(titleCase('api_misuse')).toBe('Api Misuse');
    expect(shortSha('abcdef1234567890', 6)).toBe('abcdef');
    expect(shortSha(null)).toBe('None');
  });
});

describe('date helpers', () => {
  it('returns a written fallback for missing timestamps rather than an invalid date', () => {
    expect(relativeTime(null)).toBe('None');
    expect(relativeTime('nonsense')).toBe('None');
    expect(duration(null, null)).toBe('None');
  });

  it('computes durations in seconds, minutes and hours', () => {
    const start = '2026-09-18T10:00:00Z';
    expect(duration(start, '2026-09-18T10:00:20Z')).toBe('20s');
    expect(duration(start, '2026-09-18T10:01:30Z')).toBe('1m 30s');
    expect(duration(start, '2026-09-18T11:15:00Z')).toBe('1h 15m');
  });
});

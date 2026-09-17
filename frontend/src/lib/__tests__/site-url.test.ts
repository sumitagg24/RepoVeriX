/**
 * SITE_URL resolution: explicit env wins, Vercel's automatic VERCEL_URL is
 * the production fallback, localhost is local-dev only.
 */
describe('site-url', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.VERCEL_URL;
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  function load(): string {
    let url = '';
    jest.isolateModules(() => {
      url = require('@/lib/site-url').SITE_URL as string;
    });
    return url;
  }

  test('falls back to localhost for local dev', () => {
    expect(load()).toBe('http://localhost:3000');
  });

  test('uses Vercel URL on Vercel builds', () => {
    process.env.VERCEL_URL = 'repoverix.vercel.app';
    expect(load()).toBe('https://repoverix.vercel.app');
  });

  test('explicit NEXT_PUBLIC_SITE_URL wins over everything', () => {
    process.env.VERCEL_URL = 'repoverix.vercel.app';
    process.env.NEXT_PUBLIC_SITE_URL = 'https://repoverix.com/';
    expect(load()).toBe('https://repoverix.com');
  });
});

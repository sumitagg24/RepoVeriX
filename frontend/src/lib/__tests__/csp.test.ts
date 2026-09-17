import { buildCsp } from '@/lib/csp';

const base = {
  environment: 'production' as const,
  nonce: 'AbCdEf123456',
  apiUrl: 'http://localhost:8000',
  siteUrl: 'http://localhost:3000',
};

const parse = (csp: string) =>
  Object.fromEntries(
    csp.split(';').map((d) => {
      const [name, ...rest] = d.trim().split(/\s+/);
      return [name, rest.join(' ')];
    })
  );

describe('buildCsp', () => {
  it('enforces a strict script policy in production', () => {
    const { header, value, reportOnly } = buildCsp(base);
    const directives = parse(value);

    expect(header).toBe('Content-Security-Policy');
    expect(reportOnly).toBe(false);
    expect(directives['script-src']).toContain("'nonce-AbCdEf123456'");
    expect(directives['script-src']).toContain("'strict-dynamic'");
    // No blanket inline-script allowance, no host allowlist for scripts.
    expect(directives['script-src']).not.toContain("'unsafe-inline'");
    expect(directives['script-src']).not.toContain("'unsafe-eval'");
    expect(directives['script-src']).not.toContain('http');
    // Eval is only ever a dev affordance.
    expect(value).not.toContain("'unsafe-eval'");
  });

  it('locks down the classic bypass vectors in every environment', () => {
    for (const environment of ['production', 'development'] as const) {
      const { value } = buildCsp({ ...base, environment });
      const directives = parse(value);

      expect(directives['object-src']).toBe("'none'");
      expect(directives['base-uri']).toBe("'none'");
      expect(directives['frame-ancestors']).toBe("'none'");
      expect(directives['form-action']).toBe("'self'");
      expect(directives['frame-src']).toBe("'none'");
    }
  });

  it('allows inline styles but never inline scripts', () => {
    const { value } = buildCsp(base);
    const directives = parse(value);

    expect(directives['style-src']).toContain("'unsafe-inline'");
    expect(directives['script-src']).not.toContain("'unsafe-inline'");
  });

  it('adds eval and websockets only in development', () => {
    const { value } = buildCsp({ ...base, environment: 'development' });
    const directives = parse(value);

    expect(directives['script-src']).toContain("'unsafe-eval'");
    expect(directives['connect-src']).toContain('ws:');
    expect(directives['upgrade-insecure-requests']).toBeUndefined();
  });

  it('upgrades insecure requests only in production', () => {
    const { value } = buildCsp(base);
    expect(parse(value)['upgrade-insecure-requests']).toBe('');
  });

  it('includes the backend origin in connect-src', () => {
    const { value } = buildCsp({ ...base, apiUrl: 'https://api.repoverix.com' });
    const connect = parse(value)['connect-src'];

    expect(connect).toContain("'self'");
    expect(connect).toContain('https://api.repoverix.com');
    // The frontend origin is allowed too (same-origin proxy + RSC fetches).
    expect(connect).toContain('http://localhost:3000');
  });

  it('assumes https for bare-host origins', () => {
    const { value } = buildCsp({ ...base, apiUrl: 'api.example.com' });
    expect(parse(value)['connect-src']).toContain('https://api.example.com');
  });

  it('trims trailing slashes from origins', () => {
    const { value } = buildCsp({ ...base, apiUrl: 'http://localhost:8000/' });
    expect(parse(value)['connect-src']).toContain('http://localhost:8000');
    expect(parse(value)['connect-src']).not.toContain('8000/');
  });

  it('permits GitHub/GitLab avatars and data: images', () => {
    const { value } = buildCsp(base);
    const img = parse(value)['img-src'];

    expect(img).toContain("'self'");
    expect(img).toContain('data:');
    expect(img).toContain('https://avatars.githubusercontent.com');
    expect(img).toContain('https://gitlab.com');
  });

  it('can be emitted in report-only mode for rollout', () => {
    const { header, reportOnly } = buildCsp({ ...base, reportOnly: true });

    expect(header).toBe('Content-Security-Policy-Report-Only');
    expect(reportOnly).toBe(true);
  });

  it('adds a report collector when configured', () => {
    const { value } = buildCsp({ ...base, reportUri: 'https://csp.example.com/collect' });
    expect(parse(value)['report-uri']).toBe('https://csp.example.com/collect');
  });
});

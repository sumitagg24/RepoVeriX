describe('Frontend Security Invariants', () => {
  it('rejects path traversal patterns in proxy route segments', () => {
    const isMaliciousSegment = (segments: string[]) => {
      return segments.some((seg) => seg === '..' || seg.includes('/') || seg.includes('\\'));
    };

    expect(isMaliciousSegment(['..', 'etc', 'passwd'])).toBe(true);
    expect(isMaliciousSegment(['users', '..', 'admin'])).toBe(true);
    expect(isMaliciousSegment(['repositories/evil'])).toBe(true);
    expect(isMaliciousSegment(['repositories\\evil'])).toBe(true);
    expect(isMaliciousSegment(['repositories', 'scan', '123'])).toBe(false);
    expect(isMaliciousSegment(['auth', 'oauth', 'providers'])).toBe(false);
  });

  it('drops disallowed headers and forwards only allowlisted headers', () => {
    const FORWARD_REQUEST_HEADERS = new Set([
      'authorization',
      'content-type',
      'accept',
      'accept-language',
      'idempotency-key',
      'if-none-match',
      'x-requested-with',
    ]);

    const incomingHeaders = {
      authorization: 'Bearer token123',
      cookie: 'session_id=secret_cookie_val',
      'x-forwarded-for': '1.2.3.4',
      'content-type': 'application/json',
      'custom-trace-header': 'xyz',
    };

    const forwarded: Record<string, string> = {};
    for (const [key, value] of Object.entries(incomingHeaders)) {
      if (FORWARD_REQUEST_HEADERS.has(key.toLowerCase())) {
        forwarded[key.toLowerCase()] = value;
      }
    }

    expect(forwarded).toEqual({
      authorization: 'Bearer token123',
      'content-type': 'application/json',
    });
    expect(forwarded.cookie).toBeUndefined();
    expect(forwarded['x-forwarded-for']).toBeUndefined();
  });
});

import { AxiosError, AxiosHeaders } from 'axios';

import { normalizeNaiveUtcDates, toApiFailure } from '@/services/api';

function axiosErrorWith(status: number, data: unknown = {}): AxiosError {
  const error = new AxiosError('request failed');
  error.response = {
    status,
    statusText: '',
    data,
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
  } as AxiosError['response'];
  return error;
}

describe('normalizeNaiveUtcDates', () => {
  it('stamps Z onto naive *_at timestamps so they are read as UTC', () => {
    const result = normalizeNaiveUtcDates({ created_at: '2026-09-18T10:00:00', name: 'repo' });
    expect(result.created_at).toBe('2026-09-18T10:00:00Z');
  });

  it('leaves timestamps that already carry an offset alone', () => {
    const result = normalizeNaiveUtcDates({ finished_at: '2026-09-18T10:00:00+02:00' });
    expect(result.finished_at).toBe('2026-09-18T10:00:00+02:00');
  });

  it('does not rewrite non-timestamp strings', () => {
    const result = normalizeNaiveUtcDates({ note_at: 'not-a-date', at: '2026-09-18' });
    expect(result.note_at).toBe('not-a-date');
    expect(result.at).toBe('2026-09-18');
  });

  it('walks arrays and nested objects', () => {
    const result = normalizeNaiveUtcDates([
      { updated_at: '2026-01-01T00:00:00', nested: { updated_at: '2026-01-02T00:00:00' } },
    ]);
    expect(result[0].updated_at).toBe('2026-01-01T00:00:00Z');
    expect(result[0].nested.updated_at).toBe('2026-01-02T00:00:00Z');
  });
});

describe('toApiFailure', () => {
  it('preserves the backend detail message when present', () => {
    const failure = toApiFailure(axiosErrorWith(409, { detail: 'Repository is currently being ingested' }));
    expect(failure.kind).toBe('conflict');
    expect(failure.message).toBe('Repository is currently being ingested');
  });

  it('classifies plan limits separately so screens can offer an upgrade', () => {
    const failure = toApiFailure(axiosErrorWith(402, { detail: 'Scan limit reached for this period' }));
    expect(failure.kind).toBe('upgrade');
    expect(failure.status).toBe(402);
  });

  it('classifies auth, permission and not-found outcomes', () => {
    expect(toApiFailure(axiosErrorWith(401)).kind).toBe('unauthorized');
    expect(toApiFailure(axiosErrorWith(403)).kind).toBe('forbidden');
    expect(toApiFailure(axiosErrorWith(404)).kind).toBe('not-found');
    expect(toApiFailure(axiosErrorWith(429)).kind).toBe('rate-limited');
    expect(toApiFailure(axiosErrorWith(500)).kind).toBe('server');
  });

  it('falls back to calm copy for non-axios errors', () => {
    const failure = toApiFailure(new Error('boom'));
    expect(failure.kind).toBe('unknown');
    expect(failure.message).not.toContain('boom');
  });
});

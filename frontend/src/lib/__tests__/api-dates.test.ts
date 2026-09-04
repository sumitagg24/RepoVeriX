import { normalizeNaiveUtcDates } from '@/services/api';

describe('normalizeNaiveUtcDates', () => {
  it('appends Z to naive UTC datetimes in *_at fields', () => {
    const input = {
      created_at: '2026-09-04T10:55:44',
      finished_at: '2026-09-04T10:55:45.703108',
      name: 'repo',
    };
    expect(normalizeNaiveUtcDates(input)).toEqual({
      created_at: '2026-09-04T10:55:44Z',
      finished_at: '2026-09-04T10:55:45.703108Z',
      name: 'repo',
    });
  });

  it('does not touch strings that already carry a timezone offset', () => {
    const input = { updated_at: '2026-09-04T10:55:44.000000+00:00' };
    expect(normalizeNaiveUtcDates(input)).toEqual(input);
  });

  it('leaves non-datetime text untouched even under *_at keys', () => {
    const input = { generated_at: 'not a timestamp', code_at: '2026-09-04T10:55:44 is literal code' };
    expect(normalizeNaiveUtcDates(input)).toEqual(input);
  });

  it('recurses into nested objects and arrays', () => {
    const input = {
      items: [{ started_at: '2026-09-04T10:55:44' }, { nested: { verified_at: '2026-09-04T11:00:00' } }],
    };
    expect(normalizeNaiveUtcDates(input)).toEqual({
      items: [{ started_at: '2026-09-04T10:55:44Z' }, { nested: { verified_at: '2026-09-04T11:00:00Z' } }],
    });
  });
});

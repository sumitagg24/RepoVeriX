import { AxiosError } from 'axios';
import { getApiErrorMessage } from '@/lib/api-error';

describe('getApiErrorMessage', () => {
  it('extracts the API detail message', () => {
    const error = new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
      status: 422,
      data: { detail: 'No deterministic repair applies' },
    } as never);
    expect(getApiErrorMessage(error)).toBe('No deterministic repair applies');
  });

  it('falls back to the axios message without a detail', () => {
    const error = new AxiosError('Network Error', 'ERR_NETWORK');
    expect(getApiErrorMessage(error)).toBe('Network Error');
  });

  it('handles plain errors', () => {
    expect(getApiErrorMessage(new Error('boom'))).toBe('boom');
  });
});

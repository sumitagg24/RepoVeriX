import { AxiosError } from 'axios';

/** Extract a human-readable message from an API error response. */
export function getApiErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as { detail?: unknown } | undefined;
    if (typeof data?.detail === 'string') {
      return data.detail;
    }
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

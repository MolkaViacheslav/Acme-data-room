import { getApiBaseUrl } from '@/lib/env';

import { ApiError, NETWORK_ERROR_STATUS, apiFetch, describeError } from './client';
import type { HealthResponse } from './types';

export type ApiStatus =
  | { readonly state: 'reachable' }
  | { readonly state: 'unreachable'; readonly reason: string };

/**
 * Used by the deploy smoke check: proves the browser-facing origin can reach
 * the API over HTTPS with CORS configured correctly.
 */
export async function checkApiHealth(): Promise<ApiStatus> {
  try {
    const health = await apiFetch<HealthResponse>('/health', { cache: 'no-store' });

    return health.ok
      ? { state: 'reachable' }
      : { state: 'unreachable', reason: 'The API answered, but did not report itself healthy.' };
  } catch (error) {
    return { state: 'unreachable', reason: describeHealthFailure(error) };
  }
}

/**
 * This is a diagnostics surface, so — unlike a user-facing toast — it names the
 * URL that failed and the setting that controls it.
 */
function describeHealthFailure(error: unknown): string {
  if (error instanceof ApiError && error.status === NETWORK_ERROR_STATUS) {
    return `No response from ${getApiBaseUrl()}. Check that the API is running and that NEXT_PUBLIC_API_URL points at it.`;
  }

  return describeError(error);
}

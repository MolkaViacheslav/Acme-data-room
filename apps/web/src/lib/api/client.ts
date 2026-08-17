import { getApiBaseUrl } from '@/lib/env';

/** `ApiError.status` when the request never got a response at all. */
export const NETWORK_ERROR_STATUS = 0;

/** A failed API call, carrying a message that is safe to show a user. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** The error envelope NestJS produces for thrown HTTP exceptions. */
interface ApiErrorBody {
  readonly message?: string | readonly string[];
  readonly error?: string;
}

function readErrorMessage(body: unknown, status: number): string {
  if (typeof body === 'object' && body !== null) {
    const { message, error } = body as ApiErrorBody;

    if (typeof message === 'string' && message.length > 0) return message;
    if (Array.isArray(message) && message.length > 0) return message.join(', ');
    if (typeof error === 'string' && error.length > 0) return error;
  }

  return `The server responded with status ${status}.`;
}

/**
 * Single entry point for API calls. Always sends the auth cookie, and always
 * fails with an `ApiError` whose message can go straight into a toast — the
 * raw `TypeError: fetch failed` never reaches the UI.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      credentials: 'include',
      headers: { Accept: 'application/json', ...init.headers },
    });
  } catch {
    // No HTTP response: server down, DNS failure, or a blocked CORS preflight.
    throw new ApiError(
      NETWORK_ERROR_STATUS,
      'Could not reach the server. Check your connection and try again.',
    );
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(response.status, readErrorMessage(body, response.status));
  }

  // The API is the schema authority here; `types.ts` mirrors its DTOs.
  return body as T;
}

/** Turns anything thrown during a request into one human-readable sentence. */
export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Something went wrong.';
}

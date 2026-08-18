import { getApiBaseUrl } from '@/lib/env';

/** `ApiError.status` when the request never got a response at all. */
export const NETWORK_ERROR_STATUS = 0;

/** A failed API call, carrying a message that is safe to show a user. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** The parsed response body, for errors that carry more than a sentence. */
    readonly body: unknown = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * The alternative name the API offers when one is already taken, so a rename
 * can suggest "report (2).pdf" instead of only reporting failure.
 */
export function suggestedNameFrom(error: unknown): string | null {
  if (!(error instanceof ApiError) || typeof error.body !== 'object' || error.body === null) {
    return null;
  }

  const { suggestedName } = error.body as { suggestedName?: unknown };

  return typeof suggestedName === 'string' && suggestedName !== '' ? suggestedName : null;
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
    throw new ApiError(response.status, readErrorMessage(body, response.status), body);
  }

  // The API is the schema authority here; `types.ts` mirrors its DTOs.
  return body as T;
}

/** Turns anything thrown during a request into one human-readable sentence. */
export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Something went wrong.';
}

/**
 * The machine-readable reason the API attached to a refusal.
 *
 * Only present when the caller is entitled to know — someone holding the exact
 * share link. Everyone else gets a bare 404 with nothing to read here.
 */
export function refusalReasonFrom(error: unknown): string | null {
  if (!(error instanceof ApiError) || typeof error.body !== 'object' || error.body === null) {
    return null;
  }

  const { reason } = error.body as { reason?: unknown };

  return typeof reason === 'string' && reason !== '' ? reason : null;
}

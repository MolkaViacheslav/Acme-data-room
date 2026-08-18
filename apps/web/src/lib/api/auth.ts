import { ApiError, apiFetch } from './client';
import type { AuthUser, LoginRequest, RegisterRequest } from './types';

export function register(body: RegisterRequest): Promise<AuthUser> {
  return apiFetch<AuthUser>('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function login(body: LoginRequest): Promise<AuthUser> {
  return apiFetch<AuthUser>('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function logout(): Promise<void> {
  return apiFetch<void>('/auth/logout', { method: 'POST' });
}

export function fetchCurrentUser(): Promise<AuthUser> {
  return apiFetch<AuthUser>('/auth/me', { cache: 'no-store' });
}

export const SESSION_NOT_KEPT =
  'Signed in, but your browser did not keep the session. This usually means third-party cookies are blocked — allow them for this site, or open the link in a normal window.';

/**
 * Signs in, then proves the session actually survived the round trip.
 *
 * The API sets the cookie on its own origin, which is a *third-party* cookie
 * from the frontend's point of view. A browser that blocks those — Chrome
 * incognito does by default — accepts the login response and silently discards
 * the cookie. Trusting the response body alone therefore produced a signed-in
 * UI on top of an anonymous session: every later request came back 401, and a
 * share link kept asking to sign in after signing in.
 *
 * Confirming with `/auth/me` turns that into one clear message instead.
 */
async function confirmSession(): Promise<AuthUser> {
  try {
    return await fetchCurrentUser();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      throw new ApiError(401, SESSION_NOT_KEPT);
    }
    throw error;
  }
}

export async function loginAndConfirm(body: LoginRequest): Promise<AuthUser> {
  await login(body);

  return confirmSession();
}

export async function registerAndConfirm(body: RegisterRequest): Promise<AuthUser> {
  await register(body);

  return confirmSession();
}

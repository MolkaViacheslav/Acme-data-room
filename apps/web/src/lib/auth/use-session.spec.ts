import { ApiError } from '@/lib/api/client';
import type { AuthUser } from '@/lib/api/types';

import { resolveSession } from './use-session';

const USER = {
  id: 'u1',
  email: 'ada@example.com',
  name: 'Ada',
  dataRoom: { id: 'r1', name: 'Room', rootFolderId: 'f1' },
} satisfies AuthUser;

describe('resolveSession', () => {
  it('reports the signed-in user', () => {
    expect(resolveSession({ data: USER, error: null })).toEqual({ user: USER, error: null });
  });

  it('reports nobody before anything has loaded', () => {
    expect(resolveSession({ data: undefined, error: null }).user).toBeNull();
  });

  /**
   * The redirect loop: React Query keeps the last successful data when a
   * refetch fails, so the session query can hold a user *and* a 401 at once.
   * Anything redirecting on "there is a user" then bounces against anything
   * redirecting on "not authorised", re-requesting both endpoints about once a
   * second. A 401 has to win.
   */
  it('treats a 401 as signed out even while stale data is still cached', () => {
    const resolved = resolveSession({ data: USER, error: new ApiError(401, 'nope') });

    expect(resolved.user).toBeNull();
  });

  it('does not surface a 401 as an error to display', () => {
    // Being signed out is a state, not a failure worth a retry button.
    expect(resolveSession({ data: USER, error: new ApiError(401, 'nope') }).error).toBeNull();
  });

  it('keeps a real failure visible, and the cached user with it', () => {
    const outage = new ApiError(503, 'down');
    const resolved = resolveSession({ data: USER, error: outage });

    expect(resolved.error).toBe(outage);
    expect(resolved.user).toBe(USER);
  });
});

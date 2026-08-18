import { shareHref, shareSignInHref } from './share-href';

describe('shareHref', () => {
  it('addresses the share itself when no folder is open', () => {
    expect(shareHref('tok')).toBe('/share/tok');
  });

  it('addresses the folder being browsed', () => {
    expect(shareHref('tok', 'folder-1')).toBe('/share/tok/folder-1');
  });
});

/**
 * The reported bug: clicking "Sign in" on a restricted share sent the visitor
 * to /login?next=/d/<folderId> — the owner-facing route, with the token gone —
 * so signing in could never return them to the link they were given.
 */
describe('shareSignInHref', () => {
  it('returns to the folder inside the share, token intact', () => {
    expect(shareSignInHref('tok', 'folder-1')).toBe('/login?next=%2Fshare%2Ftok%2Ffolder-1');
  });

  it('returns to the share root when no folder is open', () => {
    expect(shareSignInHref('tok')).toBe('/login?next=%2Fshare%2Ftok');
  });

  it('never points at the owner-facing route', () => {
    expect(shareSignInHref('tok', 'folder-1')).not.toContain('%2Fd%2F');
  });

  it('keeps the token, which is the whole point', () => {
    expect(shareSignInHref('a-real-token', 'folder-1')).toContain('a-real-token');
  });
});

import type { AccessActor, AccessRequest, ResourceLocator, ShareCandidate } from './access.types';
import { decideAccess } from './decide-access';

const NOW = new Date('2026-08-17T12:00:00.000Z');
const HOUR = 60 * 60 * 1000;

const DATA_ROOM_ID = 'room-1';
const OWNER_ID = 'user-owner';

const OWNER: AccessActor = { id: OWNER_ID, email: 'owner@example.com' };
const INVITEE: AccessActor = { id: 'user-invitee', email: 'invitee@example.com' };
const STRANGER: AccessActor = { id: 'user-stranger', email: 'stranger@example.com' };

/**
 * A three-level tree. Paths are what ancestry is decided on, so they are
 * spelled out rather than generated.
 *
 *   /root/                     root folder
 *   /root/legal/               folder
 *   /root/legal/contracts/     folder, holds the file
 *   /root/legalese/            sibling whose id shares a prefix with "legal"
 */
const ROOT_PATH = '/root/';
const LEGAL_PATH = '/root/legal/';
const CONTRACTS_PATH = '/root/legal/contracts/';
const LEGALESE_PATH = '/root/legalese/';

const dataRoomResource: ResourceLocator = {
  type: 'DATA_ROOM',
  id: DATA_ROOM_ID,
  dataRoomId: DATA_ROOM_ID,
  path: ROOT_PATH,
};

const contractsFolder: ResourceLocator = {
  type: 'FOLDER',
  id: 'folder-contracts',
  dataRoomId: DATA_ROOM_ID,
  path: CONTRACTS_PATH,
};

const legaleseFolder: ResourceLocator = {
  type: 'FOLDER',
  id: 'folder-legalese',
  dataRoomId: DATA_ROOM_ID,
  path: LEGALESE_PATH,
};

const contractFile: ResourceLocator = {
  type: 'FILE',
  id: 'file-msa',
  dataRoomId: DATA_ROOM_ID,
  // A file's path is the path of the folder holding it.
  path: CONTRACTS_PATH,
};

function share(overrides: Partial<ShareCandidate> = {}): ShareCandidate {
  return {
    id: 'share-1',
    dataRoomId: DATA_ROOM_ID,
    resourceType: 'FOLDER',
    resourceId: 'folder-legal',
    folderPath: LEGAL_PATH,
    mode: 'RESTRICTED',
    role: 'VIEWER',
    token: null,
    expiresAt: null,
    revokedAt: null,
    recipients: [{ email: INVITEE.email, userId: INVITEE.id }],
    ...overrides,
  };
}

function request(overrides: Partial<AccessRequest> = {}): AccessRequest {
  return {
    actor: STRANGER,
    dataRoomOwnerId: OWNER_ID,
    resource: contractsFolder,
    shares: [],
    presentedToken: null,
    now: NOW,
    ...overrides,
  };
}

describe('decideAccess — the seven scenarios from the plan', () => {
  it('1. owner of the data room', () => {
    expect(decideAccess(request({ actor: OWNER }))).toEqual({ role: 'OWNER' });
  });

  it('2. direct share on the resource itself', () => {
    const decision = decideAccess(
      request({
        actor: INVITEE,
        resource: contractsFolder,
        shares: [
          share({
            id: 'share-direct',
            resourceId: contractsFolder.id,
            folderPath: CONTRACTS_PATH,
          }),
        ],
      }),
    );

    expect(decision).toEqual({ role: 'VIEWER', viaShareId: 'share-direct' });
  });

  it('3. inherited share via an ancestor folder', () => {
    const decision = decideAccess(
      request({
        actor: INVITEE,
        // The file lives two levels below the shared folder.
        resource: contractFile,
        shares: [share({ id: 'share-ancestor', folderPath: LEGAL_PATH })],
      }),
    );

    expect(decision).toEqual({ role: 'VIEWER', viaShareId: 'share-ancestor' });
  });

  it('4. revoked share', () => {
    const decision = decideAccess(
      request({
        actor: INVITEE,
        shares: [share({ revokedAt: new Date(NOW.getTime() - HOUR) })],
      }),
    );

    expect(decision).toEqual({ role: 'NONE', reason: 'SHARE_REVOKED' });
  });

  it('5. expired share', () => {
    const decision = decideAccess(
      request({
        actor: INVITEE,
        shares: [share({ expiresAt: new Date(NOW.getTime() - 1) })],
      }),
    );

    expect(decision).toEqual({ role: 'NONE', reason: 'SHARE_EXPIRED' });
  });

  it('6. wrong token on a public link', () => {
    const decision = decideAccess(
      request({
        actor: null,
        presentedToken: 'not-the-right-token-000',
        shares: [share({ mode: 'PUBLIC_LINK', token: 'the-real-token-abc123', recipients: [] })],
      }),
    );

    expect(decision).toEqual({ role: 'NONE', reason: 'TOKEN_MISMATCH' });
  });

  it('7. a complete stranger', () => {
    const decision = decideAccess(
      request({
        actor: STRANGER,
        shares: [share()],
      }),
    );

    expect(decision).toEqual({ role: 'NONE', reason: 'NOT_A_RECIPIENT' });
  });
});

describe('decideAccess — ancestry over materialized paths', () => {
  it('does not let a folder share reach a sibling whose id shares a prefix', () => {
    // "/root/legal/" must not match "/root/legalese/". The trailing slash is
    // the only thing standing between these two subtrees.
    const decision = decideAccess(
      request({
        actor: INVITEE,
        resource: legaleseFolder,
        shares: [share({ folderPath: LEGAL_PATH })],
      }),
    );

    expect(decision).toEqual({ role: 'NONE', reason: 'NO_MATCHING_SHARE' });
  });

  it('refuses a shared path that is missing its trailing slash', () => {
    const decision = decideAccess(
      request({
        actor: INVITEE,
        resource: contractsFolder,
        shares: [share({ folderPath: '/root/legal' })],
      }),
    );

    expect(decision).toEqual({ role: 'NONE', reason: 'NO_MATCHING_SHARE' });
  });

  it('refuses a resource path that is missing its leading slash', () => {
    const decision = decideAccess(
      request({
        actor: INVITEE,
        resource: { ...contractsFolder, path: 'root/legal/contracts/' },
        shares: [share({ folderPath: LEGAL_PATH })],
      }),
    );

    expect(decision).toEqual({ role: 'NONE', reason: 'NO_MATCHING_SHARE' });
  });

  it('treats a folder share as covering the folder itself', () => {
    const decision = decideAccess(
      request({
        actor: INVITEE,
        resource: { ...contractsFolder, id: 'folder-legal', path: LEGAL_PATH },
        shares: [share({ folderPath: LEGAL_PATH })],
      }),
    );

    expect(decision).toMatchObject({ role: 'VIEWER' });
  });

  it('does not walk upwards: a share on a child does not open its parent', () => {
    const decision = decideAccess(
      request({
        actor: INVITEE,
        resource: { ...contractsFolder, id: 'folder-legal', path: LEGAL_PATH },
        shares: [share({ resourceId: 'folder-contracts', folderPath: CONTRACTS_PATH })],
      }),
    );

    expect(decision).toEqual({ role: 'NONE', reason: 'NO_MATCHING_SHARE' });
  });
});

describe('decideAccess — scope of a share', () => {
  it('a data-room share covers a file inside it', () => {
    const decision = decideAccess(
      request({
        actor: INVITEE,
        resource: contractFile,
        shares: [
          share({
            resourceType: 'DATA_ROOM',
            resourceId: DATA_ROOM_ID,
            folderPath: null,
          }),
        ],
      }),
    );

    expect(decision).toMatchObject({ role: 'VIEWER' });
  });

  it('a folder share does not grant the data room entity', () => {
    const decision = decideAccess(
      request({
        actor: INVITEE,
        resource: dataRoomResource,
        // The share is on the root folder, whose path is the room's own path.
        shares: [share({ resourceId: 'folder-root', folderPath: ROOT_PATH })],
      }),
    );

    expect(decision).toEqual({ role: 'NONE', reason: 'NO_MATCHING_SHARE' });
  });

  it('a file share covers only that file', () => {
    const decision = decideAccess(
      request({
        actor: INVITEE,
        resource: contractFile,
        shares: [share({ resourceType: 'FILE', resourceId: contractFile.id, folderPath: null })],
      }),
    );

    expect(decision).toMatchObject({ role: 'VIEWER' });
  });

  it('a file share does not grant the folder holding it', () => {
    const decision = decideAccess(
      request({
        actor: INVITEE,
        resource: contractsFolder,
        shares: [share({ resourceType: 'FILE', resourceId: contractFile.id, folderPath: null })],
      }),
    );

    expect(decision).toEqual({ role: 'NONE', reason: 'NO_MATCHING_SHARE' });
  });

  it('a file share does not grant a different file', () => {
    const decision = decideAccess(
      request({
        actor: INVITEE,
        resource: { ...contractFile, id: 'file-other' },
        shares: [share({ resourceType: 'FILE', resourceId: 'file-msa', folderPath: null })],
      }),
    );

    expect(decision).toEqual({ role: 'NONE', reason: 'NO_MATCHING_SHARE' });
  });

  it('a share from another data room grants nothing', () => {
    const decision = decideAccess(
      request({
        actor: INVITEE,
        resource: contractsFolder,
        shares: [share({ dataRoomId: 'room-someone-else', folderPath: LEGAL_PATH })],
      }),
    );

    expect(decision).toEqual({ role: 'NONE', reason: 'NO_MATCHING_SHARE' });
  });
});

describe('decideAccess — public links', () => {
  const publicShare = (overrides: Partial<ShareCandidate> = {}) =>
    share({ mode: 'PUBLIC_LINK', token: 'the-real-token-abc123', recipients: [], ...overrides });

  it('lets an anonymous visitor in with the right token', () => {
    const decision = decideAccess(
      request({
        actor: null,
        presentedToken: 'the-real-token-abc123',
        shares: [publicShare()],
      }),
    );

    expect(decision).toMatchObject({ role: 'VIEWER' });
  });

  it('asks for a token when none was presented', () => {
    const decision = decideAccess(
      request({ actor: null, presentedToken: null, shares: [publicShare()] }),
    );

    expect(decision).toEqual({ role: 'NONE', reason: 'TOKEN_REQUIRED' });
  });

  it('treats an empty presented token as no token', () => {
    const decision = decideAccess(
      request({ actor: null, presentedToken: '', shares: [publicShare()] }),
    );

    expect(decision).toEqual({ role: 'NONE', reason: 'TOKEN_REQUIRED' });
  });

  it('never matches a null stored token against a null presented token', () => {
    // The bug this guards against: `share.token === presentedToken` where both
    // are null would hand out access to a malformed share.
    const decision = decideAccess(
      request({ actor: null, presentedToken: null, shares: [publicShare({ token: null })] }),
    );

    expect(decision).toEqual({ role: 'NONE', reason: 'TOKEN_MISMATCH' });
  });

  it('rejects a token that is a prefix of the real one', () => {
    const decision = decideAccess(
      request({
        actor: null,
        presentedToken: 'the-real-token',
        shares: [publicShare()],
      }),
    );

    expect(decision).toEqual({ role: 'NONE', reason: 'TOKEN_MISMATCH' });
  });

  it('is case sensitive about tokens', () => {
    const decision = decideAccess(
      request({
        actor: null,
        presentedToken: 'THE-REAL-TOKEN-ABC123',
        shares: [publicShare()],
      }),
    );

    expect(decision).toEqual({ role: 'NONE', reason: 'TOKEN_MISMATCH' });
  });

  it('still refuses a correct token once the share is revoked', () => {
    const decision = decideAccess(
      request({
        actor: null,
        presentedToken: 'the-real-token-abc123',
        shares: [publicShare({ revokedAt: NOW })],
      }),
    );

    expect(decision).toEqual({ role: 'NONE', reason: 'SHARE_REVOKED' });
  });

  it('still refuses a correct token once the share has expired', () => {
    const decision = decideAccess(
      request({
        actor: null,
        presentedToken: 'the-real-token-abc123',
        shares: [publicShare({ expiresAt: new Date(NOW.getTime() - 1) })],
      }),
    );

    expect(decision).toEqual({ role: 'NONE', reason: 'SHARE_EXPIRED' });
  });
});

describe('decideAccess — restricted shares', () => {
  it('matches a recipient by user id', () => {
    const decision = decideAccess(
      request({
        actor: INVITEE,
        shares: [share({ recipients: [{ email: 'stale@example.com', userId: INVITEE.id }] })],
      }),
    );

    expect(decision).toMatchObject({ role: 'VIEWER' });
  });

  it('matches by email for someone invited before they registered', () => {
    const decision = decideAccess(
      request({
        actor: INVITEE,
        // userId is still null: the invitation predates the account.
        shares: [share({ recipients: [{ email: INVITEE.email, userId: null }] })],
      }),
    );

    expect(decision).toMatchObject({ role: 'VIEWER' });
  });

  it('ignores case and surrounding space in emails', () => {
    const decision = decideAccess(
      request({
        actor: { ...INVITEE, email: '  INVITEE@Example.COM ' },
        shares: [share({ recipients: [{ email: 'invitee@example.com', userId: null }] })],
      }),
    );

    expect(decision).toMatchObject({ role: 'VIEWER' });
  });

  it('refuses an anonymous caller even with a token in hand', () => {
    const decision = decideAccess(
      request({
        actor: null,
        presentedToken: 'any-token-at-all-xyz',
        shares: [share()],
      }),
    );

    expect(decision).toEqual({ role: 'NONE', reason: 'NOT_A_RECIPIENT' });
  });

  it('refuses a signed-in stranger who is not named on the share', () => {
    const decision = decideAccess(request({ actor: STRANGER, shares: [share()] }));

    expect(decision).toEqual({ role: 'NONE', reason: 'NOT_A_RECIPIENT' });
  });
});

describe('decideAccess — expiry boundary', () => {
  it('treats a share expiring exactly now as expired', () => {
    const decision = decideAccess(
      request({ actor: INVITEE, shares: [share({ expiresAt: new Date(NOW.getTime()) })] }),
    );

    expect(decision).toEqual({ role: 'NONE', reason: 'SHARE_EXPIRED' });
  });

  it('allows a share expiring one millisecond from now', () => {
    const decision = decideAccess(
      request({ actor: INVITEE, shares: [share({ expiresAt: new Date(NOW.getTime() + 1) })] }),
    );

    expect(decision).toMatchObject({ role: 'VIEWER' });
  });

  it('treats a future revocation timestamp as already revoked', () => {
    // Revocation is a fact, not a schedule. Comparing it to the clock would
    // leave a window in which a revoked share still works.
    const decision = decideAccess(
      request({
        actor: INVITEE,
        shares: [share({ revokedAt: new Date(NOW.getTime() + HOUR) })],
      }),
    );

    expect(decision).toEqual({ role: 'NONE', reason: 'SHARE_REVOKED' });
  });
});

describe('decideAccess — precedence between several shares', () => {
  it('lets a live share win over a revoked one on the same resource', () => {
    const decision = decideAccess(
      request({
        actor: INVITEE,
        shares: [share({ id: 'share-revoked', revokedAt: NOW }), share({ id: 'share-live' })],
      }),
    );

    expect(decision).toEqual({ role: 'VIEWER', viaShareId: 'share-live' });
  });

  it('reports the most informative refusal when every share refuses', () => {
    const decision = decideAccess(
      request({
        actor: INVITEE,
        shares: [
          share({ id: 'share-expired', expiresAt: new Date(NOW.getTime() - HOUR) }),
          share({ id: 'share-revoked', revokedAt: NOW }),
        ],
      }),
    );

    expect(decision).toEqual({ role: 'NONE', reason: 'SHARE_REVOKED' });
  });

  it('does not report a refusal from a share that covers something else', () => {
    // The revoked share is on an unrelated subtree, so the answer must be
    // "no such thing", not "that was revoked".
    const decision = decideAccess(
      request({
        actor: INVITEE,
        resource: legaleseFolder,
        shares: [share({ id: 'share-elsewhere', revokedAt: NOW, folderPath: LEGAL_PATH })],
      }),
    );

    expect(decision).toEqual({ role: 'NONE', reason: 'NO_MATCHING_SHARE' });
  });

  it('gives the owner access regardless of revoked and expired shares', () => {
    const decision = decideAccess(
      request({
        actor: OWNER,
        shares: [
          share({ revokedAt: NOW }),
          share({ id: 'share-expired', expiresAt: new Date(NOW.getTime() - HOUR) }),
        ],
      }),
    );

    expect(decision).toEqual({ role: 'OWNER' });
  });

  it('does not treat an anonymous caller as the owner', () => {
    // Guards against a null actor comparing equal to a null owner id.
    const decision = decideAccess(request({ actor: null, dataRoomOwnerId: OWNER_ID }));

    expect(decision).toEqual({ role: 'NONE', reason: 'NO_MATCHING_SHARE' });
  });
});

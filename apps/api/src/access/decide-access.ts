import type {
  AccessActor,
  AccessDecision,
  AccessRequest,
  DenialReason,
  ResourceLocator,
  ShareCandidate,
} from './access.types';

/**
 * The whole authorization decision for this app, as one pure function.
 *
 * It takes no database and no clock: everything it needs is passed in, so every
 * branch below is reachable from a test without standing up infrastructure.
 * `AccessService` is only responsible for fetching the inputs.
 *
 * Resolution order, as specified in docs/PLAN.md:
 *   1. owner of the resource's data room  -> OWNER
 *   2. a live share on the resource or an ancestor of it -> VIEWER
 *   3. otherwise -> NONE
 */
export function decideAccess(request: AccessRequest): AccessDecision {
  const { actor, dataRoomOwnerId, resource, shares, presentedToken, now } = request;

  // The owner's access does not depend on any share, so a revoked or expired
  // share can never lock an owner out of their own data room.
  if (actor !== null && actor.id === dataRoomOwnerId) {
    return { role: 'OWNER' };
  }

  let denial: DenialReason = 'NO_MATCHING_SHARE';

  for (const share of shares) {
    // A share that does not cover this resource says nothing about it —
    // not even that it was revoked.
    if (!shareCoversResource(share, resource)) continue;

    const outcome = evaluateShare(share, { actor, presentedToken, now });

    if (outcome.granted) {
      // One live share is enough; a revoked sibling share cannot take it away.
      //
      // The role comes from the share rather than being hard-coded, so adding
      // EDITOR to the enum breaks the build here — at the one place that has to
      // decide what an editor may do — instead of silently handing out VIEWER.
      return { role: share.role, viaShareId: share.id };
    }

    denial = mostInformative(denial, outcome.reason);
  }

  return { role: 'NONE', reason: denial };
}

/**
 * Does this share say anything at all about this resource?
 *
 * Scope by share type:
 * - `DATA_ROOM` covers everything in that data room
 * - `FOLDER` covers that folder and everything beneath it, but never the data
 *   room entity itself
 * - `FILE` covers exactly that one file
 */
function shareCoversResource(share: ShareCandidate, resource: ResourceLocator): boolean {
  // Defense in depth. The query already filters by data room; if that ever
  // stops being true, a share must still not reach across rooms.
  if (share.dataRoomId !== resource.dataRoomId) return false;

  switch (share.resourceType) {
    case 'DATA_ROOM':
      return share.resourceId === resource.dataRoomId;

    case 'FOLDER':
      // Sharing the root folder shares its contents, not the room entity.
      if (resource.type === 'DATA_ROOM') return false;
      if (share.folderPath === null) return false;
      return isPathAncestorOrSelf(share.folderPath, resource.path);

    case 'FILE':
      return resource.type === 'FILE' && share.resourceId === resource.id;
  }
}

/**
 * Prefix match over materialized paths.
 *
 * Both paths must be `/<id>/<id>/…/` — bounded by slashes at both ends. That
 * trailing slash is the entire safety property: without it `/root/ab` would
 * match `/root/abc/` and leak a sibling subtree. A path that does not have it
 * is treated as malformed and matches nothing, rather than being repaired.
 */
function isPathAncestorOrSelf(ancestorPath: string, descendantPath: string): boolean {
  if (!isWellFormedPath(ancestorPath) || !isWellFormedPath(descendantPath)) return false;

  return descendantPath.startsWith(ancestorPath);
}

function isWellFormedPath(path: string): boolean {
  return path.startsWith('/') && path.endsWith('/') && path.length > 1;
}

interface ShareContext {
  readonly actor: AccessActor | null;
  readonly presentedToken: string | null;
  readonly now: Date;
}

type ShareOutcome = { granted: true } | { granted: false; reason: DenialReason };

function evaluateShare(share: ShareCandidate, context: ShareContext): ShareOutcome {
  // Revocation is immediate and final: any timestamp at all means revoked.
  // Comparing it against the clock would open a window where a revoked share
  // still works.
  if (share.revokedAt !== null) {
    return { granted: false, reason: 'SHARE_REVOKED' };
  }

  // A share expiring exactly now is expired.
  if (share.expiresAt !== null && share.expiresAt.getTime() <= context.now.getTime()) {
    return { granted: false, reason: 'SHARE_EXPIRED' };
  }

  if (share.mode === 'PUBLIC_LINK') {
    return evaluatePublicLink(share, context);
  }

  return evaluateRestricted(share, context);
}

function evaluatePublicLink(share: ShareCandidate, context: ShareContext): ShareOutcome {
  // A public-link share with no token is malformed. Falling through would let
  // a caller who also presents nothing match null against null.
  if (share.token === null || share.token === '') {
    return { granted: false, reason: 'TOKEN_MISMATCH' };
  }

  if (context.presentedToken === null || context.presentedToken === '') {
    return { granted: false, reason: 'TOKEN_REQUIRED' };
  }

  if (!constantTimeEquals(share.token, context.presentedToken)) {
    return { granted: false, reason: 'TOKEN_MISMATCH' };
  }

  return { granted: true };
}

function evaluateRestricted(share: ShareCandidate, context: ShareContext): ShareOutcome {
  const { actor } = context;

  // A restricted share names people. An anonymous caller is nobody, and no
  // token can stand in for being named.
  if (actor === null) {
    return { granted: false, reason: 'NOT_A_RECIPIENT' };
  }

  const actorEmail = normalizeEmail(actor.email);

  const isRecipient = share.recipients.some(
    (recipient) =>
      // `userId` is filled once an invitee has an account; matching on email as
      // well is what makes an invitation sent before registration still work.
      (recipient.userId !== null && recipient.userId === actor.id) ||
      normalizeEmail(recipient.email) === actorEmail,
  );

  return isRecipient ? { granted: true } : { granted: false, reason: 'NOT_A_RECIPIENT' };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Compares in time proportional to the length of the input rather than to the
 * length of the matching prefix, so a caller cannot discover a token one
 * character at a time. Length itself is not hidden; the tokens are fixed-width.
 */
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return difference === 0;
}

/**
 * When several shares all refuse, report the one that tells the caller the most.
 * "This link was revoked" is more useful than "no such thing", and — because
 * the tests assert on the reason — it also keeps each refusal case honest.
 */
const DENIAL_RANK: Record<DenialReason, number> = {
  SHARE_REVOKED: 5,
  SHARE_EXPIRED: 4,
  TOKEN_REQUIRED: 3,
  TOKEN_MISMATCH: 2,
  NOT_A_RECIPIENT: 1,
  NO_MATCHING_SHARE: 0,
};

function mostInformative(current: DenialReason, candidate: DenialReason): DenialReason {
  return DENIAL_RANK[candidate] > DENIAL_RANK[current] ? candidate : current;
}

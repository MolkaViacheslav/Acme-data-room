export type ShareResourceType = 'DATA_ROOM' | 'FOLDER' | 'FILE';
export type ShareMode = 'PUBLIC_LINK' | 'RESTRICTED';
export type ShareRole = 'VIEWER';

export interface AccessActor {
  readonly id: string;
  readonly email: string;
}

/**
 * Where a resource sits, resolved before any decision is made.
 *
 * `path` is the materialized path used for ancestry:
 * - `FOLDER` — the folder's own path
 * - `FILE` — the path of the folder holding it
 * - `DATA_ROOM` — the root folder's path
 */
export interface ResourceLocator {
  readonly type: ShareResourceType;
  readonly id: string;
  readonly dataRoomId: string;
  readonly path: string;
}

export interface ShareRecipientCandidate {
  readonly email: string;
  readonly userId: string | null;
}

/**
 * A share as the decision function needs to see it — already joined with the
 * shared folder's path, because `Share` is polymorphic and carries no foreign
 * key it could be joined through in a query.
 */
export interface ShareCandidate {
  readonly id: string;
  readonly dataRoomId: string;
  readonly resourceType: ShareResourceType;
  readonly resourceId: string;
  /** Path of the shared folder. Only meaningful when `resourceType` is FOLDER. */
  readonly folderPath: string | null;
  readonly mode: ShareMode;
  readonly role: ShareRole;
  readonly token: string | null;
  readonly expiresAt: Date | null;
  readonly revokedAt: Date | null;
  readonly recipients: readonly ShareRecipientCandidate[];
}

export interface AccessRequest {
  /** `null` for an anonymous caller following a public link. */
  readonly actor: AccessActor | null;
  readonly dataRoomOwnerId: string;
  readonly resource: ResourceLocator;
  /** Every share in the resource's data room, revoked and expired included. */
  readonly shares: readonly ShareCandidate[];
  /** The `?token=` a public-link visitor presented, if any. */
  readonly presentedToken: string | null;
  readonly now: Date;
}

/**
 * Why access was refused.
 *
 * Carried so that callers can tell "this link was revoked" apart from "no such
 * thing", and so that the tests for those two cases cannot pass for the wrong
 * reason. Whether a given caller is allowed to *see* the distinction is the
 * caller's decision — `AccessService` answers 404 either way.
 */
export type DenialReason =
  | 'NO_MATCHING_SHARE'
  | 'SHARE_REVOKED'
  | 'SHARE_EXPIRED'
  | 'TOKEN_REQUIRED'
  | 'TOKEN_MISMATCH'
  | 'NOT_A_RECIPIENT';

/** A decision that let the caller through. */
export type GrantedAccess =
  { readonly role: 'OWNER' } | { readonly role: 'VIEWER'; readonly viaShareId: string };

export type AccessDecision =
  GrantedAccess | { readonly role: 'NONE'; readonly reason: DenialReason };

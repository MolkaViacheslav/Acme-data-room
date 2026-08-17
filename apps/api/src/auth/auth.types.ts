import type { Request } from 'express';

/** The signed-in caller, as resolved from the access token. */
export interface Actor {
  readonly id: string;
  readonly email: string;
}

/** Claims we put in the access token. Keep it minimal — it is not encrypted. */
export interface JwtPayload {
  /** User id. `sub` is the registered JWT claim for the subject. */
  readonly sub: string;
  readonly email: string;
}

export interface AuthenticatedRequest extends Request {
  user?: Actor;
}

/** Shape returned by every auth endpoint that answers with a user. */
export interface AuthUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly dataRoom: {
    readonly id: string;
    readonly name: string;
    readonly rootFolderId: string;
  };
}

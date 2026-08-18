import {
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { constantTimeEquals } from '../shared/constant-time-equals';

import type {
  AccessActor,
  AccessDecision,
  DenialReason,
  GrantedAccess,
  ResourceLocator,
  ShareCandidate,
  ShareResourceType,
} from './access.types';
import { decideAccess } from './decide-access';

interface LocatedResource {
  readonly resource: ResourceLocator;
  readonly dataRoomOwnerId: string;
}

export interface ResolveAccessOptions {
  /** The `?token=` a public-link visitor presented, if any. */
  readonly token?: string | null;
}

/**
 * The single place that decides whether an actor may read a resource.
 *
 * Its only job is to gather inputs; the decision itself is `decideAccess`, a
 * pure function with no database and no clock. Keeping the two apart is what
 * makes every branch of the policy testable — see `decide-access.spec.ts`.
 *
 * Never trust a client-supplied id. Every service method that touches a
 * resource goes through here first.
 */
@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveAccess(
    actor: AccessActor | null,
    resourceType: ShareResourceType,
    resourceId: string,
    options: ResolveAccessOptions = {},
  ): Promise<AccessDecision> {
    const evaluated = await this.evaluate(actor, resourceType, resourceId, options);

    // A resource that does not exist and a resource you may not see are
    // deliberately indistinguishable from here on.
    return evaluated?.decision ?? { role: 'NONE', reason: 'NO_MATCHING_SHARE' };
  }

  private async evaluate(
    actor: AccessActor | null,
    resourceType: ShareResourceType,
    resourceId: string,
    options: ResolveAccessOptions,
  ): Promise<{ decision: AccessDecision; shares: readonly ShareCandidate[] } | null> {
    const located = await this.locateResource(resourceType, resourceId);

    if (located === null) return null;

    const shares = await this.loadShareCandidates(located.resource.dataRoomId);

    const decision = decideAccess({
      actor,
      dataRoomOwnerId: located.dataRoomOwnerId,
      resource: located.resource,
      shares,
      presentedToken: options.token ?? null,
      now: new Date(),
    });

    return { decision, shares };
  }

  /**
   * As `resolveAccess`, but refuses instead of reporting refusal.
   *
   * Answers 404, never 403: an actor who may not see a resource must not learn
   * that it exists. The denial reason is deliberately not passed on here — a
   * caller that needs to tell "revoked" from "no such thing" has to ask for the
   * decision and decide for itself that showing the difference is safe.
   */
  async requireAccess(
    actor: AccessActor | null,
    resourceType: ShareResourceType,
    resourceId: string,
    options: ResolveAccessOptions = {},
  ): Promise<GrantedAccess> {
    const presentedToken = options.token ?? null;

    // Checked before the resource is even looked up, and deliberately so.
    // Deciding this afterwards would answer 401 for an id that exists and 404
    // for one that does not — handing an anonymous caller an oracle for whether
    // a resource exists, which is the precise thing the 404 rule prevents.
    if (actor === null && (presentedToken === null || presentedToken === '')) {
      throw new UnauthorizedException({
        reason: 'SIGN_IN_REQUIRED',
        message: 'You are not signed in.',
      });
    }

    const evaluated = await this.evaluate(actor, resourceType, resourceId, options);

    if (evaluated === null) throw new NotFoundException('Not found.');
    if (evaluated.decision.role !== 'NONE') return evaluated.decision;

    this.refuse(evaluated.decision.reason, evaluated.shares, actor, presentedToken);
  }

  /**
   * Turns a refusal into a response.
   *
   * Almost everyone gets a bare 404: someone who may not see a resource must
   * not learn it exists. The exception is a caller presenting a token that
   * exactly matches a real share — they were given that link, so telling them
   * it was revoked, has expired, or is addressed to a different account reveals
   * nothing they did not already hold, and it is the difference between a
   * usable message and a dead end.
   *
   * The comparison is constant-time so this cannot be used to discover a token.
   *
   * A held link only explains itself when it actually covers what was asked
   * for. `NO_MATCHING_SHARE` means no share said anything about this resource,
   * so a recipient who wanders outside what was shared with them gets a plain
   * 404 rather than being told, untruthfully, that the link is not theirs.
   */
  private refuse(
    reason: DenialReason,
    shares: readonly ShareCandidate[],
    actor: AccessActor | null,
    presentedToken: string | null,
  ): never {
    if (reason === 'NO_MATCHING_SHARE') {
      throw new NotFoundException('Not found.');
    }

    const held =
      presentedToken === null || presentedToken === ''
        ? undefined
        : shares.find(
            (share) =>
              share.token !== null &&
              share.token !== '' &&
              constantTimeEquals(share.token, presentedToken),
          );

    if (held !== undefined) {
      if (held.revokedAt !== null) {
        throw new GoneException({
          reason: 'REVOKED',
          message: 'Access to this item has been revoked.',
        });
      }

      if (held.expiresAt !== null && held.expiresAt.getTime() <= Date.now()) {
        throw new GoneException({ reason: 'EXPIRED', message: 'This link has expired.' });
      }

      if (held.mode === 'RESTRICTED') {
        // The link names people. Say which problem it is: not signed in at all,
        // or signed in as somebody who was not invited.
        throw actor === null
          ? new UnauthorizedException({
              reason: 'SIGN_IN_REQUIRED',
              message: 'Sign in to open this shared item.',
            })
          : new ForbiddenException({
              reason: 'NOT_INVITED',
              message: 'This link was shared with a different email address.',
            });
      }
    }

    throw new NotFoundException('Not found.');
  }

  /**
   * The threshold for anything that writes. Only the data room's owner may
   * create, rename, move or delete; every share is read-only today.
   *
   * Unlike `requireAccess` this answers 403, not 404 — a viewer who can already
   * read the resource plainly knows it exists, so hiding it would only be
   * confusing. The 404 rule protects actors who should not know at all, and
   * `requireAccess` has already applied it before we get here.
   */
  async requireOwner(
    actor: AccessActor | null,
    resourceType: ShareResourceType,
    resourceId: string,
    options: ResolveAccessOptions = {},
  ): Promise<void> {
    const decision = await this.requireAccess(actor, resourceType, resourceId, options);

    if (decision.role !== 'OWNER') {
      throw new ForbiddenException('You have read-only access to this item.');
    }
  }

  private async locateResource(
    resourceType: ShareResourceType,
    resourceId: string,
  ): Promise<LocatedResource | null> {
    switch (resourceType) {
      case 'DATA_ROOM':
        return this.locateDataRoom(resourceId);
      case 'FOLDER':
        return this.locateFolder(resourceId);
      case 'FILE':
        return this.locateFile(resourceId);
    }
  }

  private async locateDataRoom(id: string): Promise<LocatedResource | null> {
    const dataRoom = await this.prisma.dataRoom.findUnique({
      where: { id },
      select: { id: true, ownerId: true, rootFolder: { select: { path: true } } },
    });

    // A data room whose root folder is missing is unusable, not merely empty.
    if (dataRoom === null || dataRoom.rootFolder === null) return null;

    return {
      resource: {
        type: 'DATA_ROOM',
        id: dataRoom.id,
        dataRoomId: dataRoom.id,
        path: dataRoom.rootFolder.path,
      },
      dataRoomOwnerId: dataRoom.ownerId,
    };
  }

  private async locateFolder(id: string): Promise<LocatedResource | null> {
    const folder = await this.prisma.folder.findUnique({
      where: { id },
      select: {
        id: true,
        path: true,
        dataRoomId: true,
        dataRoom: { select: { ownerId: true } },
      },
    });

    if (folder === null) return null;

    return {
      resource: {
        type: 'FOLDER',
        id: folder.id,
        dataRoomId: folder.dataRoomId,
        path: folder.path,
      },
      dataRoomOwnerId: folder.dataRoom.ownerId,
    };
  }

  private async locateFile(id: string): Promise<LocatedResource | null> {
    const file = await this.prisma.file.findUnique({
      where: { id },
      select: {
        id: true,
        dataRoomId: true,
        folder: { select: { path: true } },
        dataRoom: { select: { ownerId: true } },
      },
    });

    if (file === null) return null;

    return {
      resource: {
        type: 'FILE',
        id: file.id,
        dataRoomId: file.dataRoomId,
        // A file inherits its position from the folder holding it.
        path: file.folder.path,
      },
      dataRoomOwnerId: file.dataRoom.ownerId,
    };
  }

  /**
   * Every share in the data room, revoked and expired ones included — the
   * decision function needs to see them to distinguish "revoked" from
   * "never shared".
   *
   * Folder shares carry no foreign key (`Share` is polymorphic), so their paths
   * come from a second lookup rather than a join.
   */
  private async loadShareCandidates(dataRoomId: string): Promise<ShareCandidate[]> {
    const shares = await this.prisma.share.findMany({
      where: { dataRoomId },
      select: {
        id: true,
        dataRoomId: true,
        resourceType: true,
        resourceId: true,
        mode: true,
        role: true,
        token: true,
        expiresAt: true,
        revokedAt: true,
        recipients: { select: { email: true, userId: true } },
      },
    });

    const folderPathById = await this.loadFolderPaths(
      dataRoomId,
      shares.filter((share) => share.resourceType === 'FOLDER').map((share) => share.resourceId),
    );

    return shares.map((share) => ({
      ...share,
      // Only folder shares carry a path. Leaving it null elsewhere keeps the
      // decision function from ever reading a path onto a share type whose
      // scope is decided by id.
      folderPath:
        share.resourceType === 'FOLDER' ? (folderPathById.get(share.resourceId) ?? null) : null,
    }));
  }

  private async loadFolderPaths(
    dataRoomId: string,
    folderIds: readonly string[],
  ): Promise<Map<string, string>> {
    if (folderIds.length === 0) return new Map();

    const folders = await this.prisma.folder.findMany({
      // Scoped to the data room as well as the ids: a share must not be able to
      // import a path from a folder in someone else's room.
      where: { id: { in: [...folderIds] }, dataRoomId },
      select: { id: true, path: true },
    });

    return new Map(folders.map((folder) => [folder.id, folder.path]));
  }
}

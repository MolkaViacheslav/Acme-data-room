import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { AccessService } from '../access/access.service';
import type { AccessActor, ShareResourceType } from '../access/access.types';
import { PrismaService } from '../prisma/prisma.service';

import type { CreateShareDto } from './dto/create-share.dto';
import { generateShareToken } from './share-token';
import type { SharedResource, ShareSummary } from './shares.types';

interface ShareRow {
  id: string;
  resourceType: ShareResourceType;
  resourceId: string;
  mode: 'PUBLIC_LINK' | 'RESTRICTED';
  token: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  recipients: { email: string }[];
}

function toSummary(share: ShareRow): ShareSummary {
  return {
    id: share.id,
    resourceType: share.resourceType,
    resourceId: share.resourceId,
    mode: share.mode,
    // Every share is created with one; the column is nullable only because the
    // schema predates that decision.
    token: share.token ?? '',
    recipientEmails: share.recipients.map((recipient) => recipient.email),
    expiresAt: share.expiresAt?.toISOString() ?? null,
    createdAt: share.createdAt.toISOString(),
  };
}

@Injectable()
export class SharesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async create(actor: AccessActor, dto: CreateShareDto): Promise<ShareSummary> {
    // Only the data room's owner may hand out access to anything in it.
    await this.access.requireOwner(actor, dto.resourceType, dto.resourceId);

    const recipientEmails = [...new Set(dto.recipientEmails ?? [])];

    if (dto.mode === 'RESTRICTED' && recipientEmails.length === 0) {
      throw new BadRequestException('Add at least one recipient, or share a public link instead.');
    }

    const expiresAt = this.readExpiry(dto.expiresAt);
    const dataRoomId = await this.dataRoomIdFor(dto.resourceType, dto.resourceId);

    // Recipients are matched by user id once they have an account; linking any
    // that already exist saves the email fallback a job.
    const existingUsers = await this.prisma.user.findMany({
      where: { email: { in: recipientEmails } },
      select: { id: true, email: true },
    });
    const userIdByEmail = new Map(existingUsers.map((user) => [user.email, user.id]));

    const share = await this.prisma.share.create({
      data: {
        resourceType: dto.resourceType,
        resourceId: dto.resourceId,
        dataRoomId,
        mode: dto.mode,
        token: generateShareToken(),
        createdById: actor.id,
        expiresAt,
        recipients: {
          create: recipientEmails.map((email) => ({
            email,
            userId: userIdByEmail.get(email) ?? null,
          })),
        },
      },
      select: {
        id: true,
        resourceType: true,
        resourceId: true,
        mode: true,
        token: true,
        expiresAt: true,
        createdAt: true,
        recipients: { select: { email: true } },
      },
    });

    return toSummary(share);
  }

  /** Live shares on one resource. Owner only. */
  async listForResource(
    actor: AccessActor,
    resourceType: ShareResourceType,
    resourceId: string,
  ): Promise<ShareSummary[]> {
    await this.access.requireOwner(actor, resourceType, resourceId);

    const shares = await this.prisma.share.findMany({
      where: { resourceType, resourceId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        resourceType: true,
        resourceId: true,
        mode: true,
        token: true,
        expiresAt: true,
        createdAt: true,
        recipients: { select: { email: true } },
      },
    });

    return shares.map(toSummary);
  }

  /**
   * Revocation is a timestamp, not a delete: the row is what lets a returning
   * recipient be told the link was revoked rather than that it never existed.
   */
  async revoke(actor: AccessActor, shareId: string): Promise<void> {
    const share = await this.prisma.share.findUnique({
      where: { id: shareId },
      select: { id: true, resourceType: true, resourceId: true, revokedAt: true },
    });

    if (share === null) throw new NotFoundException('Not found.');

    await this.access.requireOwner(actor, share.resourceType, share.resourceId);

    if (share.revokedAt !== null) return;

    await this.prisma.share.update({ where: { id: shareId }, data: { revokedAt: new Date() } });
  }

  /**
   * The entry point for `/share/<token>`: says what the link leads to.
   *
   * Access is resolved through `AccessService`, so a revoked, expired or
   * wrongly-addressed link produces the same considered answer here as it does
   * on every other route — 410, 401 or 403 for someone holding the link, and a
   * flat 404 for anyone else.
   */
  async resolveByToken(actor: AccessActor | null, token: string): Promise<SharedResource> {
    const share = await this.prisma.share.findUnique({
      where: { token },
      select: { resourceType: true, resourceId: true },
    });

    if (share === null) throw new NotFoundException('Not found.');

    await this.access.requireAccess(actor, share.resourceType, share.resourceId, { token });

    return this.describeResource(share.resourceType, share.resourceId);
  }

  private async describeResource(
    resourceType: ShareResourceType,
    resourceId: string,
  ): Promise<SharedResource> {
    if (resourceType === 'FILE') {
      const file = await this.prisma.file.findUnique({
        where: { id: resourceId },
        select: { id: true, name: true, dataRoom: { select: { name: true } } },
      });

      if (file === null) throw new NotFoundException('Not found.');

      return {
        resourceType,
        resourceId,
        name: file.name,
        dataRoomName: file.dataRoom.name,
        folderId: null,
        fileId: file.id,
      };
    }

    if (resourceType === 'FOLDER') {
      const folder = await this.prisma.folder.findUnique({
        where: { id: resourceId },
        select: { id: true, name: true, dataRoom: { select: { name: true } } },
      });

      if (folder === null) throw new NotFoundException('Not found.');

      return {
        resourceType,
        resourceId,
        name: folder.name,
        dataRoomName: folder.dataRoom.name,
        folderId: folder.id,
        fileId: null,
      };
    }

    const dataRoom = await this.prisma.dataRoom.findUnique({
      where: { id: resourceId },
      select: { id: true, name: true, rootFolderId: true },
    });

    if (dataRoom === null || dataRoom.rootFolderId === null)
      throw new NotFoundException('Not found.');

    return {
      resourceType,
      resourceId,
      name: dataRoom.name,
      dataRoomName: dataRoom.name,
      folderId: dataRoom.rootFolderId,
      fileId: null,
    };
  }

  private readExpiry(raw: string | undefined): Date | null {
    if (raw === undefined) return null;

    const expiresAt = new Date(raw);

    if (Number.isNaN(expiresAt.getTime())) {
      throw new BadRequestException('Expiry must be a date.');
    }
    if (expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('Expiry must be in the future.');
    }

    return expiresAt;
  }

  /** Taken from the resource, never from the request. */
  private async dataRoomIdFor(
    resourceType: ShareResourceType,
    resourceId: string,
  ): Promise<string> {
    if (resourceType === 'DATA_ROOM') return resourceId;

    if (resourceType === 'FOLDER') {
      const folder = await this.prisma.folder.findUniqueOrThrow({
        where: { id: resourceId },
        select: { dataRoomId: true },
      });

      return folder.dataRoomId;
    }

    const file = await this.prisma.file.findUniqueOrThrow({
      where: { id: resourceId },
      select: { dataRoomId: true },
    });

    return file.dataRoomId;
  }
}

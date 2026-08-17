import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';

import { AccessService } from './access.service';

/**
 * The policy itself is covered exhaustively in `decide-access.spec.ts`. What is
 * tested here is the wiring: that the right rows are fetched, scoped to the
 * right data room, and mapped onto the decision function's inputs — folder
 * paths in particular, which arrive from a separate lookup.
 */

const OWNER = { id: 'user-owner', email: 'owner@example.com' };
const STRANGER = { id: 'user-stranger', email: 'stranger@example.com' };
const INVITEE = { id: 'user-invitee', email: 'invitee@example.com' };

interface PrismaMock {
  dataRoom: { findUnique: jest.Mock };
  folder: { findUnique: jest.Mock; findMany: jest.Mock };
  file: { findUnique: jest.Mock };
  share: { findMany: jest.Mock };
}

function createPrismaMock(): PrismaMock {
  return {
    dataRoom: { findUnique: jest.fn().mockResolvedValue(null) },
    folder: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    file: { findUnique: jest.fn().mockResolvedValue(null) },
    share: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

async function createService(prisma: PrismaMock): Promise<AccessService> {
  const moduleRef = await Test.createTestingModule({
    providers: [AccessService, { provide: PrismaService, useValue: prisma }],
  }).compile();

  return moduleRef.get(AccessService);
}

describe('AccessService', () => {
  let prisma: PrismaMock;
  let service: AccessService;

  beforeEach(async () => {
    prisma = createPrismaMock();
    service = await createService(prisma);
  });

  it('reports a missing resource as a plain refusal, revealing nothing', async () => {
    await expect(service.resolveAccess(OWNER, 'FOLDER', 'does-not-exist')).resolves.toEqual({
      role: 'NONE',
      reason: 'NO_MATCHING_SHARE',
    });
  });

  it('recognises the data room owner through a folder', async () => {
    prisma.folder.findUnique.mockResolvedValue({
      id: 'folder-1',
      path: '/root/folder-1/',
      dataRoomId: 'room-1',
      dataRoom: { ownerId: OWNER.id },
    });

    await expect(service.resolveAccess(OWNER, 'FOLDER', 'folder-1')).resolves.toEqual({
      role: 'OWNER',
    });
  });

  it('gives a file the path of the folder holding it', async () => {
    prisma.file.findUnique.mockResolvedValue({
      id: 'file-1',
      dataRoomId: 'room-1',
      folder: { path: '/root/legal/' },
      dataRoom: { ownerId: OWNER.id },
    });
    prisma.share.findMany.mockResolvedValue([
      {
        id: 'share-1',
        dataRoomId: 'room-1',
        resourceType: 'FOLDER',
        resourceId: 'folder-legal',
        mode: 'RESTRICTED',
        role: 'VIEWER',
        token: null,
        expiresAt: null,
        revokedAt: null,
        recipients: [{ email: INVITEE.email, userId: INVITEE.id }],
      },
    ]);
    prisma.folder.findMany.mockResolvedValue([{ id: 'folder-legal', path: '/root/legal/' }]);

    // The share is on the folder; the file inherits access through its path.
    await expect(service.resolveAccess(INVITEE, 'FILE', 'file-1')).resolves.toMatchObject({
      role: 'VIEWER',
      viaShareId: 'share-1',
    });
  });

  it('looks up folder paths scoped to the data room, not by id alone', async () => {
    prisma.folder.findUnique.mockResolvedValue({
      id: 'folder-1',
      path: '/root/folder-1/',
      dataRoomId: 'room-1',
      dataRoom: { ownerId: OWNER.id },
    });
    prisma.share.findMany.mockResolvedValue([
      {
        id: 'share-1',
        dataRoomId: 'room-1',
        resourceType: 'FOLDER',
        resourceId: 'folder-elsewhere',
        mode: 'RESTRICTED',
        role: 'VIEWER',
        token: null,
        expiresAt: null,
        revokedAt: null,
        recipients: [],
      },
    ]);

    await service.resolveAccess(STRANGER, 'FOLDER', 'folder-1');

    expect(prisma.folder.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['folder-elsewhere'] }, dataRoomId: 'room-1' },
      select: { id: true, path: true },
    });
  });

  it("fetches shares scoped to the resource's data room", async () => {
    prisma.folder.findUnique.mockResolvedValue({
      id: 'folder-1',
      path: '/root/folder-1/',
      dataRoomId: 'room-1',
      dataRoom: { ownerId: OWNER.id },
    });

    await service.resolveAccess(STRANGER, 'FOLDER', 'folder-1');

    expect(prisma.share.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { dataRoomId: 'room-1' } }),
    );
  });

  it('does not ask for folder paths when no folder share exists', async () => {
    prisma.folder.findUnique.mockResolvedValue({
      id: 'folder-1',
      path: '/root/folder-1/',
      dataRoomId: 'room-1',
      dataRoom: { ownerId: OWNER.id },
    });
    prisma.share.findMany.mockResolvedValue([
      {
        id: 'share-1',
        dataRoomId: 'room-1',
        resourceType: 'FILE',
        resourceId: 'file-9',
        mode: 'RESTRICTED',
        role: 'VIEWER',
        token: null,
        expiresAt: null,
        revokedAt: null,
        recipients: [],
      },
    ]);

    await service.resolveAccess(STRANGER, 'FOLDER', 'folder-1');

    expect(prisma.folder.findMany).not.toHaveBeenCalled();
  });

  it('treats a data room without a root folder as unusable', async () => {
    prisma.dataRoom.findUnique.mockResolvedValue({
      id: 'room-1',
      ownerId: OWNER.id,
      rootFolder: null,
    });

    await expect(service.resolveAccess(OWNER, 'DATA_ROOM', 'room-1')).resolves.toEqual({
      role: 'NONE',
      reason: 'NO_MATCHING_SHARE',
    });
  });

  describe('requireAccess', () => {
    it('answers 404, not 403, when access is refused', async () => {
      prisma.folder.findUnique.mockResolvedValue({
        id: 'folder-1',
        path: '/root/folder-1/',
        dataRoomId: 'room-1',
        dataRoom: { ownerId: OWNER.id },
      });

      await expect(service.requireAccess(STRANGER, 'FOLDER', 'folder-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('does not leak the refusal reason in the message', async () => {
      prisma.folder.findUnique.mockResolvedValue({
        id: 'folder-1',
        path: '/root/folder-1/',
        dataRoomId: 'room-1',
        dataRoom: { ownerId: OWNER.id },
      });
      prisma.share.findMany.mockResolvedValue([
        {
          id: 'share-1',
          dataRoomId: 'room-1',
          resourceType: 'FOLDER',
          resourceId: 'folder-1',
          mode: 'PUBLIC_LINK',
          role: 'VIEWER',
          token: 'real-token',
          expiresAt: null,
          revokedAt: new Date(),
          recipients: [],
        },
      ]);
      prisma.folder.findMany.mockResolvedValue([{ id: 'folder-1', path: '/root/folder-1/' }]);

      const error = await service
        .requireAccess(null, 'FOLDER', 'folder-1', { token: 'real-token' })
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(NotFoundException);
      expect((error as Error).message).toBe('Not found.');
    });

    it('returns the decision when access is granted', async () => {
      prisma.folder.findUnique.mockResolvedValue({
        id: 'folder-1',
        path: '/root/folder-1/',
        dataRoomId: 'room-1',
        dataRoom: { ownerId: OWNER.id },
      });

      await expect(service.requireAccess(OWNER, 'FOLDER', 'folder-1')).resolves.toEqual({
        role: 'OWNER',
      });
    });
  });

  describe('requireOwner', () => {
    function shareGrantingViewerAccess() {
      prisma.folder.findUnique.mockResolvedValue({
        id: 'folder-1',
        path: '/root/folder-1/',
        dataRoomId: 'room-1',
        dataRoom: { ownerId: OWNER.id },
      });
      prisma.share.findMany.mockResolvedValue([
        {
          id: 'share-1',
          dataRoomId: 'room-1',
          resourceType: 'FOLDER',
          resourceId: 'folder-1',
          mode: 'RESTRICTED',
          role: 'VIEWER',
          token: null,
          expiresAt: null,
          revokedAt: null,
          recipients: [{ email: INVITEE.email, userId: INVITEE.id }],
        },
      ]);
      prisma.folder.findMany.mockResolvedValue([{ id: 'folder-1', path: '/root/folder-1/' }]);
    }

    it('lets the owner through', async () => {
      prisma.folder.findUnique.mockResolvedValue({
        id: 'folder-1',
        path: '/root/folder-1/',
        dataRoomId: 'room-1',
        dataRoom: { ownerId: OWNER.id },
      });

      await expect(service.requireOwner(OWNER, 'FOLDER', 'folder-1')).resolves.toBeUndefined();
    });

    it('answers 403 for a viewer, who already knows the resource exists', async () => {
      shareGrantingViewerAccess();

      await expect(service.requireOwner(INVITEE, 'FOLDER', 'folder-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('still answers 404 for someone with no access at all', async () => {
      // The 403 above must not become a way to probe for resources.
      prisma.folder.findUnique.mockResolvedValue({
        id: 'folder-1',
        path: '/root/folder-1/',
        dataRoomId: 'room-1',
        dataRoom: { ownerId: OWNER.id },
      });

      await expect(service.requireOwner(STRANGER, 'FOLDER', 'folder-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});

import {
  ForbiddenException,
  GoneException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
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

    /**
     * Who may be told *why* they were refused.
     *
     * Presenting the exact token proves the caller was given the link, so
     * naming the problem reveals nothing they did not already hold. Everyone
     * else gets a bare 404, which is what stops the endpoint being used to
     * discover which resources exist.
     */
    describe('refusal reasons', () => {
      function shareOnFolder(overrides: Record<string, unknown>) {
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
            token: 'the-real-token',
            expiresAt: null,
            revokedAt: null,
            recipients: [],
            ...overrides,
          },
        ]);
        prisma.folder.findMany.mockResolvedValue([{ id: 'folder-1', path: '/root/folder-1/' }]);
      }

      async function refusalFor(
        actor: { id: string; email: string } | null,
        token?: string,
      ): Promise<unknown> {
        return service
          .requireAccess(actor, 'FOLDER', 'folder-1', token === undefined ? {} : { token })
          .catch((caught: unknown) => caught);
      }

      it('tells a token holder that the link was revoked', async () => {
        shareOnFolder({ revokedAt: new Date() });

        const error = await refusalFor(null, 'the-real-token');

        expect(error).toBeInstanceOf(GoneException);
        expect((error as GoneException).getResponse()).toMatchObject({ reason: 'REVOKED' });
      });

      it('tells a token holder that the link expired', async () => {
        shareOnFolder({ expiresAt: new Date(Date.now() - 1000) });

        const error = await refusalFor(null, 'the-real-token');

        expect(error).toBeInstanceOf(GoneException);
        expect((error as GoneException).getResponse()).toMatchObject({ reason: 'EXPIRED' });
      });

      it('asks an anonymous holder of a restricted link to sign in', async () => {
        shareOnFolder({ mode: 'RESTRICTED', recipients: [{ email: 'ada@x.com', userId: null }] });

        const error = await refusalFor(null, 'the-real-token');

        expect(error).toBeInstanceOf(UnauthorizedException);
        expect((error as UnauthorizedException).getResponse()).toMatchObject({
          reason: 'SIGN_IN_REQUIRED',
        });
      });

      it('tells a signed-in holder that the link names someone else', async () => {
        shareOnFolder({ mode: 'RESTRICTED', recipients: [{ email: 'ada@x.com', userId: null }] });

        const error = await refusalFor(STRANGER, 'the-real-token');

        expect(error).toBeInstanceOf(ForbiddenException);
        expect((error as ForbiddenException).getResponse()).toMatchObject({
          reason: 'NOT_INVITED',
        });
      });

      it('does not claim the link belongs to someone else when it covers something else', async () => {
        // The recipient is genuinely invited; they just asked for a resource
        // outside the share. Answering NOT_INVITED here would be a lie.
        shareOnFolder({
          mode: 'RESTRICTED',
          resourceId: 'folder-elsewhere',
          recipients: [{ email: STRANGER.email, userId: STRANGER.id }],
        });
        prisma.folder.findMany.mockResolvedValue([
          { id: 'folder-elsewhere', path: '/root/elsewhere/' },
        ]);

        const error = await refusalFor(STRANGER, 'the-real-token');

        expect(error).toBeInstanceOf(NotFoundException);
      });

      it('says nothing at all to someone who presents no token', async () => {
        shareOnFolder({ revokedAt: new Date() });

        const error = await refusalFor(STRANGER);

        expect(error).toBeInstanceOf(NotFoundException);
        expect((error as Error).message).toBe('Not found.');
      });

      it('says nothing at all to someone guessing a token', async () => {
        shareOnFolder({ revokedAt: new Date() });

        const error = await refusalFor(null, 'not-the-real-token');

        expect(error).toBeInstanceOf(NotFoundException);
        expect((error as Error).message).toBe('Not found.');
      });

      it('answers an anonymous caller the same way whether or not the folder exists', async () => {
        // Otherwise 401-for-real and 404-for-fake is an existence oracle for
        // anyone not signed in.
        shareOnFolder({});
        const real = await refusalFor(null);

        prisma.folder.findUnique.mockResolvedValue(null);
        const fake = await refusalFor(null);

        expect(real).toBeInstanceOf(UnauthorizedException);
        expect(fake).toBeInstanceOf(UnauthorizedException);
        expect((fake as UnauthorizedException).getResponse()).toEqual(
          (real as UnauthorizedException).getResponse(),
        );
      });

      it('says nothing when the token is the right length but wrong', async () => {
        // Guards the constant-time comparison against a length-only check.
        shareOnFolder({ revokedAt: new Date() });

        const error = await refusalFor(null, 'the-real-tokeX');

        expect(error).toBeInstanceOf(NotFoundException);
      });
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

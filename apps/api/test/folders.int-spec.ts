import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { AccessService } from '../src/access/access.service';
import type { AccessActor } from '../src/access/access.types';
import { createUserWithDataRoom } from '../src/auth/create-user-with-data-room';
import { FoldersService } from '../src/folders/folders.service';
import type { PrismaClient } from '../src/generated/prisma/client';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { StorageService } from '../src/storage/storage.service';

import {
  assertSchemaIsolation,
  createTestPrismaClient,
  describeWithDatabase,
} from './test-database';

/**
 * Subtree operations against a real database.
 *
 * These are the two things that cannot be checked with mocks: that moving a
 * folder rewrites every descendant's materialized path, and that deleting one
 * takes exactly its own subtree with it and nothing else.
 */
describeWithDatabase('FoldersService subtree operations', () => {
  let prisma: PrismaClient;
  let folders: FoldersService;
  let removedStorageKeys: string[];

  let owner: AccessActor;
  let stranger: AccessActor;
  let rootId: string;
  let legalId: string;
  let contractsId: string;
  let msaId: string;
  let archiveId: string;

  beforeAll(async () => {
    prisma = createTestPrismaClient();
    await assertSchemaIsolation(prisma);
  });

  afterAll(async () => {
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.user.deleteMany();

    removedStorageKeys = [];
    const storage = {
      removeObjects: (keys: readonly string[]) => {
        removedStorageKeys.push(...keys);
        return Promise.resolve();
      },
      createSignedDownloadUrl: () => Promise.resolve('https://signed.example/object'),
    } as unknown as StorageService;

    const prismaAsService = prisma as unknown as PrismaService;
    folders = new FoldersService(prismaAsService, new AccessService(prismaAsService), storage);

    const created = await createUserWithDataRoom(prisma, {
      email: 'owner@example.com',
      name: 'Owner',
      passwordHash: 'not-a-real-hash',
    });
    owner = { id: created.id, email: created.email };
    rootId = created.dataRoom.rootFolderId;

    const outsider = await createUserWithDataRoom(prisma, {
      email: 'stranger@example.com',
      name: 'Stranger',
      passwordHash: 'not-a-real-hash',
    });
    stranger = { id: outsider.id, email: outsider.email };

    // root ├── Legal ── Contracts ── MSA
    //      └── Archive
    legalId = (await folders.create(owner, { name: 'Legal', parentId: rootId })).id;
    contractsId = (await folders.create(owner, { name: 'Contracts', parentId: legalId })).id;
    msaId = (await folders.create(owner, { name: 'MSA', parentId: contractsId })).id;
    archiveId = (await folders.create(owner, { name: 'Archive', parentId: rootId })).id;
  });

  async function pathOf(id: string): Promise<string> {
    const folder = await prisma.folder.findUniqueOrThrow({
      where: { id },
      select: { path: true },
    });

    return folder.path;
  }

  describe('create', () => {
    it('builds a path from the parent and the new id', async () => {
      expect(await pathOf(legalId)).toBe(`/${rootId}/${legalId}/`);
      expect(await pathOf(msaId)).toBe(`/${rootId}/${legalId}/${contractsId}/${msaId}/`);
    });

    it('refuses a duplicate name and suggests a free one', async () => {
      const conflict = await folders
        .create(owner, { name: 'Legal', parentId: rootId })
        .catch((error: unknown) => error);

      expect(conflict).toBeInstanceOf(Error);
      expect((conflict as { getResponse: () => unknown }).getResponse()).toMatchObject({
        suggestedName: 'Legal (2)',
      });
    });

    it('refuses a parent belonging to someone else', async () => {
      await expect(folders.create(stranger, { name: 'Sneaky', parentId: rootId })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('move', () => {
    it('rewrites the whole subtree, not just the folder itself', async () => {
      await folders.move(owner, legalId, { parentId: archiveId });

      expect(await pathOf(legalId)).toBe(`/${rootId}/${archiveId}/${legalId}/`);
      expect(await pathOf(contractsId)).toBe(`/${rootId}/${archiveId}/${legalId}/${contractsId}/`);
      expect(await pathOf(msaId)).toBe(
        `/${rootId}/${archiveId}/${legalId}/${contractsId}/${msaId}/`,
      );
    });

    it('leaves untouched folders alone', async () => {
      await folders.move(owner, legalId, { parentId: archiveId });

      expect(await pathOf(archiveId)).toBe(`/${rootId}/${archiveId}/`);
      expect(await pathOf(rootId)).toBe(`/${rootId}/`);
    });

    it('refuses to move a folder into its own descendant', async () => {
      await expect(folders.move(owner, legalId, { parentId: msaId })).rejects.toBeInstanceOf(
        BadRequestException,
      );

      // And leaves the tree exactly as it was.
      expect(await pathOf(legalId)).toBe(`/${rootId}/${legalId}/`);
    });

    it('refuses to move a folder into itself', async () => {
      await expect(folders.move(owner, legalId, { parentId: legalId })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('refuses to move the root folder', async () => {
      await expect(folders.move(owner, rootId, { parentId: archiveId })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('refuses a destination in another data room', async () => {
      const outsiderRoot = await prisma.dataRoom.findFirstOrThrow({
        where: { ownerId: stranger.id },
        select: { rootFolderId: true },
      });

      await expect(
        folders.move(owner, legalId, { parentId: outsiderRoot.rootFolderId ?? '' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('refuses when the destination already holds that name', async () => {
      await folders.create(owner, { name: 'Legal', parentId: archiveId });

      await expect(folders.move(owner, legalId, { parentId: archiveId })).rejects.toThrow();
      expect(await pathOf(legalId)).toBe(`/${rootId}/${legalId}/`);
    });
  });

  describe('delete', () => {
    it('removes the folder and everything under it', async () => {
      await folders.remove(owner, legalId);

      expect(await prisma.folder.findUnique({ where: { id: legalId } })).toBeNull();
      expect(await prisma.folder.findUnique({ where: { id: contractsId } })).toBeNull();
      expect(await prisma.folder.findUnique({ where: { id: msaId } })).toBeNull();
    });

    it('leaves siblings and ancestors intact', async () => {
      await folders.remove(owner, legalId);

      expect(await prisma.folder.findUnique({ where: { id: archiveId } })).not.toBeNull();
      expect(await prisma.folder.findUnique({ where: { id: rootId } })).not.toBeNull();
    });

    it('hands every storage object beneath it to the storage layer', async () => {
      await prisma.file.createMany({
        data: [
          {
            name: 'msa.pdf',
            folderId: msaId,
            dataRoomId: (await prisma.folder.findUniqueOrThrow({ where: { id: msaId } }))
              .dataRoomId,
            storageKey: 'room/msa.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 100,
            uploadStatus: 'READY',
          },
          {
            name: 'nda.pdf',
            folderId: contractsId,
            dataRoomId: (await prisma.folder.findUniqueOrThrow({ where: { id: contractsId } }))
              .dataRoomId,
            storageKey: 'room/nda.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 200,
            uploadStatus: 'READY',
          },
        ],
      });

      await folders.remove(owner, legalId);

      expect(removedStorageKeys.sort()).toEqual(['room/msa.pdf', 'room/nda.pdf']);
      expect(await prisma.file.count()).toBe(0);
    });

    it('refuses to delete the root folder', async () => {
      await expect(folders.remove(owner, rootId)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses a folder belonging to someone else', async () => {
      await expect(folders.remove(stranger, legalId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete-preview', () => {
    it('counts the subtree without the folder itself', async () => {
      const dataRoomId = (await prisma.folder.findUniqueOrThrow({ where: { id: msaId } }))
        .dataRoomId;

      await prisma.file.create({
        data: {
          name: 'msa.pdf',
          folderId: msaId,
          dataRoomId,
          storageKey: 'room/msa.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1024,
          uploadStatus: 'READY',
        },
      });

      await expect(folders.deletePreview(owner, legalId)).resolves.toEqual({
        folderCount: 2,
        fileCount: 1,
        totalBytes: 1024,
      });
    });

    it('reports zeroes for an empty folder', async () => {
      await expect(folders.deletePreview(owner, archiveId)).resolves.toEqual({
        folderCount: 0,
        fileCount: 0,
        totalBytes: 0,
      });
    });
  });

  describe('rename', () => {
    it('refuses to rename the root folder', async () => {
      await expect(folders.rename(owner, rootId, { name: 'Nope' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('suggests a free name on conflict', async () => {
      const conflict = await folders
        .rename(owner, archiveId, { name: 'Legal' })
        .catch((error: unknown) => error);

      expect((conflict as { getResponse: () => unknown }).getResponse()).toMatchObject({
        suggestedName: 'Legal (2)',
      });
    });
  });

  describe('access', () => {
    it('never lets a stranger read a folder', async () => {
      await expect(folders.findOne(stranger, legalId)).rejects.toThrow(NotFoundException);
    });

    it('asks an anonymous caller with no token to sign in', async () => {
      // Not a 404: holding neither a session nor a link says nothing about
      // whether the folder exists, and the frontend needs to know to offer
      // sign-in rather than "not found".
      await expect(folders.findOne(null, legalId)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('gives a share recipient read access but refuses writes', async () => {
      const dataRoomId = (await prisma.folder.findUniqueOrThrow({ where: { id: legalId } }))
        .dataRoomId;

      await prisma.share.create({
        data: {
          resourceType: 'FOLDER',
          resourceId: legalId,
          dataRoomId,
          mode: 'RESTRICTED',
          createdById: owner.id,
          recipients: { create: [{ email: stranger.email, userId: stranger.id }] },
        },
      });

      await expect(folders.findOne(stranger, contractsId)).resolves.toMatchObject({
        role: 'VIEWER',
      });
      await expect(
        folders.rename(stranger, contractsId, { name: 'Hijacked' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('truncates the breadcrumb to what a share recipient may know', async () => {
      const dataRoomId = (await prisma.folder.findUniqueOrThrow({ where: { id: legalId } }))
        .dataRoomId;

      await prisma.share.create({
        data: {
          resourceType: 'FOLDER',
          resourceId: contractsId,
          dataRoomId,
          mode: 'RESTRICTED',
          createdById: owner.id,
          recipients: { create: [{ email: stranger.email, userId: stranger.id }] },
        },
      });

      const asOwner = await folders.findOne(owner, msaId);
      const asRecipient = await folders.findOne(stranger, msaId);

      expect(asOwner.breadcrumb.map((entry) => entry.name)).toEqual([
        "Owner's Data Room",
        'Legal',
        'Contracts',
        'MSA',
      ]);
      // The recipient's share starts at Contracts, so "Legal" is not theirs to see.
      expect(asRecipient.breadcrumb.map((entry) => entry.name)).toEqual(['Contracts', 'MSA']);
    });
  });
});

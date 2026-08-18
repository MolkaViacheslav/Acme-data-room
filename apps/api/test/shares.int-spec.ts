import {
  ForbiddenException,
  GoneException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { AccessService } from '../src/access/access.service';
import type { AccessActor } from '../src/access/access.types';
import { createUserWithDataRoom } from '../src/auth/create-user-with-data-room';
import { FoldersService } from '../src/folders/folders.service';
import type { PrismaClient } from '../src/generated/prisma/client';
import type { PrismaService } from '../src/prisma/prisma.service';
import { SharesService } from '../src/shares/shares.service';
import type { StorageService } from '../src/storage/storage.service';

import {
  assertSchemaIsolation,
  createTestPrismaClient,
  describeWithDatabase,
} from './test-database';

/**
 * The seven scenarios from the plan, exercised end to end against a real
 * database rather than as a pure function.
 *
 * Phase 3 proved `decideAccess` decides correctly. What this proves is that the
 * decision is reachable: that a share created through the API resolves through
 * `AccessService`, and that each refusal turns into the response the UI needs.
 */
describeWithDatabase('sharing, end to end', () => {
  let prisma: PrismaClient;
  let access: AccessService;
  let shares: SharesService;
  let folders: FoldersService;

  let owner: AccessActor;
  let invitee: AccessActor;
  let stranger: AccessActor;
  let rootId: string;
  let legalId: string;
  let contractsId: string;
  let dataRoomId: string;

  beforeAll(async () => {
    prisma = createTestPrismaClient();
    await assertSchemaIsolation(prisma);

    const asService = prisma as unknown as PrismaService;
    access = new AccessService(asService);
    shares = new SharesService(asService, access);
    folders = new FoldersService(asService, access, {
      removeObjects: () => Promise.resolve(),
      createSignedDownloadUrl: () => Promise.resolve('https://signed.example/x'),
    } as unknown as StorageService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.user.deleteMany();

    const created = await createUserWithDataRoom(prisma, {
      email: 'owner@example.com',
      name: 'Owner',
      passwordHash: 'x',
    });
    owner = { id: created.id, email: created.email };
    rootId = created.dataRoom.rootFolderId;
    dataRoomId = created.dataRoom.id;

    for (const [email, name] of [
      ['invitee@example.com', 'Invitee'],
      ['stranger@example.com', 'Stranger'],
    ]) {
      const user = await createUserWithDataRoom(prisma, {
        email: email ?? '',
        name: name ?? '',
        passwordHash: 'x',
      });
      const actor = { id: user.id, email: user.email };
      if (email === 'invitee@example.com') invitee = actor;
      else stranger = actor;
    }

    legalId = (await folders.create(owner, { name: 'Legal', parentId: rootId })).id;
    contractsId = (await folders.create(owner, { name: 'Contracts', parentId: legalId })).id;
  });

  async function refusalFor(promise: Promise<unknown>): Promise<unknown> {
    return promise.catch((error: unknown) => error);
  }

  it('1. the owner needs no share at all', async () => {
    await expect(folders.findOne(owner, contractsId)).resolves.toMatchObject({ role: 'OWNER' });
  });

  it('2. a public link opens the folder it was created on', async () => {
    const share = await shares.create(owner, {
      resourceType: 'FOLDER',
      resourceId: legalId,
      mode: 'PUBLIC_LINK',
    });

    await expect(folders.findOne(null, legalId, share.token)).resolves.toMatchObject({
      role: 'VIEWER',
    });
  });

  it('3. a share on an ancestor opens what is beneath it', async () => {
    const share = await shares.create(owner, {
      resourceType: 'FOLDER',
      resourceId: legalId,
      mode: 'PUBLIC_LINK',
    });

    // Contracts sits inside Legal and was never shared directly.
    await expect(folders.findOne(null, contractsId, share.token)).resolves.toMatchObject({
      role: 'VIEWER',
    });
  });

  it('4. a revoked link says so, to whoever holds it', async () => {
    const share = await shares.create(owner, {
      resourceType: 'FOLDER',
      resourceId: legalId,
      mode: 'PUBLIC_LINK',
    });
    await shares.revoke(owner, share.id);

    const error = await refusalFor(folders.findOne(null, legalId, share.token));

    expect(error).toBeInstanceOf(GoneException);
    expect((error as GoneException).getResponse()).toMatchObject({ reason: 'REVOKED' });
  });

  it('5. an expired link says so, and says something different', async () => {
    const share = await shares.create(owner, {
      resourceType: 'FOLDER',
      resourceId: legalId,
      mode: 'PUBLIC_LINK',
    });
    await prisma.share.update({
      where: { id: share.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const error = await refusalFor(folders.findOne(null, legalId, share.token));

    expect(error).toBeInstanceOf(GoneException);
    expect((error as GoneException).getResponse()).toMatchObject({ reason: 'EXPIRED' });
  });

  it('6. a wrong token reveals nothing', async () => {
    await shares.create(owner, {
      resourceType: 'FOLDER',
      resourceId: legalId,
      mode: 'PUBLIC_LINK',
    });

    const error = await refusalFor(folders.findOne(null, legalId, 'not-the-token'));

    expect(error).toBeInstanceOf(NotFoundException);
    expect((error as Error).message).toBe('Not found.');
  });

  it('7. a signed-in stranger reveals nothing', async () => {
    await shares.create(owner, {
      resourceType: 'FOLDER',
      resourceId: legalId,
      mode: 'PUBLIC_LINK',
    });

    await expect(folders.findOne(stranger, legalId)).rejects.toBeInstanceOf(NotFoundException);
  });

  describe('restricted shares', () => {
    async function restrictedOnLegal(email: string) {
      return shares.create(owner, {
        resourceType: 'FOLDER',
        resourceId: legalId,
        mode: 'RESTRICTED',
        recipientEmails: [email],
      });
    }

    it('opens for the person it names', async () => {
      const share = await restrictedOnLegal(invitee.email);

      await expect(folders.findOne(invitee, legalId, share.token)).resolves.toMatchObject({
        role: 'VIEWER',
      });
    });

    it('asks an anonymous visitor to sign in', async () => {
      const share = await restrictedOnLegal(invitee.email);

      const error = await refusalFor(folders.findOne(null, legalId, share.token));

      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error as UnauthorizedException).getResponse()).toMatchObject({
        reason: 'SIGN_IN_REQUIRED',
      });
    });

    it('tells the wrong signed-in person that the link is not theirs', async () => {
      const share = await restrictedOnLegal(invitee.email);

      const error = await refusalFor(folders.findOne(stranger, legalId, share.token));

      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toMatchObject({ reason: 'NOT_INVITED' });
    });

    it('holds the link for someone invited before they registered', async () => {
      const share = await restrictedOnLegal('newcomer@example.com');

      const newcomer = await createUserWithDataRoom(prisma, {
        email: 'newcomer@example.com',
        name: 'Newcomer',
        passwordHash: 'x',
      });

      // No ShareRecipient.userId was ever written; the email match is what works.
      await expect(
        folders.findOne({ id: newcomer.id, email: newcomer.email }, legalId, share.token),
      ).resolves.toMatchObject({ role: 'VIEWER' });
    });

    /**
     * The whole invited-by-email journey, in the order a person lives it.
     *
     * This is the path that broke in the browser: the API was right at every
     * step, but the frontend dropped the link on the way through sign-up, so
     * the last step landed in the new user's own drive instead of back here.
     */
    it('takes an invited stranger from "sign in" to access, in sequence', async () => {
      const share = await restrictedOnLegal('late@example.com');

      // 1. They open the link with no account at all.
      const anonymous = await refusalFor(folders.findOne(null, legalId, share.token));
      expect(anonymous).toBeInstanceOf(UnauthorizedException);
      expect((anonymous as UnauthorizedException).getResponse()).toMatchObject({
        reason: 'SIGN_IN_REQUIRED',
      });

      // 2. Signed in as somebody else, the link is still not theirs.
      const wrongAccount = await refusalFor(folders.findOne(stranger, legalId, share.token));
      expect(wrongAccount).toBeInstanceOf(ForbiddenException);

      // 3. They register with the address the invitation named.
      const registered = await createUserWithDataRoom(prisma, {
        email: 'late@example.com',
        name: 'Late',
        passwordHash: 'x',
      });
      const invitedActor = { id: registered.id, email: registered.email };

      // 4. The same token, unchanged, now opens the shared folder.
      await expect(folders.findOne(invitedActor, legalId, share.token)).resolves.toMatchObject({
        role: 'VIEWER',
      });

      // 5. And everything beneath it, without a share of its own.
      await expect(folders.findOne(invitedActor, contractsId, share.token)).resolves.toMatchObject({
        role: 'VIEWER',
      });

      // 6. But still nothing outside what was shared.
      await expect(folders.findOne(invitedActor, rootId, share.token)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('refuses to be created with no recipients', async () => {
      await expect(
        shares.create(owner, {
          resourceType: 'FOLDER',
          resourceId: legalId,
          mode: 'RESTRICTED',
          recipientEmails: [],
        }),
      ).rejects.toThrow();
    });
  });

  describe('resolveByToken', () => {
    it('points a data-room share at the root folder', async () => {
      const share = await shares.create(owner, {
        resourceType: 'DATA_ROOM',
        resourceId: dataRoomId,
        mode: 'PUBLIC_LINK',
      });

      await expect(shares.resolveByToken(null, share.token)).resolves.toMatchObject({
        resourceType: 'DATA_ROOM',
        folderId: rootId,
        fileId: null,
      });
    });

    it('points a folder share at that folder', async () => {
      const share = await shares.create(owner, {
        resourceType: 'FOLDER',
        resourceId: legalId,
        mode: 'PUBLIC_LINK',
      });

      await expect(shares.resolveByToken(null, share.token)).resolves.toMatchObject({
        folderId: legalId,
        fileId: null,
        name: 'Legal',
      });
    });

    it('reports a deleted folder as gone, not as revoked', async () => {
      const share = await shares.create(owner, {
        resourceType: 'FOLDER',
        resourceId: legalId,
        mode: 'PUBLIC_LINK',
      });
      await folders.remove(owner, legalId);

      // The share row survives, but its resource does not.
      await expect(shares.resolveByToken(null, share.token)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    /**
     * A file share grants the file and nothing around it.
     *
     * Worth stating against the database rather than only in the pure policy
     * tests, because a viewer who could walk up to the parent folder would see
     * every other document in it.
     */
    it('does not let a file link reach the folder holding it', async () => {
      const file = await prisma.file.create({
        data: {
          name: 'Board Pack.pdf',
          folderId: legalId,
          dataRoomId,
          storageKey: `${dataRoomId}/board-pack.pdf`,
          mimeType: 'application/pdf',
          sizeBytes: 1024,
          uploadStatus: 'READY',
        },
      });

      const share = await shares.create(owner, {
        resourceType: 'FILE',
        resourceId: file.id,
        mode: 'PUBLIC_LINK',
      });

      // The link opens the file itself.
      await expect(shares.resolveByToken(null, share.token)).resolves.toMatchObject({
        resourceType: 'FILE',
        fileId: file.id,
        folderId: null,
      });

      // And nothing above or beside it.
      await expect(folders.findOne(null, legalId, share.token)).rejects.toThrow();
      await expect(folders.findOne(null, contractsId, share.token)).rejects.toThrow();
      await expect(folders.findOne(null, rootId, share.token)).rejects.toThrow();
    });

    it('reveals nothing for a token that was never issued', async () => {
      await expect(shares.resolveByToken(null, 'made-up-token')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('revocation', () => {
    it('is immediate', async () => {
      const share = await shares.create(owner, {
        resourceType: 'FOLDER',
        resourceId: legalId,
        mode: 'PUBLIC_LINK',
      });

      await expect(folders.findOne(null, legalId, share.token)).resolves.toBeDefined();
      await shares.revoke(owner, share.id);
      await expect(folders.findOne(null, legalId, share.token)).rejects.toBeInstanceOf(
        GoneException,
      );
    });

    it('disappears from the listing the owner sees', async () => {
      const share = await shares.create(owner, {
        resourceType: 'FOLDER',
        resourceId: legalId,
        mode: 'PUBLIC_LINK',
      });

      await shares.revoke(owner, share.id);

      await expect(shares.listForResource(owner, 'FOLDER', legalId)).resolves.toEqual([]);
    });

    it('cannot be done by anyone but the owner', async () => {
      const share = await shares.create(owner, {
        resourceType: 'FOLDER',
        resourceId: legalId,
        mode: 'PUBLIC_LINK',
      });

      await expect(shares.revoke(stranger, share.id)).rejects.toThrow();
    });
  });
});

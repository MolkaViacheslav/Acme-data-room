import { createUserWithDataRoom } from '../src/auth/create-user-with-data-room';
import type { PrismaClient } from '../src/generated/prisma/client';

import {
  assertSchemaIsolation,
  createTestPrismaClient,
  describeWithDatabase,
} from './test-database';

/**
 * The registration transaction against a real Postgres.
 *
 * A mocked version of this could only assert that we called the methods we
 * called. The thing worth proving — that a failure part-way through leaves no
 * orphaned user behind — exists only in the database.
 */

/**
 * Stands in for the client, intercepting only `$transaction` — the single
 * method `createUserWithDataRoom` uses — and making the folder insert fail
 * after the user and data room have already been written.
 */
function clientFailingAtFolderCreate(prisma: PrismaClient): PrismaClient {
  const failing = {
    $transaction: (run: (tx: unknown) => Promise<unknown>) =>
      prisma.$transaction((tx) =>
        run(
          new Proxy(tx as object, {
            get(target, property, receiver): unknown {
              if (property === 'folder') {
                return { create: () => Promise.reject(new Error('folder insert failed')) };
              }
              return Reflect.get(target, property, receiver);
            },
          }),
        ),
      ),
  };

  return failing as unknown as PrismaClient;
}

describeWithDatabase('createUserWithDataRoom against a real database', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = createTestPrismaClient();
    await assertSchemaIsolation(prisma);
  });

  afterAll(async () => {
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Cascades to data rooms and folders.
    await prisma.user.deleteMany();
  });

  it('writes into the test schema, never the application schema', async () => {
    // `assertSchemaIsolation` already enforces this before any suite runs; this
    // states it as a named expectation so the guarantee is visible in the
    // output rather than buried in setup.
    await createUserWithDataRoom(prisma, {
      email: 'isolation@example.com',
      name: 'Isolation',
      passwordHash: 'not-a-real-hash',
    });

    const inPublic = await prisma.$queryRaw<{ count: number }[]>`
      SELECT count(*)::int AS count FROM public."User" WHERE email = 'isolation@example.com'`;

    expect(await prisma.user.count()).toBe(1);
    expect(inPublic[0]?.count).toBe(0);
  });

  it('creates the user, the data room and its root folder together', async () => {
    const result = await createUserWithDataRoom(prisma, {
      email: 'ada@example.com',
      name: 'Ada',
      passwordHash: 'not-a-real-hash',
    });

    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.dataRoom.count()).toBe(1);
    expect(await prisma.folder.count()).toBe(1);

    const dataRoom = await prisma.dataRoom.findUniqueOrThrow({
      where: { id: result.dataRoom.id },
    });
    const rootFolder = await prisma.folder.findUniqueOrThrow({
      where: { id: result.dataRoom.rootFolderId },
    });

    expect(dataRoom.rootFolderId).toBe(rootFolder.id);
    expect(dataRoom.ownerId).toBe(result.id);
    expect(rootFolder.parentId).toBeNull();
    expect(rootFolder.dataRoomId).toBe(dataRoom.id);

    // Leading and trailing slashes are what make a prefix match unambiguous.
    expect(rootFolder.path).toBe(`/${rootFolder.id}/`);
  });

  it('leaves no orphaned user when a later write in the transaction fails', async () => {
    await expect(
      createUserWithDataRoom(clientFailingAtFolderCreate(prisma), {
        email: 'rollback@example.com',
        name: 'Rollback',
        passwordHash: 'not-a-real-hash',
      }),
    ).rejects.toThrow('folder insert failed');

    // The user and data room inserts had already succeeded when the folder
    // insert threw. Without the transaction they would still be here.
    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.dataRoom.count()).toBe(0);
    expect(await prisma.folder.count()).toBe(0);
  });

  it('refuses a duplicate email', async () => {
    const input = {
      email: 'ada@example.com',
      name: 'Ada',
      passwordHash: 'not-a-real-hash',
    };

    await createUserWithDataRoom(prisma, input);

    await expect(createUserWithDataRoom(prisma, input)).rejects.toMatchObject({ code: 'P2002' });
    expect(await prisma.user.count()).toBe(1);
  });
});

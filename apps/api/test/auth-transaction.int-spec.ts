import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';

import { createUserWithDataRoom } from '../src/auth/create-user-with-data-room';
import { PrismaClient } from '../src/generated/prisma/client';

/**
 * Runs against a real Postgres — an isolated schema in the same Supabase
 * project, set as `TEST_DATABASE_URL`.
 *
 * Skips itself when that variable is absent, so `pnpm test` stays green on a
 * machine with no database credentials.
 *
 * A mocked version of this test could only assert that we called the methods we
 * called. The thing worth proving — that a failure part-way through leaves no
 * orphaned user behind — exists only in the database.
 */
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl === undefined ? describe.skip : describe;

/**
 * The schema these tests are allowed to write to, and truncate.
 *
 * `?schema=` in the connection string is a Prisma CLI convention: the `pg`
 * driver behind the adapter ignores unknown query parameters, so the adapter
 * must be told the schema explicitly. Getting this wrong once pointed the
 * suite at `public` and deleted the seeded demo account.
 */
const TEST_SCHEMA = 'test';

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

const SENTINEL_EMAIL = 'schema-isolation-probe@example.test';

async function countInSchema(prisma: PrismaClient, schema: 'public' | 'test'): Promise<number> {
  const rows =
    schema === 'test'
      ? await prisma.$queryRaw<{ count: number }[]>`
          SELECT count(*)::int AS count FROM test."User" WHERE email = ${SENTINEL_EMAIL}`
      : await prisma.$queryRaw<{ count: number }[]>`
          SELECT count(*)::int AS count FROM public."User" WHERE email = ${SENTINEL_EMAIL}`;

  return rows[0]?.count ?? 0;
}

describeWithDatabase('createUserWithDataRoom against a real database', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: testDatabaseUrl }, { schema: TEST_SCHEMA }),
    });

    // These tests truncate tables, so prove the isolation before trusting it.
    // `current_schema()` is not the check to make: the adapter's `schema`
    // option qualifies table names in generated queries, it does not move the
    // session's search_path. What matters is where a model write actually lands.
    await prisma.user.create({
      data: { email: SENTINEL_EMAIL, name: 'Probe', passwordHash: 'probe' },
    });

    const landedInPublic = await countInSchema(prisma, 'public');
    const landedInTest = await countInSchema(prisma, TEST_SCHEMA);

    await prisma.user.deleteMany({ where: { email: SENTINEL_EMAIL } });

    if (landedInPublic > 0 || landedInTest === 0) {
      throw new Error(
        `Model writes are not isolated to the "${TEST_SCHEMA}" schema. Refusing to run destructive tests.`,
      );
    }
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
    await prisma.user.create({
      data: { email: SENTINEL_EMAIL, name: 'Probe', passwordHash: 'probe' },
    });

    await expect(countInSchema(prisma, TEST_SCHEMA)).resolves.toBe(1);
    await expect(countInSchema(prisma, 'public')).resolves.toBe(0);
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

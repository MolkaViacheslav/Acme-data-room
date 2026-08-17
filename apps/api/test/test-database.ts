import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../src/generated/prisma/client';

/**
 * Shared setup for suites that talk to a real Postgres.
 *
 * They run against an isolated schema in the same Supabase project, named by
 * `TEST_DATABASE_URL`, and skip themselves when it is absent so `pnpm test`
 * stays green on a machine with no credentials.
 */
export const TEST_SCHEMA = 'test';

export const testDatabaseUrl = process.env.TEST_DATABASE_URL;

export const describeWithDatabase = testDatabaseUrl === undefined ? describe.skip : describe;

export function createTestPrismaClient(): PrismaClient {
  return new PrismaClient({
    // `?schema=` in the connection string is a Prisma CLI convention: the `pg`
    // driver behind the adapter ignores unknown query parameters, so the schema
    // has to be given to the adapter explicitly.
    adapter: new PrismaPg({ connectionString: testDatabaseUrl }, { schema: TEST_SCHEMA }),
  });
}

const SENTINEL_EMAIL = 'schema-isolation-probe@example.test';

/**
 * Proves model writes land in the test schema before any suite is allowed to
 * truncate anything.
 *
 * This is not ceremony: getting the schema wrong once pointed the destructive
 * suites at `public` and deleted the seeded demo account.
 */
export async function assertSchemaIsolation(prisma: PrismaClient): Promise<void> {
  await prisma.user.create({
    data: { email: SENTINEL_EMAIL, name: 'Probe', passwordHash: 'probe' },
  });

  const inPublic = await prisma.$queryRaw<{ count: number }[]>`
    SELECT count(*)::int AS count FROM public."User" WHERE email = ${SENTINEL_EMAIL}`;
  const inTest = await prisma.$queryRaw<{ count: number }[]>`
    SELECT count(*)::int AS count FROM test."User" WHERE email = ${SENTINEL_EMAIL}`;

  await prisma.user.deleteMany({ where: { email: SENTINEL_EMAIL } });

  if ((inPublic[0]?.count ?? 0) > 0 || (inTest[0]?.count ?? 0) === 0) {
    throw new Error(
      `Model writes are not isolated to the "${TEST_SCHEMA}" schema. Refusing to run destructive tests.`,
    );
  }
}

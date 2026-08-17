import 'dotenv/config';
import { randomUUID } from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from 'bcryptjs';

import { PrismaClient } from '../src/generated/prisma/client';

/**
 * Credentials published in the README so a reviewer can log in immediately.
 * Re-running the seed replaces this account and everything under it, and
 * touches nothing else in the database.
 */
const DEMO_EMAIL = 'demo@acme.test';
const DEMO_PASSWORD = 'demo-password';
const DEMO_NAME = 'Demo Reviewer';
const DATA_ROOM_NAME = 'Acme Acquisition';

/**
 * Folders only. A `File` row is a promise that an object exists in Supabase
 * Storage behind it, and nothing uploads objects until Phase 5 — seeding rows
 * whose downloads would 404 would be worse than an empty folder.
 */
interface FolderSeed {
  readonly name: string;
  readonly children?: readonly FolderSeed[];
}

const TREE: readonly FolderSeed[] = [
  {
    name: '01 Corporate',
    children: [{ name: 'Formation Documents' }, { name: 'Board Minutes' }],
  },
  {
    name: '02 Financials',
    children: [
      { name: 'Audited Statements' },
      { name: 'Management Accounts', children: [{ name: 'FY2025' }] },
    ],
  },
  {
    name: '03 Legal',
    children: [{ name: 'Material Contracts' }],
  },
];

interface FolderRow {
  readonly id: string;
  readonly name: string;
  readonly dataRoomId: string;
  readonly parentId: string;
  readonly path: string;
}

/**
 * Ids are generated here rather than by the database so each folder's
 * materialized path can be built in one pass, without reading rows back.
 */
function buildFolderRows(
  nodes: readonly FolderSeed[],
  dataRoomId: string,
  parentId: string,
  parentPath: string,
): FolderRow[] {
  return nodes.flatMap((node) => {
    const id = randomUUID();
    const path = `${parentPath}${id}/`;

    return [
      { id, name: node.name, dataRoomId, parentId, path },
      ...buildFolderRows(node.children ?? [], dataRoomId, id, path),
    ];
  });
}

function requireEnv(name: string): string {
  const value = process.env[name];

  if (value === undefined || value.trim() === '') {
    throw new Error(`${name} is not set — the seed needs the direct database connection.`);
  }

  return value;
}

async function main(): Promise<void> {
  const adapter = new PrismaPg({ connectionString: requireEnv('DIRECT_URL') });
  const prisma = new PrismaClient({ adapter });

  const passwordHash = await hash(DEMO_PASSWORD, 12);

  const userId = randomUUID();
  const dataRoomId = randomUUID();
  const rootFolderId = randomUUID();
  const rootPath = `/${rootFolderId}/`;
  const folderRows = buildFolderRows(TREE, dataRoomId, rootFolderId, rootPath);

  // Cascades through DataRoom → Folder, so a re-run starts from a clean slate.
  await prisma.user.deleteMany({ where: { email: DEMO_EMAIL } });

  await prisma.$transaction(async (tx) => {
    await tx.user.create({
      data: { id: userId, email: DEMO_EMAIL, name: DEMO_NAME, passwordHash },
    });

    // The DataRoom must exist before its root Folder can reference it, so
    // `rootFolderId` is filled in a moment later — inside the same transaction.
    await tx.dataRoom.create({
      data: { id: dataRoomId, name: DATA_ROOM_NAME, ownerId: userId },
    });

    await tx.folder.create({
      data: {
        id: rootFolderId,
        name: DATA_ROOM_NAME,
        dataRoomId,
        parentId: null,
        path: rootPath,
      },
    });

    await tx.dataRoom.update({ where: { id: dataRoomId }, data: { rootFolderId } });

    await tx.folder.createMany({ data: folderRows });
  });

  await prisma.$disconnect();

  console.log(`Seeded ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`  data room ${DATA_ROOM_NAME} (${dataRoomId})`);
  console.log(`  root folder ${rootFolderId}`);
  console.log(`  ${folderRows.length} nested folders`);
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

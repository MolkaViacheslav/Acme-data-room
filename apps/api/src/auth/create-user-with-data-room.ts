import { randomUUID } from 'node:crypto';

import type { PrismaClient } from '../generated/prisma/client';

import type { AuthUser } from './auth.types';

export interface NewUserInput {
  readonly email: string;
  readonly name: string;
  readonly passwordHash: string;
}

export function dataRoomNameFor(userName: string): string {
  return `${userName}'s Data Room`;
}

/**
 * Creates the user, their data room and that room's root folder as one unit.
 *
 * All four writes are in a single transaction on purpose: a user without a
 * data room, or a data room without a root folder, would break every later
 * assumption in the app — `File.folderId` is non-null precisely because a root
 * folder always exists.
 *
 * Ids are generated here rather than by the database so the root folder's
 * materialized path can be written in the same statement that creates it.
 *
 * Takes a `PrismaClient` rather than the Nest service so it can be exercised
 * against a real test database without standing up the DI container.
 */
export async function createUserWithDataRoom(
  prisma: PrismaClient,
  input: NewUserInput,
): Promise<AuthUser> {
  const userId = randomUUID();
  const dataRoomId = randomUUID();
  const rootFolderId = randomUUID();
  const dataRoomName = dataRoomNameFor(input.name);

  await prisma.$transaction(async (tx) => {
    await tx.user.create({
      data: {
        id: userId,
        email: input.email,
        name: input.name,
        passwordHash: input.passwordHash,
      },
    });

    // The data room must exist before a folder can reference it, and the root
    // folder must exist before the data room can point back at it.
    await tx.dataRoom.create({
      data: { id: dataRoomId, name: dataRoomName, ownerId: userId },
    });

    await tx.folder.create({
      data: {
        id: rootFolderId,
        name: dataRoomName,
        dataRoomId,
        parentId: null,
        path: `/${rootFolderId}/`,
      },
    });

    await tx.dataRoom.update({ where: { id: dataRoomId }, data: { rootFolderId } });
  });

  return {
    id: userId,
    email: input.email,
    name: input.name,
    dataRoom: { id: dataRoomId, name: dataRoomName, rootFolderId },
  };
}

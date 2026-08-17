import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { AccessService } from '../access/access.service';
import type { AccessActor } from '../access/access.types';
import { PrismaService } from '../prisma/prisma.service';
import { suggestAvailableName } from '../shared/unique-name';
import { DOWNLOAD_URL_TTL_SECONDS, StorageService } from '../storage/storage.service';

import type { MoveFileDto } from './dto/move-file.dto';
import type { RenameFileDto } from './dto/rename-file.dto';
import type { DownloadUrl, FileDetail } from './files.types';

/** Postgres unique-constraint violation, as surfaced by Prisma. */
function isUniqueConstraintViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly storage: StorageService,
  ) {}

  async rename(actor: AccessActor, id: string, dto: RenameFileDto): Promise<FileDetail> {
    await this.access.requireOwner(actor, 'FILE', id);

    const file = await this.prisma.file.findUniqueOrThrow({
      where: { id },
      select: { folderId: true },
    });

    try {
      await this.prisma.file.update({ where: { id }, data: { name: dto.name } });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw await this.nameConflict(file.folderId, dto.name);
      }
      throw error;
    }

    return this.findOne(id);
  }

  async move(actor: AccessActor, id: string, dto: MoveFileDto): Promise<FileDetail> {
    // Both the file and the destination came from the client, so both are
    // checked. Checking only the file would let anyone with a file they own
    // drop it into someone else's folder.
    await this.access.requireOwner(actor, 'FILE', id);
    await this.access.requireOwner(actor, 'FOLDER', dto.folderId);

    const [file, target] = await Promise.all([
      this.prisma.file.findUniqueOrThrow({
        where: { id },
        select: { id: true, name: true, dataRoomId: true },
      }),
      this.prisma.folder.findUniqueOrThrow({
        where: { id: dto.folderId },
        select: { id: true, dataRoomId: true },
      }),
    ]);

    if (file.dataRoomId !== target.dataRoomId) {
      throw new ConflictException('A file cannot be moved to another data room.');
    }

    try {
      await this.prisma.file.update({ where: { id }, data: { folderId: target.id } });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw await this.nameConflict(target.id, file.name);
      }
      throw error;
    }

    return this.findOne(id);
  }

  async remove(actor: AccessActor, id: string): Promise<void> {
    await this.access.requireOwner(actor, 'FILE', id);

    const file = await this.prisma.file.findUniqueOrThrow({
      where: { id },
      select: { storageKey: true },
    });

    await this.prisma.file.delete({ where: { id } });

    // After the row is gone, and never allowed to undo it.
    await this.storage.removeObjects([file.storageKey]);
  }

  /**
   * A short-lived link to the object itself.
   *
   * Read access is enough — a viewer following a share link must be able to
   * open the document, which is the entire point of sharing it.
   */
  async createDownloadUrl(
    actor: AccessActor | null,
    id: string,
    token?: string,
  ): Promise<DownloadUrl> {
    await this.access.requireAccess(actor, 'FILE', id, { token });

    const file = await this.prisma.file.findUnique({
      where: { id },
      select: { storageKey: true, uploadStatus: true },
    });

    if (file === null) throw new NotFoundException('Not found.');

    // A pending row has no object behind it yet; signing a URL would produce a
    // link that 404s at the storage layer.
    if (file.uploadStatus !== 'READY') {
      throw new NotFoundException('This file has not finished uploading.');
    }

    const url = await this.storage.createSignedDownloadUrl(file.storageKey);

    return { url, expiresAt: new Date(Date.now() + DOWNLOAD_URL_TTL_SECONDS * 1000) };
  }

  private async findOne(id: string): Promise<FileDetail> {
    return this.prisma.file.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        name: true,
        folderId: true,
        dataRoomId: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /** A 409 that also tells the client what name would work. */
  private async nameConflict(folderId: string, desiredName: string): Promise<ConflictException> {
    const siblings = await this.prisma.file.findMany({
      where: { folderId },
      select: { name: true },
    });

    return new ConflictException({
      message: `A file named "${desiredName}" already exists here.`,
      suggestedName: suggestAvailableName(
        desiredName,
        siblings.map((sibling) => sibling.name),
      ),
    });
  }
}

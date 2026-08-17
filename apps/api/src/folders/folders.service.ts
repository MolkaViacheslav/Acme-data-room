import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { AccessService } from '../access/access.service';
import type { AccessActor, AccessDecision } from '../access/access.types';
import { PrismaService } from '../prisma/prisma.service';
import { type ChildCursor, decodeCursor, encodeCursor } from '../shared/cursor';
import {
  childPath,
  isPathAncestorOrSelf,
  pathSegments,
  replacePathPrefix,
} from '../shared/materialized-path';
import { suggestAvailableName } from '../shared/unique-name';
import { StorageService } from '../storage/storage.service';

import type { CreateFolderDto } from './dto/create-folder.dto';
import {
  type ChildSortField,
  DEFAULT_PAGE_SIZE,
  type ListChildrenDto,
  type SortDirection,
} from './dto/list-children.dto';
import type { MoveFolderDto } from './dto/move-folder.dto';
import type { RenameFolderDto } from './dto/rename-folder.dto';
import type {
  BreadcrumbEntry,
  ChildEntry,
  ChildrenPage,
  DeletePreview,
  FolderDetail,
} from './folders.types';

/** Postgres unique-constraint violation, as surfaced by Prisma. */
function isUniqueConstraintViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

@Injectable()
export class FoldersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly storage: StorageService,
  ) {}

  async create(actor: AccessActor, dto: CreateFolderDto): Promise<FolderDetail> {
    // The parent id came from the client, so it is checked before it is used.
    await this.access.requireOwner(actor, 'FOLDER', dto.parentId);

    const parent = await this.prisma.folder.findUniqueOrThrow({
      where: { id: dto.parentId },
      select: { id: true, path: true, dataRoomId: true },
    });

    const id = randomUUID();

    try {
      await this.prisma.folder.create({
        data: {
          id,
          name: dto.name,
          dataRoomId: parent.dataRoomId,
          parentId: parent.id,
          // Generated here so the path can be written in the same statement.
          path: childPath(parent.path, id),
        },
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw await this.nameConflict(parent.id, dto.name);
      }
      throw error;
    }

    return this.findOne(actor, id);
  }

  async findOne(actor: AccessActor | null, id: string, token?: string): Promise<FolderDetail> {
    const decision = await this.access.requireAccess(actor, 'FOLDER', id, { token });

    const folder = await this.prisma.folder.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        parentId: true,
        dataRoomId: true,
        path: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Deleted between the access check and this read.
    if (folder === null) throw new NotFoundException('Not found.');

    return {
      id: folder.id,
      name: folder.name,
      parentId: folder.parentId,
      dataRoomId: folder.dataRoomId,
      isRoot: folder.parentId === null,
      role: decision.role,
      breadcrumb: await this.buildBreadcrumb(folder.path, decision),
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt,
    };
  }

  async listChildren(
    actor: AccessActor | null,
    id: string,
    query: ListChildrenDto,
  ): Promise<ChildrenPage> {
    await this.access.requireAccess(actor, 'FOLDER', id, { token: query.token });

    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const sort = query.sort ?? 'name';
    const direction = query.direction ?? 'asc';

    const cursor = query.cursor === undefined ? null : decodeCursor(query.cursor);
    if (query.cursor !== undefined && cursor === null) {
      throw new BadRequestException('That page link is not valid.');
    }

    const items: ChildEntry[] = [];

    // Folders always come before files, which is what lets one cursor walk two
    // tables without a union query.
    if (cursor === null || cursor.section === 'folders') {
      const folders = await this.fetchChildFolders(id, sort, direction, cursor, limit + 1);

      if (folders.length > limit) {
        const page = folders.slice(0, limit);
        return { items: page, nextCursor: this.cursorAfter(page, 'folders', sort) };
      }

      items.push(...folders);
    }

    const remaining = limit - items.length;
    const fileCursor = cursor?.section === 'files' ? cursor : null;
    const files = await this.fetchChildFiles(id, sort, direction, fileCursor, remaining + 1);

    if (files.length > remaining) {
      const page = files.slice(0, remaining);
      items.push(...page);
      return { items, nextCursor: this.cursorAfter(page, 'files', sort) };
    }

    items.push(...files);

    return { items, nextCursor: null };
  }

  async rename(actor: AccessActor, id: string, dto: RenameFolderDto): Promise<FolderDetail> {
    await this.access.requireOwner(actor, 'FOLDER', id);

    const folder = await this.prisma.folder.findUniqueOrThrow({
      where: { id },
      select: { id: true, parentId: true },
    });

    // The root folder is the data room. Renaming it here would leave the two
    // names disagreeing, so it is refused rather than half-supported.
    if (folder.parentId === null) {
      throw new BadRequestException('The top-level folder cannot be renamed.');
    }

    try {
      await this.prisma.folder.update({ where: { id }, data: { name: dto.name } });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw await this.nameConflict(folder.parentId, dto.name);
      }
      throw error;
    }

    return this.findOne(actor, id);
  }

  async move(actor: AccessActor, id: string, dto: MoveFolderDto): Promise<FolderDetail> {
    // Both ends came from the client, so both are checked.
    await this.access.requireOwner(actor, 'FOLDER', id);
    await this.access.requireOwner(actor, 'FOLDER', dto.parentId);

    const [folder, target] = await Promise.all([
      this.prisma.folder.findUniqueOrThrow({
        where: { id },
        select: { id: true, name: true, path: true, parentId: true, dataRoomId: true },
      }),
      this.prisma.folder.findUniqueOrThrow({
        where: { id: dto.parentId },
        select: { id: true, path: true, dataRoomId: true },
      }),
    ]);

    if (folder.parentId === null) {
      throw new BadRequestException('The top-level folder cannot be moved.');
    }
    if (folder.dataRoomId !== target.dataRoomId) {
      throw new BadRequestException('A folder cannot be moved to another data room.');
    }
    // Moving a folder inside itself would detach the subtree from the tree.
    if (isPathAncestorOrSelf(folder.path, target.path)) {
      throw new BadRequestException('A folder cannot be moved into itself.');
    }
    if (folder.parentId === target.id) {
      return this.findOne(actor, id);
    }

    const newPath = childPath(target.path, folder.id);

    // The whole subtree's paths move with it.
    const subtree = await this.prisma.folder.findMany({
      where: { dataRoomId: folder.dataRoomId, path: { startsWith: folder.path } },
      select: { id: true, path: true },
    });

    const rewrites = subtree.flatMap((descendant) => {
      const rewritten = replacePathPrefix(descendant.path, folder.path, newPath);

      return rewritten === null ? [] : [{ id: descendant.id, path: rewritten }];
    });

    try {
      await this.prisma.$transaction([
        this.prisma.folder.update({
          where: { id: folder.id },
          data: { parentId: target.id, path: newPath },
        }),
        ...rewrites
          .filter((rewrite) => rewrite.id !== folder.id)
          .map((rewrite) =>
            this.prisma.folder.update({
              where: { id: rewrite.id },
              data: { path: rewrite.path },
            }),
          ),
      ]);
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw await this.nameConflict(target.id, folder.name);
      }
      throw error;
    }

    return this.findOne(actor, id);
  }

  async deletePreview(actor: AccessActor, id: string): Promise<DeletePreview> {
    await this.access.requireOwner(actor, 'FOLDER', id);

    const folder = await this.prisma.folder.findUniqueOrThrow({
      where: { id },
      select: { dataRoomId: true, path: true },
    });

    // Two aggregates rather than one: files carry no path of their own, so they
    // are reached through the folder holding them.
    const [folderCount, files] = await Promise.all([
      this.prisma.folder.count({
        where: {
          dataRoomId: folder.dataRoomId,
          path: { startsWith: folder.path },
          // Exclude the folder being deleted; the dialog counts what is inside.
          id: { not: id },
        },
      }),
      this.prisma.file.aggregate({
        where: { folder: { dataRoomId: folder.dataRoomId, path: { startsWith: folder.path } } },
        _count: true,
        _sum: { sizeBytes: true },
      }),
    ]);

    return {
      folderCount,
      fileCount: files._count,
      totalBytes: files._sum.sizeBytes ?? 0,
    };
  }

  async remove(actor: AccessActor, id: string): Promise<void> {
    await this.access.requireOwner(actor, 'FOLDER', id);

    const folder = await this.prisma.folder.findUniqueOrThrow({
      where: { id },
      select: { id: true, parentId: true, dataRoomId: true, path: true },
    });

    // Deleting the root would leave the data room without one, which
    // AccessService treats as unusable — an unrecoverable state.
    if (folder.parentId === null) {
      throw new BadRequestException('The top-level folder cannot be deleted.');
    }

    // Collected before the delete, because the cascade takes the rows with it.
    const doomed = await this.prisma.file.findMany({
      where: { folder: { dataRoomId: folder.dataRoomId, path: { startsWith: folder.path } } },
      select: { storageKey: true },
    });

    // One statement: `onDelete: Cascade` on Folder.parentId removes the subtree.
    await this.prisma.folder.delete({ where: { id } });

    // Deliberately after the transaction, and deliberately not awaited for
    // success: a storage failure must not undo a completed deletion.
    await this.storage.removeObjects(doomed.map((file) => file.storageKey));
  }

  /**
   * Ancestors the caller is allowed to know about.
   *
   * An owner sees the whole chain. Someone holding a share on a folder sees the
   * chain from that folder down — the names above it are not theirs to see.
   */
  private async buildBreadcrumb(
    path: string,
    decision: AccessDecision,
  ): Promise<BreadcrumbEntry[]> {
    const segments = pathSegments(path);
    const floor = await this.breadcrumbFloor(segments, decision);
    const visible = segments.slice(floor);

    if (visible.length === 0) return [];

    const folders = await this.prisma.folder.findMany({
      where: { id: { in: visible } },
      select: { id: true, name: true },
    });

    const nameById = new Map(folders.map((folder) => [folder.id, folder.name]));

    return visible.flatMap((id) => {
      const name = nameById.get(id);

      return name === undefined ? [] : [{ id, name }];
    });
  }

  private async breadcrumbFloor(
    segments: readonly string[],
    decision: AccessDecision,
  ): Promise<number> {
    if (decision.role !== 'VIEWER') return 0;

    const share = await this.prisma.share.findUnique({
      where: { id: decision.viaShareId },
      select: { resourceType: true, resourceId: true },
    });

    if (share === null || share.resourceType !== 'FOLDER') return 0;

    const index = segments.indexOf(share.resourceId);

    return index === -1 ? 0 : index;
  }

  private async fetchChildFolders(
    parentId: string,
    sort: ChildSortField,
    direction: SortDirection,
    cursor: ChildCursor | null,
    take: number,
  ): Promise<ChildEntry[]> {
    // Folders have no size of their own, so they keep name order under that sort.
    const field = sort === 'updatedAt' ? 'updatedAt' : 'name';
    const after = cursor?.section === 'folders' ? cursor : null;

    const rows = await this.prisma.folder.findMany({
      where: {
        parentId,
        ...(after === null
          ? {}
          : field === 'updatedAt'
            ? this.keysetOn('updatedAt', new Date(after.key), after.id, direction)
            : this.keysetOn('name', after.key, after.id, direction)),
      },
      orderBy: [{ [field]: direction }, { id: direction }],
      take,
      select: { id: true, name: true, updatedAt: true },
    });

    return rows.map((row) => ({ type: 'folder', ...row }));
  }

  private async fetchChildFiles(
    folderId: string,
    sort: ChildSortField,
    direction: SortDirection,
    cursor: ChildCursor | null,
    take: number,
  ): Promise<ChildEntry[]> {
    if (take <= 0) return [];

    const field = sort === 'size' ? 'sizeBytes' : sort === 'updatedAt' ? 'updatedAt' : 'name';

    const rows = await this.prisma.file.findMany({
      where: {
        folderId,
        // A file with no object behind it yet is not part of the drive.
        uploadStatus: 'READY',
        ...(cursor === null
          ? {}
          : field === 'updatedAt'
            ? this.keysetOn('updatedAt', new Date(cursor.key), cursor.id, direction)
            : field === 'sizeBytes'
              ? this.keysetOn('sizeBytes', Number(cursor.key), cursor.id, direction)
              : this.keysetOn('name', cursor.key, cursor.id, direction)),
      },
      orderBy: [{ [field]: direction }, { id: direction }],
      take,
      select: { id: true, name: true, sizeBytes: true, mimeType: true, updatedAt: true },
    });

    return rows.map((row) => ({ type: 'file', ...row }));
  }

  /**
   * Keyset predicate: everything ordered after `(value, id)`.
   *
   * Never OFFSET — it re-reads and discards every skipped row, so page 500 of a
   * large folder costs 500 pages of work.
   */
  private keysetOn(
    field: 'name' | 'updatedAt' | 'sizeBytes',
    value: string | number | Date,
    id: string,
    direction: SortDirection,
  ): Record<string, unknown> {
    const operator = direction === 'asc' ? 'gt' : 'lt';

    return {
      OR: [{ [field]: { [operator]: value } }, { [field]: value, id: { [operator]: id } }],
    };
  }

  private cursorAfter(
    page: readonly ChildEntry[],
    section: ChildCursor['section'],
    sort: ChildSortField,
  ): string | null {
    const last = page.at(-1);
    if (last === undefined) return null;

    const key =
      sort === 'updatedAt'
        ? last.updatedAt.toISOString()
        : sort === 'size' && last.type === 'file'
          ? String(last.sizeBytes)
          : last.name;

    return encodeCursor({ section, key, id: last.id });
  }

  /** A 409 that also tells the client what name would work. */
  private async nameConflict(parentId: string, desiredName: string): Promise<ConflictException> {
    const siblings = await this.prisma.folder.findMany({
      where: { parentId },
      select: { name: true },
    });

    return new ConflictException({
      message: `A folder named "${desiredName}" already exists here.`,
      suggestedName: suggestAvailableName(
        desiredName,
        siblings.map((sibling) => sibling.name),
      ),
    });
  }
}

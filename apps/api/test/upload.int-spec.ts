import { BadRequestException } from '@nestjs/common';

import { AccessService } from '../src/access/access.service';
import type { AccessActor } from '../src/access/access.types';
import { createUserWithDataRoom } from '../src/auth/create-user-with-data-room';
import { loadEnv } from '../src/config/env';
import { FilesService } from '../src/files/files.service';
import type { PrismaClient } from '../src/generated/prisma/client';
import type { PrismaService } from '../src/prisma/prisma.service';
import { StorageService } from '../src/storage/storage.service';

import {
  assertSchemaIsolation,
  createTestPrismaClient,
  describeWithDatabase,
} from './test-database';

/**
 * The upload round trip against the real Supabase bucket.
 *
 * Mocks cannot answer the question that matters here: whether a signed URL
 * actually accepts a browser `PUT`, and whether what storage reports afterwards
 * matches what the client claimed. Both are the basis of the size and type
 * limits, so both are exercised for real.
 */
const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
const HTML_BYTES = new TextEncoder().encode('<script>alert(1)</script>');

async function putObject(url: string, body: Uint8Array, contentType: string): Promise<number> {
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: body as unknown as BodyInit,
  });

  return response.status;
}

describeWithDatabase('upload round trip', () => {
  let prisma: PrismaClient;
  let files: FilesService;
  let storage: StorageService;
  let owner: AccessActor;
  let rootId: string;
  const writtenKeys: string[] = [];

  beforeAll(async () => {
    prisma = createTestPrismaClient();
    await assertSchemaIsolation(prisma);

    storage = new StorageService(loadEnv());
    const prismaAsService = prisma as unknown as PrismaService;
    files = new FilesService(prismaAsService, new AccessService(prismaAsService), storage);
  });

  afterAll(async () => {
    // Objects outlive the rows, so they are cleaned up explicitly.
    await storage.removeObjects(writtenKeys);
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.user.deleteMany();

    const created = await createUserWithDataRoom(prisma, {
      email: 'uploader@example.com',
      name: 'Uploader',
      passwordHash: 'not-a-real-hash',
    });
    owner = { id: created.id, email: created.email };
    rootId = created.dataRoom.rootFolderId;
  });

  async function trackKey(fileId: string): Promise<string> {
    const file = await prisma.file.findUniqueOrThrow({
      where: { id: fileId },
      select: { storageKey: true },
    });
    writtenKeys.push(file.storageKey);

    return file.storageKey;
  }

  it('signs a URL, accepts the bytes, and confirms the file', async () => {
    const target = await files.createUploadUrl(owner, {
      folderId: rootId,
      name: 'report.pdf',
      mimeType: 'application/pdf',
      sizeBytes: PDF_BYTES.byteLength,
    });

    await trackKey(target.fileId);
    expect(await putObject(target.uploadUrl, PDF_BYTES, 'application/pdf')).toBe(200);

    const completed = await files.completeUpload(owner, target.fileId);

    expect(completed.name).toBe('report.pdf');
    expect(completed.sizeBytes).toBe(PDF_BYTES.byteLength);
    expect(completed.mimeType).toBe('application/pdf');
  });

  it('hides a file until it is confirmed', async () => {
    const target = await files.createUploadUrl(owner, {
      folderId: rootId,
      name: 'pending.pdf',
      mimeType: 'application/pdf',
      sizeBytes: PDF_BYTES.byteLength,
    });
    await trackKey(target.fileId);

    const row = await prisma.file.findUniqueOrThrow({ where: { id: target.fileId } });
    expect(row.uploadStatus).toBe('PENDING');
  });

  it('records what storage reports, not what the client claimed', async () => {
    const target = await files.createUploadUrl(owner, {
      folderId: rootId,
      name: 'lying.pdf',
      mimeType: 'application/pdf',
      // Declares one byte, uploads eight.
      sizeBytes: 1,
    });
    await trackKey(target.fileId);
    await putObject(target.uploadUrl, PDF_BYTES, 'application/pdf');

    const completed = await files.completeUpload(owner, target.fileId);

    expect(completed.sizeBytes).toBe(PDF_BYTES.byteLength);
  });

  it('refuses a file that is not really a PDF, and removes it', async () => {
    const target = await files.createUploadUrl(owner, {
      folderId: rootId,
      name: 'trojan.pdf',
      mimeType: 'application/pdf',
      sizeBytes: HTML_BYTES.byteLength,
    });
    const storageKey = await trackKey(target.fileId);

    // The signed URL constrains neither type nor size, which is the whole point.
    await putObject(target.uploadUrl, HTML_BYTES, 'text/html');

    await expect(files.completeUpload(owner, target.fileId)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(await prisma.file.findUnique({ where: { id: target.fileId } })).toBeNull();
    expect(await storage.getObjectInfo(storageKey)).toBeNull();
  });

  it('refuses to confirm a file whose bytes never arrived', async () => {
    const target = await files.createUploadUrl(owner, {
      folderId: rootId,
      name: 'never-sent.pdf',
      mimeType: 'application/pdf',
      sizeBytes: PDF_BYTES.byteLength,
    });
    await trackKey(target.fileId);

    await expect(files.completeUpload(owner, target.fileId)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('reuses an abandoned pending row instead of colliding with it', async () => {
    const first = await files.createUploadUrl(owner, {
      folderId: rootId,
      name: 'retry.pdf',
      mimeType: 'application/pdf',
      sizeBytes: PDF_BYTES.byteLength,
    });
    await trackKey(first.fileId);

    // The upload failed; the user tries the same file again.
    const second = await files.createUploadUrl(owner, {
      folderId: rootId,
      name: 'retry.pdf',
      mimeType: 'application/pdf',
      sizeBytes: PDF_BYTES.byteLength,
    });

    expect(second.fileId).toBe(first.fileId);
    expect(second.name).toBe('retry.pdf');
    expect(await prisma.file.count({ where: { folderId: rootId } })).toBe(1);
  });

  it('renames around a confirmed file rather than failing the upload', async () => {
    const first = await files.createUploadUrl(owner, {
      folderId: rootId,
      name: 'report.pdf',
      mimeType: 'application/pdf',
      sizeBytes: PDF_BYTES.byteLength,
    });
    await trackKey(first.fileId);
    await putObject(first.uploadUrl, PDF_BYTES, 'application/pdf');
    await files.completeUpload(owner, first.fileId);

    const second = await files.createUploadUrl(owner, {
      folderId: rootId,
      name: 'report.pdf',
      mimeType: 'application/pdf',
      sizeBytes: PDF_BYTES.byteLength,
    });
    await trackKey(second.fileId);

    expect(second.fileId).not.toBe(first.fileId);
    expect(second.name).toBe('report (2).pdf');
  });

  it('confirming twice is not an error', async () => {
    const target = await files.createUploadUrl(owner, {
      folderId: rootId,
      name: 'twice.pdf',
      mimeType: 'application/pdf',
      sizeBytes: PDF_BYTES.byteLength,
    });
    await trackKey(target.fileId);
    await putObject(target.uploadUrl, PDF_BYTES, 'application/pdf');

    await files.completeUpload(owner, target.fileId);
    await expect(files.completeUpload(owner, target.fileId)).resolves.toMatchObject({
      name: 'twice.pdf',
    });
  });

  it('rejects a declared non-PDF before signing anything', async () => {
    await expect(
      files.createUploadUrl(owner, {
        folderId: rootId,
        name: 'notes.pdf',
        mimeType: 'text/html',
        sizeBytes: 10,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(await prisma.file.count()).toBe(0);
  });

  it('rejects a declared oversize file before signing anything', async () => {
    await expect(
      files.createUploadUrl(owner, {
        folderId: rootId,
        name: 'huge.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 51 * 1024 * 1024,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(await prisma.file.count()).toBe(0);
  });
});

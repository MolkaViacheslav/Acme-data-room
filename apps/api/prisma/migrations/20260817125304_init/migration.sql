-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('PENDING', 'READY');

-- CreateEnum
CREATE TYPE "ShareResourceType" AS ENUM ('DATA_ROOM', 'FOLDER', 'FILE');

-- CreateEnum
CREATE TYPE "ShareMode" AS ENUM ('PUBLIC_LINK', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "ShareRole" AS ENUM ('VIEWER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataRoom" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "rootFolderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Folder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dataRoomId" TEXT NOT NULL,
    "parentId" TEXT,
    "path" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Folder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "File" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "dataRoomId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadStatus" "UploadStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Share" (
    "id" TEXT NOT NULL,
    "resourceType" "ShareResourceType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "dataRoomId" TEXT NOT NULL,
    "mode" "ShareMode" NOT NULL,
    "role" "ShareRole" NOT NULL DEFAULT 'VIEWER',
    "token" TEXT,
    "createdById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Share_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareRecipient" (
    "id" TEXT NOT NULL,
    "shareId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT,

    CONSTRAINT "ShareRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "DataRoom_rootFolderId_key" ON "DataRoom"("rootFolderId");

-- CreateIndex
CREATE INDEX "DataRoom_ownerId_idx" ON "DataRoom"("ownerId");

-- CreateIndex
CREATE INDEX "Folder_dataRoomId_path_idx" ON "Folder"("dataRoomId", "path");

-- CreateIndex
CREATE UNIQUE INDEX "Folder_parentId_name_key" ON "Folder"("parentId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "File_storageKey_key" ON "File"("storageKey");

-- CreateIndex
CREATE INDEX "File_folderId_name_idx" ON "File"("folderId", "name");

-- CreateIndex
CREATE INDEX "File_folderId_createdAt_id_idx" ON "File"("folderId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "File_dataRoomId_idx" ON "File"("dataRoomId");

-- CreateIndex
CREATE UNIQUE INDEX "File_folderId_name_key" ON "File"("folderId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Share_token_key" ON "Share"("token");

-- CreateIndex
CREATE INDEX "Share_dataRoomId_idx" ON "Share"("dataRoomId");

-- CreateIndex
CREATE INDEX "Share_resourceType_resourceId_idx" ON "Share"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "ShareRecipient_email_idx" ON "ShareRecipient"("email");

-- CreateIndex
CREATE INDEX "ShareRecipient_userId_idx" ON "ShareRecipient"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ShareRecipient_shareId_email_key" ON "ShareRecipient"("shareId", "email");

-- AddForeignKey
ALTER TABLE "DataRoom" ADD CONSTRAINT "DataRoom_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataRoom" ADD CONSTRAINT "DataRoom_rootFolderId_fkey" FOREIGN KEY ("rootFolderId") REFERENCES "Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_dataRoomId_fkey" FOREIGN KEY ("dataRoomId") REFERENCES "DataRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_dataRoomId_fkey" FOREIGN KEY ("dataRoomId") REFERENCES "DataRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Share" ADD CONSTRAINT "Share_dataRoomId_fkey" FOREIGN KEY ("dataRoomId") REFERENCES "DataRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Share" ADD CONSTRAINT "Share_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareRecipient" ADD CONSTRAINT "ShareRecipient_shareId_fkey" FOREIGN KEY ("shareId") REFERENCES "Share"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareRecipient" ADD CONSTRAINT "ShareRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

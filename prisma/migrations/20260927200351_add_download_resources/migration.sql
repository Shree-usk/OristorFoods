-- CreateEnum
CREATE TYPE "DownloadResourceStatus" AS ENUM ('Draft', 'Published', 'Archived');

-- CreateTable
CREATE TABLE "DownloadCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DownloadCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DownloadResource" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "thumbnailUrl" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "categoryId" TEXT NOT NULL,
    "requiresAuth" BOOLEAN NOT NULL DEFAULT false,
    "status" "DownloadResourceStatus" NOT NULL DEFAULT 'Draft',
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DownloadResource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DownloadCategory_slug_key" ON "DownloadCategory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "DownloadResource_slug_key" ON "DownloadResource"("slug");

-- CreateIndex
CREATE INDEX "DownloadResource_status_categoryId_idx" ON "DownloadResource"("status", "categoryId");

-- AddForeignKey
ALTER TABLE "DownloadResource" ADD CONSTRAINT "DownloadResource_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "DownloadCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


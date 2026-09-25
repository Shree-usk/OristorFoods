-- CreateEnum
CREATE TYPE "VideoProvider" AS ENUM ('Youtube', 'Vimeo', 'SelfHosted');

-- CreateEnum
CREATE TYPE "CookingTipStatus" AS ENUM ('Draft', 'Published');

-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN     "captionsUrl" TEXT,
ADD COLUMN     "videoDurationSeconds" INTEGER,
ADD COLUMN     "videoProvider" "VideoProvider",
ADD COLUMN     "videoUrl" TEXT;

-- CreateTable
CREATE TABLE "CookingTip" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "bodyContent" TEXT NOT NULL,
    "videoUrl" TEXT,
    "videoProvider" "VideoProvider",
    "imageUrl" TEXT,
    "topicTag" TEXT NOT NULL,
    "status" "CookingTipStatus" NOT NULL DEFAULT 'Draft',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CookingTip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CookingTipProductRef" (
    "id" TEXT NOT NULL,
    "cookingTipId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "CookingTipProductRef_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CookingTip_slug_key" ON "CookingTip"("slug");

-- CreateIndex
CREATE INDEX "CookingTip_status_publishedAt_idx" ON "CookingTip"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "CookingTip_status_topicTag_idx" ON "CookingTip"("status", "topicTag");

-- CreateIndex
CREATE INDEX "CookingTipProductRef_productId_idx" ON "CookingTipProductRef"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "CookingTipProductRef_cookingTipId_productId_key" ON "CookingTipProductRef"("cookingTipId", "productId");

-- AddForeignKey
ALTER TABLE "CookingTipProductRef" ADD CONSTRAINT "CookingTipProductRef_cookingTipId_fkey" FOREIGN KEY ("cookingTipId") REFERENCES "CookingTip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CookingTipProductRef" ADD CONSTRAINT "CookingTipProductRef_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;


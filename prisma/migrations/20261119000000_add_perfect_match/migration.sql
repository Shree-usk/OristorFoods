-- CreateEnum
CREATE TYPE "PerfectMatchStatus" AS ENUM ('Draft', 'Published');

-- AlterEnum
ALTER TYPE "AdminModule" ADD VALUE 'PerfectMatch';

-- AlterEnum
ALTER TYPE "HomepageSectionType" ADD VALUE 'PerfectMatch';

-- CreateTable
CREATE TABLE "PerfectMatchSetting" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "eyebrow" TEXT,
    "heading" TEXT,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerfectMatchSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerfectMatchProduct" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "kicker" TEXT,
    "promoDescriptionOverride" TEXT,
    "isDefaultFeatured" BOOLEAN NOT NULL DEFAULT false,
    "status" "PerfectMatchStatus" NOT NULL DEFAULT 'Draft',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerfectMatchProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerfectMatchPairing" (
    "id" TEXT NOT NULL,
    "perfectMatchProductId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT NOT NULL,
    "imageAlt" TEXT,
    "categoryLabel" TEXT,
    "supportingTag" TEXT,
    "status" "PerfectMatchStatus" NOT NULL DEFAULT 'Draft',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerfectMatchPairing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PerfectMatchProduct_productId_key" ON "PerfectMatchProduct"("productId");

-- CreateIndex
CREATE INDEX "PerfectMatchProduct_status_sortOrder_idx" ON "PerfectMatchProduct"("status", "sortOrder");

-- CreateIndex
CREATE INDEX "PerfectMatchPairing_perfectMatchProductId_status_sortOrder_idx" ON "PerfectMatchPairing"("perfectMatchProductId", "status", "sortOrder");

-- AddForeignKey
ALTER TABLE "PerfectMatchProduct" ADD CONSTRAINT "PerfectMatchProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerfectMatchPairing" ADD CONSTRAINT "PerfectMatchPairing_perfectMatchProductId_fkey" FOREIGN KEY ("perfectMatchProductId") REFERENCES "PerfectMatchProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;


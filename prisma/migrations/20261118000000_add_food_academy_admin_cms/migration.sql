
-- AlterEnum
ALTER TYPE "AdminModule" ADD VALUE 'FoodAcademy';

-- AlterTable
ALTER TABLE "FoodAcademyCategory" ADD COLUMN     "tileImageAlt" TEXT,
ADD COLUMN     "tileImageUrl" TEXT;

-- AlterTable
ALTER TABLE "FoodAcademyEntry" ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "FoodAcademyPageSetting" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "heroEyebrow" TEXT,
    "heroHeading" TEXT,
    "heroDescription" VARCHAR(500),
    "heroPrimaryCtaLabel" TEXT,
    "heroPrimaryCtaHref" TEXT,
    "heroSecondaryCtaLabel" TEXT,
    "heroSecondaryCtaHref" TEXT,
    "heroImageUrl" TEXT,
    "heroImageAlt" TEXT,
    "heroBadgeText" TEXT,
    "exploreHeading" TEXT,
    "exploreDescription" VARCHAR(400),
    "featuredHeading" TEXT,
    "featuredDescription" VARCHAR(400),
    "instagramEnabled" BOOLEAN NOT NULL DEFAULT true,
    "instagramHeading" TEXT,
    "instagramDescription" VARCHAR(400),
    "instagramCtaLabel" TEXT,
    "instagramCtaHref" TEXT,
    "seoTitle" TEXT,
    "seoMetaDescription" VARCHAR(300),
    "seoCanonicalPath" TEXT,
    "seoOgImageUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoodAcademyPageSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FoodAcademyEntry_status_isFeatured_sortOrder_idx" ON "FoodAcademyEntry"("status", "isFeatured", "sortOrder");


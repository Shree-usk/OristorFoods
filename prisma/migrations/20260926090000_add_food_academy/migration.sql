-- CreateEnum
CREATE TYPE "FoodAcademyEntryStatus" AS ENUM ('Draft', 'Published');

-- CreateEnum
CREATE TYPE "FoodAcademyContentType" AS ENUM ('Article', 'Guide', 'Course');

-- CreateTable
CREATE TABLE "FoodAcademyCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "ContentStatus" NOT NULL DEFAULT 'Active',

    CONSTRAINT "FoodAcademyCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodAcademyEntry" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "heroImageUrl" TEXT,
    "contentType" "FoodAcademyContentType" NOT NULL,
    "categoryId" TEXT NOT NULL,
    "bodyContent" TEXT,
    "readingTimeMinutes" INTEGER,
    "authorName" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "status" "FoodAcademyEntryStatus" NOT NULL DEFAULT 'Draft',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoodAcademyEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodAcademySection" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "sectionNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "bodyContent" TEXT NOT NULL,
    "imageUrl" TEXT,

    CONSTRAINT "FoodAcademySection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodAcademyRecipeRef" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,

    CONSTRAINT "FoodAcademyRecipeRef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodAcademyProductRef" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "FoodAcademyProductRef_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FoodAcademyCategory_slug_key" ON "FoodAcademyCategory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "FoodAcademyEntry_slug_key" ON "FoodAcademyEntry"("slug");

-- CreateIndex
CREATE INDEX "FoodAcademyEntry_status_publishedAt_idx" ON "FoodAcademyEntry"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "FoodAcademyEntry_status_categoryId_idx" ON "FoodAcademyEntry"("status", "categoryId");

-- CreateIndex
CREATE INDEX "FoodAcademyEntry_status_contentType_idx" ON "FoodAcademyEntry"("status", "contentType");

-- CreateIndex
CREATE INDEX "FoodAcademyEntry_status_isFeatured_idx" ON "FoodAcademyEntry"("status", "isFeatured");

-- CreateIndex
CREATE UNIQUE INDEX "FoodAcademySection_entryId_sectionNumber_key" ON "FoodAcademySection"("entryId", "sectionNumber");

-- CreateIndex
CREATE INDEX "FoodAcademyRecipeRef_recipeId_idx" ON "FoodAcademyRecipeRef"("recipeId");

-- CreateIndex
CREATE UNIQUE INDEX "FoodAcademyRecipeRef_entryId_recipeId_key" ON "FoodAcademyRecipeRef"("entryId", "recipeId");

-- CreateIndex
CREATE INDEX "FoodAcademyProductRef_productId_idx" ON "FoodAcademyProductRef"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "FoodAcademyProductRef_entryId_productId_key" ON "FoodAcademyProductRef"("entryId", "productId");

-- AddForeignKey
ALTER TABLE "FoodAcademyEntry" ADD CONSTRAINT "FoodAcademyEntry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FoodAcademyCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodAcademySection" ADD CONSTRAINT "FoodAcademySection_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "FoodAcademyEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodAcademyRecipeRef" ADD CONSTRAINT "FoodAcademyRecipeRef_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "FoodAcademyEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodAcademyRecipeRef" ADD CONSTRAINT "FoodAcademyRecipeRef_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodAcademyProductRef" ADD CONSTRAINT "FoodAcademyProductRef_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "FoodAcademyEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodAcademyProductRef" ADD CONSTRAINT "FoodAcademyProductRef_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;


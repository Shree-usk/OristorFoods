-- CreateEnum
CREATE TYPE "ProductExportSpecType" AS ENUM ('PackSizes', 'CartonPacking', 'Moq', 'CartonDimensions', 'GrossCartonWeight', 'ShelfLife', 'StorageConditions', 'PackagingType', 'ExportAvailability', 'ShippingTerms');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "exportSpecSectionEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "exportSpecSectionHeading" TEXT,
ADD COLUMN     "preparationSectionEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "preparationSectionHeading" TEXT,
ADD COLUMN     "preparationSectionSubtitle" TEXT,
ADD COLUMN     "promiseSectionEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "promiseSectionHeading" TEXT,
ADD COLUMN     "showStorySectionsOnStandardPdp" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ProductPromiseAttribute" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "iconImageUrl" TEXT,
    "heading" TEXT NOT NULL,
    "description" TEXT,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductPromiseAttribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductPreparationStage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "stageNumber" TEXT NOT NULL,
    "heading" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT NOT NULL,
    "imageAlt" TEXT,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductPreparationStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductExportSpecItem" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "specType" "ProductExportSpecType" NOT NULL,
    "value" TEXT NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductExportSpecItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductPromiseAttribute_productId_idx" ON "ProductPromiseAttribute"("productId");

-- CreateIndex
CREATE INDEX "ProductPreparationStage_productId_idx" ON "ProductPreparationStage"("productId");

-- CreateIndex
CREATE INDEX "ProductExportSpecItem_productId_idx" ON "ProductExportSpecItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductExportSpecItem_productId_specType_key" ON "ProductExportSpecItem"("productId", "specType");

-- AddForeignKey
ALTER TABLE "ProductPromiseAttribute" ADD CONSTRAINT "ProductPromiseAttribute_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPreparationStage" ADD CONSTRAINT "ProductPreparationStage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductExportSpecItem" ADD CONSTRAINT "ProductExportSpecItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;


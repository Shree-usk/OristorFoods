-- Story 3 (Custom Travel/Export Packaging). Purely additive: two new
-- tables (PackagingMethod, ProductPackagingOption) and nullable columns
-- on CartItem/OrderItem, plus CartItem's unique index widened by one more
-- nullable column. No data loss, no renames. Generated via
-- `prisma migrate diff --from-schema=<git-show-HEAD-copy> --to-schema
-- prisma/schema.prisma --script` (not --from-config-datasource, which
-- only works when the live local DB still reflects the pre-change state).

-- CreateEnum
CREATE TYPE "PackagingAvailability" AS ENUM ('Local', 'Export', 'Both');

-- CreateEnum
CREATE TYPE "PackagingDeclaredAvailability" AS ENUM ('Local', 'Export');

-- CreateEnum
CREATE TYPE "PackagingOptionStatus" AS ENUM ('Active', 'TemporarilyUnavailable', 'Discontinued');

-- DropIndex
DROP INDEX "CartItem_cartId_productId_variantId_bundleInstanceId_key";

-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN     "packagingChargeSnapshot" DECIMAL(10,2),
ADD COLUMN     "packagingDeclaredAvailability" "PackagingDeclaredAvailability",
ADD COLUMN     "packagingOptionId" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "packagingCharge" DECIMAL(10,2),
ADD COLUMN     "packagingDeclaredAvailability" "PackagingDeclaredAvailability",
ADD COLUMN     "packagingMethodName" TEXT,
ADD COLUMN     "packagingOptionId" TEXT,
ADD COLUMN     "packagingRequiresManualReview" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PackagingMethod" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackagingMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductPackagingOption" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "packagingMethodId" TEXT NOT NULL,
    "charge" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "minQuantity" INTEGER,
    "availability" "PackagingAvailability" NOT NULL DEFAULT 'Both',
    "requiresManualReview" BOOLEAN NOT NULL DEFAULT false,
    "leadTimeDays" INTEGER,
    "shelfLifeDays" INTEGER,
    "shelfLifeText" TEXT,
    "customerInstructions" TEXT,
    "availabilityStartDate" TIMESTAMP(3),
    "availabilityEndDate" TIMESTAMP(3),
    "orderCutoffDate" TIMESTAMP(3),
    "status" "PackagingOptionStatus" NOT NULL DEFAULT 'Active',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductPackagingOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PackagingMethod_name_key" ON "PackagingMethod"("name");

-- CreateIndex
CREATE INDEX "ProductPackagingOption_productId_idx" ON "ProductPackagingOption"("productId");

-- CreateIndex
CREATE INDEX "ProductPackagingOption_packagingMethodId_idx" ON "ProductPackagingOption"("packagingMethodId");

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_cartId_productId_variantId_bundleInstanceId_packag_key" ON "CartItem"("cartId", "productId", "variantId", "bundleInstanceId", "packagingOptionId");

-- AddForeignKey
ALTER TABLE "ProductPackagingOption" ADD CONSTRAINT "ProductPackagingOption_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPackagingOption" ADD CONSTRAINT "ProductPackagingOption_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPackagingOption" ADD CONSTRAINT "ProductPackagingOption_packagingMethodId_fkey" FOREIGN KEY ("packagingMethodId") REFERENCES "PackagingMethod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_packagingOptionId_fkey" FOREIGN KEY ("packagingOptionId") REFERENCES "ProductPackagingOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_packagingOptionId_fkey" FOREIGN KEY ("packagingOptionId") REFERENCES "ProductPackagingOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;


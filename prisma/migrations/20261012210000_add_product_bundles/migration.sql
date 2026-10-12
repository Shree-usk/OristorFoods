-- Story 2 (Product Bundles). Hand-edited from `prisma migrate diff`'s raw
-- output: the raw diff proposed DROP COLUMN "priceOverride" + ADD COLUMN
-- "fixedPrice" (data loss) — changed to RENAME COLUMN, since it's the same
-- Decimal(10,2) shape and nothing should be lost even though no production
-- code ever wrote a value there. Also hand-added a safe backfill for the
-- new NOT NULL "name" column (any pre-existing ProductBundle row, e.g. the
-- seed's demo gift-set, has no name yet) and a DEFAULT for "updatedAt" —
-- the raw diff left both as bare NOT NULL with no way to satisfy existing
-- rows.

-- CreateEnum
CREATE TYPE "BundleType" AS ENUM ('Fixed', 'Selectable', 'MixAndMatch');

-- CreateEnum
CREATE TYPE "BundleDiscountType" AS ENUM ('FixedPrice', 'PercentageOff', 'FixedAmountOff');

-- CreateEnum
CREATE TYPE "BundleStockMode" AS ENUM ('Derived', 'OwnStock');

-- DropIndex
DROP INDEX "CartItem_cartId_productId_variantId_key";

-- AlterTable
ALTER TABLE "ProductBundle" RENAME COLUMN "priceOverride" TO "fixedPrice";

-- AlterTable
ALTER TABLE "ProductBundle" ADD COLUMN     "amountOff" DECIMAL(10,2),
ADD COLUMN     "bundleType" "BundleType" NOT NULL DEFAULT 'Fixed',
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "discountType" "BundleDiscountType",
ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "inStock" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "maxQuantity" INTEGER,
ADD COLUMN     "minQuantity" INTEGER,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "percentOff" DECIMAL(5,2),
ADD COLUMN     "startDate" TIMESTAMP(3),
ADD COLUMN     "status" "ContentStatus" NOT NULL DEFAULT 'Active',
ADD COLUMN     "stockMode" "BundleStockMode" NOT NULL DEFAULT 'Derived',
ADD COLUMN     "stockQuantity" INTEGER,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill: any pre-existing bundle (e.g. the seed's demo gift-set) gets
-- its parent Product's own name as a starting point — an admin can rename
-- it from the new Bundle tab afterward.
UPDATE "ProductBundle"
SET "name" = (SELECT "name" FROM "Product" WHERE "Product"."id" = "ProductBundle"."productId")
WHERE "name" IS NULL;

ALTER TABLE "ProductBundle" ALTER COLUMN "name" SET NOT NULL;

-- AlterTable
ALTER TABLE "BundleItem" ADD COLUMN     "componentVariantId" TEXT,
ADD COLUMN     "isRequired" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "maxQuantity" INTEGER,
ADD COLUMN     "minQuantity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN     "bundleId" TEXT,
ADD COLUMN     "bundleInstanceId" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "bundleId" TEXT,
ADD COLUMN     "bundleInstanceId" TEXT,
ADD COLUMN     "bundleName" TEXT;

-- CreateTable
CREATE TABLE "BundleImage" (
    "id" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "altText" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BundleImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BundleImage_bundleId_idx" ON "BundleImage"("bundleId");

-- CreateIndex
CREATE INDEX "BundleItem_componentVariantId_idx" ON "BundleItem"("componentVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_cartId_productId_variantId_bundleInstanceId_key" ON "CartItem"("cartId", "productId", "variantId", "bundleInstanceId");

-- AddForeignKey
ALTER TABLE "BundleImage" ADD CONSTRAINT "BundleImage_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "ProductBundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleItem" ADD CONSTRAINT "BundleItem_componentVariantId_fkey" FOREIGN KEY ("componentVariantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "ProductBundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "ProductBundle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

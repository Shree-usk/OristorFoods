-- CreateEnum
CREATE TYPE "PackagingChargeType" AS ENUM ('Fixed', 'PerGram');

-- AlterTable
ALTER TABLE "ProductPackagingOption" ADD COLUMN     "chargeType" "PackagingChargeType" NOT NULL DEFAULT 'Fixed',
ADD COLUMN     "minOrderWeightGrams" INTEGER,
ADD COLUMN     "minPackagingCharge" DECIMAL(10,2),
ADD COLUMN     "ratePerGram" DECIMAL(10,4);

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "packagingChargeType" "PackagingChargeType",
ADD COLUMN     "packagingMinimumChargeApplied" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "packagingNetWeightGrams" INTEGER,
ADD COLUMN     "packagingRatePerGram" DECIMAL(10,4);


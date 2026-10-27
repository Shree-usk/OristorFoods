-- DropIndex
DROP INDEX "CartItem_cartId_productId_variantId_bundleInstanceId_packag_key";

-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN     "giftInstanceId" TEXT,
ADD COLUMN     "giftOfferId" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "giftOfferId" TEXT,
ADD COLUMN     "giftOfferName" TEXT,
ADD COLUMN     "isGiftLine" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "GiftOffer" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'Active',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "minQuantity" INTEGER,
    "minSpend" DECIMAL(10,2),
    "giftProductId" TEXT NOT NULL,
    "giftVariantId" TEXT,
    "giftQuantity" INTEGER NOT NULL DEFAULT 1,
    "giftStockLimit" INTEGER,
    "redemptionLimitGlobal" INTEGER,
    "redemptionLimitPerCustomer" INTEGER,
    "autoInclude" BOOLEAN NOT NULL DEFAULT false,
    "stackable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GiftOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftOfferRedemption" (
    "id" TEXT NOT NULL,
    "giftOfferId" TEXT NOT NULL,
    "userId" TEXT,
    "guestEmail" TEXT,
    "orderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiftOfferRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GiftOffer_productId_key" ON "GiftOffer"("productId");

-- CreateIndex
CREATE INDEX "GiftOffer_productId_idx" ON "GiftOffer"("productId");

-- CreateIndex
CREATE INDEX "GiftOffer_status_startDate_endDate_idx" ON "GiftOffer"("status", "startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "GiftOfferRedemption_orderId_key" ON "GiftOfferRedemption"("orderId");

-- CreateIndex
CREATE INDEX "GiftOfferRedemption_giftOfferId_idx" ON "GiftOfferRedemption"("giftOfferId");

-- CreateIndex
CREATE INDEX "GiftOfferRedemption_giftOfferId_userId_idx" ON "GiftOfferRedemption"("giftOfferId", "userId");

-- CreateIndex
CREATE INDEX "GiftOfferRedemption_giftOfferId_guestEmail_idx" ON "GiftOfferRedemption"("giftOfferId", "guestEmail");

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_cartId_productId_variantId_bundleInstanceId_packag_key" ON "CartItem"("cartId", "productId", "variantId", "bundleInstanceId", "packagingOptionId", "giftInstanceId");

-- AddForeignKey
ALTER TABLE "GiftOffer" ADD CONSTRAINT "GiftOffer_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftOffer" ADD CONSTRAINT "GiftOffer_giftProductId_fkey" FOREIGN KEY ("giftProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftOffer" ADD CONSTRAINT "GiftOffer_giftVariantId_fkey" FOREIGN KEY ("giftVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftOfferRedemption" ADD CONSTRAINT "GiftOfferRedemption_giftOfferId_fkey" FOREIGN KEY ("giftOfferId") REFERENCES "GiftOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftOfferRedemption" ADD CONSTRAINT "GiftOfferRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftOfferRedemption" ADD CONSTRAINT "GiftOfferRedemption_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_giftOfferId_fkey" FOREIGN KEY ("giftOfferId") REFERENCES "GiftOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_giftOfferId_fkey" FOREIGN KEY ("giftOfferId") REFERENCES "GiftOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

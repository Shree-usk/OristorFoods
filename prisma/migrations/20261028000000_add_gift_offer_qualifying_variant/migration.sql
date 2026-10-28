-- AlterTable
ALTER TABLE "GiftOffer" ADD COLUMN     "qualifyingVariantId" TEXT;

-- AddForeignKey
ALTER TABLE "GiftOffer" ADD CONSTRAINT "GiftOffer_qualifyingVariantId_fkey" FOREIGN KEY ("qualifyingVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


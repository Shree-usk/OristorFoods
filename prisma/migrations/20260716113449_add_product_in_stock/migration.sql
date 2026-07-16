-- AlterTable
ALTER TABLE "Product" ADD COLUMN "inStock" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "Product_status_inStock_idx" ON "Product"("status", "inStock");

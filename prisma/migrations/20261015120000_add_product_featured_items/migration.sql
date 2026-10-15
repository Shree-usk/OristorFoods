-- CreateTable
CREATE TABLE "ProductFeaturedItem" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "imageAlt" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductFeaturedItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductFeaturedItem_productId_idx" ON "ProductFeaturedItem"("productId");

-- AddForeignKey
ALTER TABLE "ProductFeaturedItem" ADD CONSTRAINT "ProductFeaturedItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

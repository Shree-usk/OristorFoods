-- CreateTable
CREATE TABLE "ProductInspirationCard" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "imageAlt" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductInspirationCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductInspirationCard_productId_idx" ON "ProductInspirationCard"("productId");

-- AddForeignKey
ALTER TABLE "ProductInspirationCard" ADD CONSTRAINT "ProductInspirationCard_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

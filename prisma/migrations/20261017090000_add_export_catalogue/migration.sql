-- AlterTable
ALTER TABLE "Collection" ADD COLUMN     "exportDisplayOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isExportFeatured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "showOnExportPage" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "exportDescription" VARCHAR(2000),
ADD COLUMN     "exportDisplayOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isExportEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isExportFeatured" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ExportCatalogueSetting" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "title" TEXT,
    "introText" VARCHAR(2000),
    "showPricing" BOOLEAN NOT NULL DEFAULT false,
    "pdfFields" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExportCatalogueSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ExportEnquiryToProduct" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ExportEnquiryToProduct_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_ExportEnquiryToProduct_B_index" ON "_ExportEnquiryToProduct"("B");

-- CreateIndex
CREATE INDEX "Product_status_isExportEnabled_idx" ON "Product"("status", "isExportEnabled");

-- AddForeignKey
ALTER TABLE "_ExportEnquiryToProduct" ADD CONSTRAINT "_ExportEnquiryToProduct_A_fkey" FOREIGN KEY ("A") REFERENCES "ExportEnquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ExportEnquiryToProduct" ADD CONSTRAINT "_ExportEnquiryToProduct_B_fkey" FOREIGN KEY ("B") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

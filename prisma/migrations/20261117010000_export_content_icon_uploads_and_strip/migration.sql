-- AlterTable
ALTER TABLE "ExportSolutionCard" ADD COLUMN "iconImageUrl" TEXT;

-- AlterTable
ALTER TABLE "ExportProcessStep" ADD COLUMN "iconImageUrl" TEXT;

-- CreateTable
CREATE TABLE "ExportCertificationStripItem" (
    "id" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "imageUrl" TEXT,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExportCertificationStripItem_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "ProductPromiseAttribute" DROP COLUMN "icon",
DROP COLUMN "iconImageUrl",
ADD COLUMN     "imageAlt" TEXT,
ADD COLUMN     "imageUrl" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ProductExportSpecItem" ADD COLUMN     "imageAlt" TEXT,
ADD COLUMN     "imageUrl" TEXT NOT NULL;


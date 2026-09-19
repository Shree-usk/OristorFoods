-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "benefits" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "servingSuggestions" TEXT[] DEFAULT ARRAY[]::TEXT[];

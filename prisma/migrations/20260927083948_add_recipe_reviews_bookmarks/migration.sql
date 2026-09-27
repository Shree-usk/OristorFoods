-- CreateEnum
CREATE TYPE "RecipeReviewStatus" AS ENUM ('Pending', 'Approved', 'Rejected', 'Hidden');

-- CreateTable
CREATE TABLE "RecipeReview" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "reviewText" TEXT,
    "status" "RecipeReviewStatus" NOT NULL DEFAULT 'Pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipeReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeBookmark" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipeBookmark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecipeReview_recipeId_status_idx" ON "RecipeReview"("recipeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeReview_recipeId_customerId_key" ON "RecipeReview"("recipeId", "customerId");

-- CreateIndex
CREATE INDEX "RecipeBookmark_customerId_idx" ON "RecipeBookmark"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeBookmark_recipeId_customerId_key" ON "RecipeBookmark"("recipeId", "customerId");

-- AddForeignKey
ALTER TABLE "RecipeReview" ADD CONSTRAINT "RecipeReview_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeReview" ADD CONSTRAINT "RecipeReview_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeBookmark" ADD CONSTRAINT "RecipeBookmark_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeBookmark" ADD CONSTRAINT "RecipeBookmark_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


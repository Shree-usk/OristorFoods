-- CreateEnum
CREATE TYPE "RecipeStatus" AS ENUM ('Draft', 'Review', 'Approved', 'Published', 'Archived');

-- CreateEnum
CREATE TYPE "RecipeDifficulty" AS ENUM ('Easy', 'Medium', 'Hard');

-- CreateTable
CREATE TABLE "RecipeCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "ContentStatus" NOT NULL DEFAULT 'Active',
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipeCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DietaryTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "ContentStatus" NOT NULL DEFAULT 'Active',

    CONSTRAINT "DietaryTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeDietaryTag" (
    "recipeId" TEXT NOT NULL,
    "dietaryTagId" TEXT NOT NULL,

    CONSTRAINT "RecipeDietaryTag_pkey" PRIMARY KEY ("recipeId","dietaryTagId")
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "heroImage" TEXT NOT NULL,
    "heroImageAlt" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "cuisine" TEXT,
    "difficulty" "RecipeDifficulty" NOT NULL,
    "prepTimeMinutes" INTEGER NOT NULL,
    "cookTimeMinutes" INTEGER NOT NULL,
    "totalTimeMinutes" INTEGER NOT NULL,
    "servings" INTEGER NOT NULL,
    "status" "RecipeStatus" NOT NULL DEFAULT 'Draft',
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "avgRating" DECIMAL(2,1),
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecipeCategory_slug_key" ON "RecipeCategory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "DietaryTag_name_key" ON "DietaryTag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "DietaryTag_slug_key" ON "DietaryTag"("slug");

-- CreateIndex
CREATE INDEX "RecipeDietaryTag_dietaryTagId_idx" ON "RecipeDietaryTag"("dietaryTagId");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_slug_key" ON "Recipe"("slug");

-- CreateIndex
CREATE INDEX "Recipe_status_publishedAt_idx" ON "Recipe"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "Recipe_status_categoryId_idx" ON "Recipe"("status", "categoryId");

-- CreateIndex
CREATE INDEX "Recipe_status_totalTimeMinutes_idx" ON "Recipe"("status", "totalTimeMinutes");

-- CreateIndex
CREATE INDEX "Recipe_status_viewCount_idx" ON "Recipe"("status", "viewCount");

-- CreateIndex
CREATE INDEX "Recipe_status_isFeatured_idx" ON "Recipe"("status", "isFeatured");

-- AddForeignKey
ALTER TABLE "RecipeDietaryTag" ADD CONSTRAINT "RecipeDietaryTag_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeDietaryTag" ADD CONSTRAINT "RecipeDietaryTag_dietaryTagId_fkey" FOREIGN KEY ("dietaryTagId") REFERENCES "DietaryTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "RecipeCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


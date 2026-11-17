-- CreateTable
CREATE TABLE "ExportSolutionCard" (
    "id" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "icon" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExportSolutionCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportPageHeroSetting" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "backgroundImageUrl" TEXT,
    "backgroundImageAlt" TEXT,
    "eyebrow" TEXT,
    "headline" TEXT,
    "description" VARCHAR(500),
    "primaryCtaLabel" TEXT,
    "primaryCtaHref" TEXT,
    "secondaryCtaLabel" TEXT,
    "secondaryCtaHref" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExportPageHeroSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportProcessStep" (
    "id" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "icon" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExportProcessStep_pkey" PRIMARY KEY ("id")
);

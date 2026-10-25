-- CreateTable
CREATE TABLE "ExportHeroSetting" (
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
    "statLine" JSONB,
    "badgeEyebrow" TEXT,
    "badgeHeadline" TEXT,
    "badgeDescription" VARCHAR(300),
    "badgeCtaLabel" TEXT,
    "badgeCtaHref" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExportHeroSetting_pkey" PRIMARY KEY ("id")
);

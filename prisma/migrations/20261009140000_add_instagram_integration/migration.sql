-- CreateTable
CREATE TABLE "InstagramIntegrationSetting" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "businessAccountId" TEXT,
    "accessToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstagramIntegrationSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstagramPost" (
    "id" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "permalink" TEXT NOT NULL,
    "caption" VARCHAR(2200),
    "postedAt" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstagramPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InstagramPost_postedAt_idx" ON "InstagramPost"("postedAt");

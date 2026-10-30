-- CreateTable
CREATE TABLE "AnnouncementBarSetting" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "message" TEXT,
    "linkLabel" TEXT,
    "linkHref" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnnouncementBarSetting_pkey" PRIMARY KEY ("id")
);

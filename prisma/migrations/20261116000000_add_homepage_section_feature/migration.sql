-- CreateTable
CREATE TABLE "HomepageSectionFeature" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "icon" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomepageSectionFeature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HomepageSectionFeature_sectionId_idx" ON "HomepageSectionFeature"("sectionId");

-- AddForeignKey
ALTER TABLE "HomepageSectionFeature" ADD CONSTRAINT "HomepageSectionFeature_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "HomepageSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

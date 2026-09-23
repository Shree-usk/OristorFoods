-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('Pending', 'Answered', 'Approved', 'Published', 'Rejected');

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" "QuestionStatus" NOT NULL DEFAULT 'Pending',
    "answerText" TEXT,
    "answeredById" TEXT,
    "answeredAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Question_productId_status_publishedAt_idx" ON "Question"("productId", "status", "publishedAt");

-- CreateIndex
CREATE INDEX "Question_productId_userId_status_idx" ON "Question"("productId", "userId", "status");

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_answeredById_fkey" FOREIGN KEY ("answeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


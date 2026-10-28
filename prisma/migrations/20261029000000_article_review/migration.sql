-- CreateEnum
CREATE TYPE "ReviewState" AS ENUM ('pending', 'completed', 'error');

-- CreateTable
CREATE TABLE "ArticleReview" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "state" "ReviewState" NOT NULL DEFAULT 'pending',
    "secret" TEXT NOT NULL,
    "plagiarismPercent" DOUBLE PRECISION,
    "aiPercent" DOUBLE PRECISION,
    "combinedScore" DOUBLE PRECISION,
    "passMark" INTEGER,
    "passed" BOOLEAN,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ArticleReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArticleReview_articleId_createdAt_idx" ON "ArticleReview"("articleId", "createdAt");

-- AddForeignKey
ALTER TABLE "ArticleReview" ADD CONSTRAINT "ArticleReview_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

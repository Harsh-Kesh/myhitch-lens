-- MYHitch NexBoard's decisions on published articles (NexBoard plan 13zj)
-- CreateTable
CREATE TABLE "NexboardReview" (
    "articleId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reasons" JSONB NOT NULL DEFAULT '[]',
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedStatus" TEXT,
    "notifiedAt" TIMESTAMP(3),

    CONSTRAINT "NexboardReview_pkey" PRIMARY KEY ("articleId")
);

-- AddForeignKey
ALTER TABLE "NexboardReview" ADD CONSTRAINT "NexboardReview_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

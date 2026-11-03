-- AlterTable
ALTER TABLE "ArticleReview" ADD COLUMN     "maxPlagiarism" DOUBLE PRECISION,
ADD COLUMN     "maxAi" DOUBLE PRECISION,
ADD COLUMN     "plagiarismPassed" BOOLEAN,
ADD COLUMN     "aiPassed" BOOLEAN;

-- CreateEnum
CREATE TYPE "ArticleDestination" AS ENUM ('main_app', 'exchange_hub');

-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "destination" "ArticleDestination" NOT NULL DEFAULT 'main_app';

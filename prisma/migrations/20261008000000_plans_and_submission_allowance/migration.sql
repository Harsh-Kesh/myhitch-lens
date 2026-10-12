-- CreateEnum
CREATE TYPE "PlanCode" AS ENUM ('free', 'creator', 'professional', 'business');

-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('month', 'year');

-- AlterTable: Subscription (the legacy `tier` stays, now optional; everything is additive)
ALTER TABLE "Subscription" ALTER COLUMN "tier" DROP NOT NULL;
ALTER TABLE "Subscription"
  ADD COLUMN "plan" "PlanCode" NOT NULL DEFAULT 'free',
  ADD COLUMN "interval" "BillingInterval",
  ADD COLUMN "stripePriceId" TEXT,
  ADD COLUMN "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "extraSeats" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: Article gets the first-submission timestamp used for the monthly allowance
ALTER TABLE "Article" ADD COLUMN "submittedAt" TIMESTAMP(3);

-- Existing articles that already left draft count as submitted when they were created.
UPDATE "Article" SET "submittedAt" = "createdAt" WHERE "status" <> 'draft';

-- CreateIndex
CREATE INDEX "Article_authorId_submittedAt_idx" ON "Article"("authorId", "submittedAt");

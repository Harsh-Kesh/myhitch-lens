-- CreateEnum
CREATE TYPE "ExchangeOpportunityType" AS ENUM ('sponsorship', 'advertising', 'bidding', 'partnership', 'collaboration', 'other');

-- CreateEnum
CREATE TYPE "ExchangeOpportunityStatus" AS ENUM ('open', 'in_negotiation', 'agreement_pending', 'approved', 'published', 'rejected', 'cancelled');

-- AlterEnum
ALTER TYPE "ArticleStatus" ADD VALUE 'pending_exchange';

-- CreateTable
CREATE TABLE "ExchangeOpportunity" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "type" "ExchangeOpportunityType" NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ExchangeOpportunityStatus" NOT NULL DEFAULT 'open',
    "expectedValue" DECIMAL(12,2),
    "closingAt" TIMESTAMP(3),
    "brandPlacementNotes" TEXT,
    "sponsorAckRequirements" TEXT,
    "publicationChannel" TEXT NOT NULL DEFAULT 'MYHitch Lens',
    "commercialConditions" TEXT,
    "agreedBrandName" TEXT,
    "agreedValue" DECIMAL(12,2),
    "agreedTerms" TEXT,
    "creativeAsset" JSONB,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExchangeOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeOpportunityEvent" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeOpportunityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExchangeOpportunity_status_idx" ON "ExchangeOpportunity"("status");

-- CreateIndex
CREATE INDEX "ExchangeOpportunity_articleId_idx" ON "ExchangeOpportunity"("articleId");

-- CreateIndex
CREATE INDEX "ExchangeOpportunityEvent_opportunityId_idx" ON "ExchangeOpportunityEvent"("opportunityId");

-- AddForeignKey
ALTER TABLE "ExchangeOpportunity" ADD CONSTRAINT "ExchangeOpportunity_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangeOpportunity" ADD CONSTRAINT "ExchangeOpportunity_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangeOpportunity" ADD CONSTRAINT "ExchangeOpportunity_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangeOpportunityEvent" ADD CONSTRAINT "ExchangeOpportunityEvent_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "ExchangeOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangeOpportunityEvent" ADD CONSTRAINT "ExchangeOpportunityEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

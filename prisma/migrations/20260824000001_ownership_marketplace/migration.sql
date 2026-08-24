-- Ownership marketplace: article commercial ownership + bid change requests.
-- Additive & nullable only — safe, non-destructive.

-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "ownerId" TEXT;

-- AlterTable
ALTER TABLE "Bid" ADD COLUMN     "brandName" TEXT,
ADD COLUMN     "changeRequest" TEXT;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

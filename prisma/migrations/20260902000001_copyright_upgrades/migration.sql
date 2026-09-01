
-- AlterTable
ALTER TABLE "AssetFingerprint" ADD COLUMN     "phash" TEXT;

-- AlterTable
ALTER TABLE "DisputeTicket" ADD COLUMN     "appealStatus" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN     "appealText" TEXT,
ADD COLUMN     "appealedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "copyrightStrikes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "suspended" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "AssetFingerprint_phash_idx" ON "AssetFingerprint"("phash");



-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "license" TEXT NOT NULL DEFAULT 'all_rights_reserved',
ADD COLUMN     "rightsAttested" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "AssetFingerprint" (
    "id" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "uploaderId" TEXT,
    "license" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetFingerprint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssetFingerprint_sha256_key" ON "AssetFingerprint"("sha256");

-- CreateIndex
CREATE INDEX "AssetFingerprint_uploaderId_idx" ON "AssetFingerprint"("uploaderId");

-- AddForeignKey
ALTER TABLE "AssetFingerprint" ADD CONSTRAINT "AssetFingerprint_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


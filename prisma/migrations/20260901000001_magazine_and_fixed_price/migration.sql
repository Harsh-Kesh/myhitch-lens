
-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "magazineFeatureOrder" INTEGER,
ADD COLUMN     "magazineFeatured" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "saleType" TEXT NOT NULL DEFAULT 'auction';


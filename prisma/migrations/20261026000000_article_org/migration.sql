-- Company articles carry their company, so an individual author who also owns a
-- company (opened from the MYHitch app) keeps their own articles separate from the
-- company's. Additive only: existing rows are not changed (older company articles
-- are still found through their corporate author's membership).

-- AlterTable
ALTER TABLE "Article" ADD COLUMN IF NOT EXISTS "orgId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Article_orgId_idx" ON "Article"("orgId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Article" ADD CONSTRAINT "Article_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

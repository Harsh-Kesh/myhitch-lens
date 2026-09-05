-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('owner', 'editor', 'author');

-- AlterTable
ALTER TABLE "OrgMembership" ADD COLUMN     "orgRole" "OrgRole" NOT NULL DEFAULT 'author';

-- CreateIndex
CREATE INDEX "OrgMembership_orgId_orgRole_idx" ON "OrgMembership"("orgId", "orgRole");

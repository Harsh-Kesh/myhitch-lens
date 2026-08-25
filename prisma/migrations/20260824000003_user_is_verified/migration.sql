-- Blue mark: denormalized person-level verification flag on User.
-- Additive with a default — safe, non-destructive.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false;

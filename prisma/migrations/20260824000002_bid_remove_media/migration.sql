-- Structured change-request term: remove the author's media on ownership transfer.
-- Additive with a default — safe, non-destructive.

-- AlterTable
ALTER TABLE "Bid" ADD COLUMN     "removeMedia" BOOLEAN NOT NULL DEFAULT false;

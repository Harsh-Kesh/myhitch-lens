-- DropForeignKey
ALTER TABLE "Wallet" DROP CONSTRAINT "Wallet_userId_fkey";

-- CreateIndex
CREATE INDEX "Comment_articleId_idx" ON "Comment"("articleId");

-- CreateIndex
CREATE INDEX "DisputeTicket_status_idx" ON "DisputeTicket"("status");

-- CreateIndex
CREATE INDEX "DisputeTicket_reason_idx" ON "DisputeTicket"("reason");

-- CreateIndex
CREATE INDEX "DisputeTicket_subject_idx" ON "DisputeTicket"("subject");

-- CreateIndex
CREATE INDEX "Payout_userId_idx" ON "Payout"("userId");

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

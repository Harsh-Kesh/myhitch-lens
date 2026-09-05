-- CreateTable
CREATE TABLE "ExternalOpportunity" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "expectedValue" DECIMAL(12,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExternalOpportunity_isActive_idx" ON "ExternalOpportunity"("isActive");

-- AddForeignKey
ALTER TABLE "ExternalOpportunity" ADD CONSTRAINT "ExternalOpportunity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

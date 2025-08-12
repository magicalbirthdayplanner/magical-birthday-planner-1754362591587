-- AlterTable
ALTER TABLE "parties" ADD COLUMN "shareToken" TEXT;
ALTER TABLE "parties" ADD COLUMN "isShared" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "parties" ADD COLUMN "sharedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "parties_shareToken_key" ON "parties"("shareToken");
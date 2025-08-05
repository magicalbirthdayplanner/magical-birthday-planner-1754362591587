-- CreateEnum
CREATE TYPE "EventPackage" AS ENUM ('LITE_PARTY', 'MAGICAL_PARTY', 'ULTIMATE_PARTY', 'PARTY_BUNDLE', 'PLANNER_PRO');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED', 'CANCELED');

-- CreateEnum
CREATE TYPE "PartyStatus" AS ENUM ('PLANNING', 'ACTIVE', 'COMPLETED', 'CANCELED');

-- CreateTable
CREATE TABLE "event_purchases" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "packageType" "EventPackage" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "eventsIncluded" INTEGER NOT NULL DEFAULT 1,
    "eventsUsed" INTEGER NOT NULL DEFAULT 0,
    "validUntil" TIMESTAMP(3),
    "paymentIntentId" TEXT,
    "transactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_purchases_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "parties" ADD COLUMN     "packageType" "EventPackage" NOT NULL DEFAULT 'LITE_PARTY',
ADD COLUMN     "status" "PartyStatus" NOT NULL DEFAULT 'PLANNING',
ADD COLUMN     "accessExpiresAt" TIMESTAMP(3),
ADD COLUMN     "eventPurchaseId" TEXT;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "packageType" "EventPackage",
ADD COLUMN     "eventPurchaseId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "event_purchases_paymentIntentId_key" ON "event_purchases"("paymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "event_purchases_transactionId_key" ON "event_purchases"("transactionId");

-- AddForeignKey
ALTER TABLE "parties" ADD CONSTRAINT "parties_eventPurchaseId_fkey" FOREIGN KEY ("eventPurchaseId") REFERENCES "event_purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_purchases" ADD CONSTRAINT "event_purchases_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable Row Level Security
ALTER TABLE "event_purchases" ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for event_purchases
CREATE POLICY "Users can view their own event purchases" ON "event_purchases" FOR SELECT USING (auth.uid()::text = "userId");
CREATE POLICY "Users can insert their own event purchases" ON "event_purchases" FOR INSERT WITH CHECK (auth.uid()::text = "userId");
CREATE POLICY "Users can update their own event purchases" ON "event_purchases" FOR UPDATE USING (auth.uid()::text = "userId");
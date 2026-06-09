/*
  Warnings:

  - A unique constraint covering the columns `[opnameId,itemId,batchId]` on the table `StockOpnameLine` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('LOW_STOCK', 'EXPIRING_SOON', 'EXPIRED');

-- CreateEnum
CREATE TYPE "NotificationSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- DropIndex
DROP INDEX "StockOpnameLine_opnameId_itemId_key";

-- AlterTable
ALTER TABLE "GoodsIssueLine" ADD COLUMN     "batchId" TEXT;

-- AlterTable
ALTER TABLE "GoodsReceiptLine" ADD COLUMN     "batchId" TEXT;

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "tracksBatch" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "StockAdjustmentLine" ADD COLUMN     "batchId" TEXT;

-- AlterTable
ALTER TABLE "StockLedger" ADD COLUMN     "batchId" TEXT;

-- AlterTable
ALTER TABLE "StockOpnameLine" ADD COLUMN     "batchId" TEXT;

-- AlterTable
ALTER TABLE "StockTransferLine" ADD COLUMN     "batchId" TEXT;

-- CreateTable
CREATE TABLE "ItemBatch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "batchCode" TEXT NOT NULL,
    "mfgDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "costPrice" DECIMAL(18,4),
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "severity" "NotificationSeverity" NOT NULL DEFAULT 'WARNING',
    "itemId" TEXT,
    "batchId" TEXT,
    "warehouseId" TEXT,
    "dateBucket" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "metricValue" DECIMAL(18,3),
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertCheckRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "itemsScanned" INTEGER NOT NULL DEFAULT 0,
    "batchesScanned" INTEGER NOT NULL DEFAULT 0,
    "alertsCreated" INTEGER NOT NULL DEFAULT 0,
    "alertsResolved" INTEGER NOT NULL DEFAULT 0,
    "triggeredById" TEXT,
    "triggerSource" TEXT NOT NULL DEFAULT 'cron',
    "errorMessage" TEXT,

    CONSTRAINT "AlertCheckRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ItemBatch_organizationId_itemId_isActive_idx" ON "ItemBatch"("organizationId", "itemId", "isActive");

-- CreateIndex
CREATE INDEX "ItemBatch_organizationId_expiryDate_idx" ON "ItemBatch"("organizationId", "expiryDate");

-- CreateIndex
CREATE UNIQUE INDEX "ItemBatch_organizationId_itemId_batchCode_key" ON "ItemBatch"("organizationId", "itemId", "batchCode");

-- CreateIndex
CREATE INDEX "Notification_organizationId_isRead_isResolved_idx" ON "Notification"("organizationId", "isRead", "isResolved");

-- CreateIndex
CREATE INDEX "Notification_organizationId_createdAt_idx" ON "Notification"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_organizationId_type_itemId_batchId_dateBucket_key" ON "Notification"("organizationId", "type", "itemId", "batchId", "dateBucket");

-- CreateIndex
CREATE INDEX "AlertCheckRun_organizationId_startedAt_idx" ON "AlertCheckRun"("organizationId", "startedAt");

-- CreateIndex
CREATE INDEX "GoodsIssueLine_batchId_idx" ON "GoodsIssueLine"("batchId");

-- CreateIndex
CREATE INDEX "GoodsReceiptLine_batchId_idx" ON "GoodsReceiptLine"("batchId");

-- CreateIndex
CREATE INDEX "StockAdjustmentLine_batchId_idx" ON "StockAdjustmentLine"("batchId");

-- CreateIndex
CREATE INDEX "StockLedger_organizationId_itemId_warehouseId_batchId_idx" ON "StockLedger"("organizationId", "itemId", "warehouseId", "batchId");

-- CreateIndex
CREATE INDEX "StockOpnameLine_batchId_idx" ON "StockOpnameLine"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "StockOpnameLine_opnameId_itemId_batchId_key" ON "StockOpnameLine"("opnameId", "itemId", "batchId");

-- CreateIndex
CREATE INDEX "StockTransferLine_batchId_idx" ON "StockTransferLine"("batchId");

-- AddForeignKey
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ItemBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsIssueLine" ADD CONSTRAINT "GoodsIssueLine_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ItemBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustmentLine" ADD CONSTRAINT "StockAdjustmentLine_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ItemBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLedger" ADD CONSTRAINT "StockLedger_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ItemBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferLine" ADD CONSTRAINT "StockTransferLine_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ItemBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockOpnameLine" ADD CONSTRAINT "StockOpnameLine_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ItemBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemBatch" ADD CONSTRAINT "ItemBatch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemBatch" ADD CONSTRAINT "ItemBatch_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ItemBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertCheckRun" ADD CONSTRAINT "AlertCheckRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

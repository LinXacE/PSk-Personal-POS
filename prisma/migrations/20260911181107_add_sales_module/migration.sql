
-- CreateEnum
CREATE TYPE "SalesOrderStatus" AS ENUM ('DRAFT', 'COMPLETED');

-- AlterTable
ALTER TABLE "SalesOrder" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "note" TEXT,
ADD COLUMN     "priceGroupId" TEXT,
ADD COLUMN     "referenceIsAuto" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "status" "SalesOrderStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "warehouseId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "SalesOrderLineBatch" (
    "id" TEXT NOT NULL,
    "salesOrderLineId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitCost" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesOrderLineBatch_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_priceGroupId_fkey" FOREIGN KEY ("priceGroupId") REFERENCES "PriceGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderLineBatch" ADD CONSTRAINT "SalesOrderLineBatch_salesOrderLineId_fkey" FOREIGN KEY ("salesOrderLineId") REFERENCES "SalesOrderLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderLineBatch" ADD CONSTRAINT "SalesOrderLineBatch_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "StockBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


/*
  Warnings:

  - Added the required column `entryQuantity` to the `PurchaseOrderLine` table without a default value. This is not possible if the table is not empty.
  - Added the required column `entryUnitId` to the `PurchaseOrderLine` table without a default value. This is not possible if the table is not empty.
  - Added the required column `entryQuantity` to the `SalesOrderLine` table without a default value. This is not possible if the table is not empty.
  - Added the required column `entryUnitId` to the `SalesOrderLine` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PurchaseOrderLine" ADD COLUMN     "entryQuantity" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "entryUnitId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "SalesOrderLine" ADD COLUMN     "entryQuantity" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "entryUnitId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "entryQuantity" DOUBLE PRECISION,
ADD COLUMN     "entryUnitId" TEXT;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_entryUnitId_fkey" FOREIGN KEY ("entryUnitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_entryUnitId_fkey" FOREIGN KEY ("entryUnitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_entryUnitId_fkey" FOREIGN KEY ("entryUnitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

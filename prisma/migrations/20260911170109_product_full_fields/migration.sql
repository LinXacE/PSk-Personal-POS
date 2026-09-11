-- DropForeignKey
ALTER TABLE "ProductBarcode" DROP CONSTRAINT "ProductBarcode_productId_fkey";

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "barcode" TEXT NOT NULL,
ADD COLUMN     "barcodeSource" "BarcodeSource" NOT NULL DEFAULT 'SYSTEM',
ADD COLUMN     "codeIsAuto" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "defaultPurchasePrice" DOUBLE PRECISION,
ADD COLUMN     "defaultSupplierId" TEXT;

-- DropTable
DROP TABLE "ProductBarcode";

-- CreateIndex
CREATE UNIQUE INDEX "Product_barcode_key" ON "Product"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_name_key" ON "Supplier"("name");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_defaultSupplierId_fkey" FOREIGN KEY ("defaultSupplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;


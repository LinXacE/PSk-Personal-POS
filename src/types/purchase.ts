export type PurchaseOrderStatus = "ORDERED" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED";
export type PaymentStatus = "UNPAID" | "PARTIAL" | "PAID";

export type StockBatchDTO = {
  id: string;
  batchNumber: string;
  quantityReceived: number;
  quantityRemaining: number;
  unitCost: number;
  receivedAt: string;
  expiryDate: string | null;
};

export type PurchaseOrderLineDTO = {
  id?: string;
  productId: string;
  productName?: string;
  productCode?: string;
  baseUnitName?: string;
  entryQuantity: number;
  entryUnitId: string;
  entryUnitName?: string;
  quantity?: number; // base-unit converted, server-computed
  receivedQuantity?: number; // base units received so far
  unitCost: number;
  batches?: StockBatchDTO[];
};

export type PurchaseOrderDTO = {
  id: string;
  reference: string;
  referenceIsAuto: boolean;
  supplierId: string;
  supplierName: string;
  currencyId: string;
  currencyCode: string;
  warehouseId: string;
  warehouseName: string;
  status: PurchaseOrderStatus;
  paymentStatus: PaymentStatus;
  amountPaid: number;
  totalAmount: number;
  note: string | null;
  orderedAt: string;
  receivedAt: string | null;
  createdAt: string;
  lines: PurchaseOrderLineDTO[];
};

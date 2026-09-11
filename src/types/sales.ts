export type SalesOrderStatus = "DRAFT" | "COMPLETED";

export type ProductPriceOption = {
  priceGroupId: string;
  currencyId: string;
  price: number;
};

export type SalesProductOption = {
  id: string;
  name: string;
  code: string;
  baseUnitId: string;
  baseUnitName: string;
  prices: ProductPriceOption[];
};

export type SalesOrderLineDTO = {
  id?: string;
  productId: string;
  productName?: string;
  productCode?: string;
  baseUnitName?: string;
  entryQuantity: number;
  entryUnitId: string;
  entryUnitName?: string;
  quantity?: number; // base-unit converted, server-computed
  unitPrice: number;
  allocations?: { batchNumber: string; quantity: number; unitCost: number }[];
};

export type SalesOrderDTO = {
  id: string;
  reference: string;
  referenceIsAuto: boolean;
  customerId: string | null;
  customerName: string | null;
  currencyId: string;
  currencyCode: string;
  warehouseId: string;
  warehouseName: string;
  priceGroupId: string | null;
  priceGroupName: string | null;
  status: SalesOrderStatus;
  totalAmount: number;
  note: string | null;
  soldAt: string;
  completedAt: string | null;
  createdAt: string;
  lines: SalesOrderLineDTO[];
};

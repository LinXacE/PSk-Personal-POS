import { prisma } from "@/lib/prisma";
import { PurchaseClient } from "./purchase-client";
import { computeTotal } from "@/lib/purchase";
import type { PurchaseOrderDTO } from "@/types/purchase";
import type { UnitDTO } from "@/types/product";
import type { SupplierDTO, WarehouseDTO, CurrencyDTO } from "@/types/settings";

export default async function PurchasesPage() {
  const [orders, products, units, suppliers, warehouses, currencies] = await Promise.all([
    prisma.purchaseOrder.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        supplier: { select: { name: true } },
        currency: { select: { code: true } },
        warehouse: { select: { name: true } },
        lines: {
          include: {
            product: { select: { name: true, code: true, baseUnit: { select: { name: true } } } },
            entryUnit: { select: { name: true } },
            batches: true,
          },
        },
      },
    }),
    prisma.product.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, code: true, baseUnitId: true, baseUnit: { select: { name: true } } },
    }),
    prisma.unit.findMany({
      orderBy: { createdAt: "asc" },
      include: { baseUnit: { select: { name: true } }, _count: { select: { products: true, derivedUnits: true } } },
    }),
    prisma.supplier.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { purchases: true, defaultForProducts: true } } },
    }),
    prisma.warehouse.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { purchaseOrders: true, movements: true, batches: true } } },
    }),
    prisma.currency.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { prices: true } } },
    }),
  ]);

  const purchaseOrders: PurchaseOrderDTO[] = orders.map((o) => ({
    id: o.id,
    reference: o.reference,
    referenceIsAuto: o.referenceIsAuto,
    supplierId: o.supplierId,
    supplierName: o.supplier.name,
    currencyId: o.currencyId,
    currencyCode: o.currency.code,
    warehouseId: o.warehouseId,
    warehouseName: o.warehouse.name,
    status: o.status,
    paymentStatus: o.paymentStatus,
    amountPaid: o.amountPaid,
    totalAmount: computeTotal(o.lines),
    note: o.note,
    orderedAt: o.orderedAt.toISOString(),
    receivedAt: o.receivedAt ? o.receivedAt.toISOString() : null,
    createdAt: o.createdAt.toISOString(),
    lines: o.lines.map((l) => ({
      id: l.id,
      productId: l.productId,
      productName: l.product.name,
      productCode: l.product.code,
      baseUnitName: l.product.baseUnit.name,
      entryQuantity: l.entryQuantity,
      entryUnitId: l.entryUnitId,
      entryUnitName: l.entryUnit.name,
      quantity: l.quantity,
      receivedQuantity: l.receivedQuantity,
      unitCost: l.unitCost,
      batches: l.batches.map((b) => ({
        id: b.id,
        batchNumber: b.batchNumber,
        quantityReceived: b.quantityReceived,
        quantityRemaining: b.quantityRemaining,
        unitCost: b.unitCost,
        receivedAt: b.receivedAt.toISOString(),
        expiryDate: b.expiryDate ? b.expiryDate.toISOString() : null,
      })),
    })),
  }));

  const productOptions = products.map((p) => ({
    id: p.id,
    name: p.name,
    code: p.code,
    baseUnitId: p.baseUnitId,
    baseUnitName: p.baseUnit.name,
  }));

  const unitOptions: UnitDTO[] = units.map((u) => ({
    id: u.id,
    name: u.name,
    kind: u.kind,
    baseUnitId: u.baseUnitId,
    baseUnitName: u.baseUnit?.name ?? null,
    conversionQty: u.conversionQty,
    productCount: u._count.products,
    derivedUnitCount: u._count.derivedUnits,
  }));

  const supplierOptions: SupplierDTO[] = suppliers.map((s) => ({
    id: s.id,
    name: s.name,
    contact: s.contact,
    address: s.address,
    purchaseCount: s._count.purchases,
    productCount: s._count.defaultForProducts,
  }));

  const warehouseOptions: WarehouseDTO[] = warehouses.map((w) => ({
    id: w.id,
    name: w.name,
    address: w.address,
    purchaseOrderCount: w._count.purchaseOrders,
    movementCount: w._count.movements,
    batchCount: w._count.batches,
  }));

  const currencyOptions: CurrencyDTO[] = currencies.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    isDefault: c.isDefault,
    exchangeRate: c.exchangeRate,
    productPriceCount: c._count.prices,
  }));

  return (
    <PurchaseClient
      purchaseOrders={purchaseOrders}
      products={productOptions}
      units={unitOptions}
      suppliers={supplierOptions}
      warehouses={warehouseOptions}
      currencies={currencyOptions}
    />
  );
}

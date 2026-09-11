import { prisma } from "@/lib/prisma";
import { SalesClient } from "./sales-client";
import { computeSalesTotal } from "@/lib/sales";
import type { SalesOrderDTO, SalesProductOption } from "@/types/sales";
import type { UnitDTO } from "@/types/product";
import type { CustomerDTO } from "@/types/settings";
import type { WarehouseDTO, CurrencyDTO, PriceGroupDTO } from "@/types/settings";

export default async function SalesPage() {
  const [orders, products, units, customers, warehouses, currencies, priceGroups] = await Promise.all([
    prisma.salesOrder.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { name: true } },
        currency: { select: { code: true } },
        warehouse: { select: { name: true } },
        priceGroup: { select: { name: true } },
        lines: {
          include: {
            product: { select: { name: true, code: true, baseUnit: { select: { name: true } } } },
            entryUnit: { select: { name: true } },
            allocations: { include: { batch: { select: { batchNumber: true } } } },
          },
        },
      },
    }),
    prisma.product.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        code: true,
        baseUnitId: true,
        baseUnit: { select: { name: true } },
        prices: { select: { priceGroupId: true, currencyId: true, price: true } },
      },
    }),
    prisma.unit.findMany({
      orderBy: { createdAt: "asc" },
      include: { baseUnit: { select: { name: true } }, _count: { select: { products: true, derivedUnits: true } } },
    }),
    prisma.customer.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { sales: true, contracts: true, serviceTickets: true } } },
    }),
    prisma.warehouse.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { purchaseOrders: true, movements: true, batches: true } } },
    }),
    prisma.currency.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { prices: true } } },
    }),
    prisma.priceGroup.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { prices: true } } },
    }),
  ]);

  const salesOrders: SalesOrderDTO[] = orders.map((o) => ({
    id: o.id,
    reference: o.reference,
    referenceIsAuto: o.referenceIsAuto,
    customerId: o.customerId,
    customerName: o.customer?.name ?? null,
    currencyId: o.currencyId,
    currencyCode: o.currency.code,
    warehouseId: o.warehouseId,
    warehouseName: o.warehouse.name,
    priceGroupId: o.priceGroupId,
    priceGroupName: o.priceGroup?.name ?? null,
    status: o.status,
    totalAmount: computeSalesTotal(o.lines),
    note: o.note,
    soldAt: o.soldAt.toISOString(),
    completedAt: o.completedAt ? o.completedAt.toISOString() : null,
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
      unitPrice: l.unitPrice,
      allocations: l.allocations.map((a) => ({
        batchNumber: a.batch.batchNumber,
        quantity: a.quantity,
        unitCost: a.unitCost,
      })),
    })),
  }));

  const productOptions: SalesProductOption[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    code: p.code,
    baseUnitId: p.baseUnitId,
    baseUnitName: p.baseUnit.name,
    prices: p.prices,
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

  const customerOptions: CustomerDTO[] = customers.map((c) => ({
    id: c.id,
    name: c.name,
    contact: c.contact,
    address: c.address,
    salesCount: c._count.sales,
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

  const priceGroupOptions: PriceGroupDTO[] = priceGroups.map((g) => ({
    id: g.id,
    name: g.name,
    isDefault: g.isDefault,
    productPriceCount: g._count.prices,
  }));

  return (
    <SalesClient
      salesOrders={salesOrders}
      products={productOptions}
      units={unitOptions}
      customers={customerOptions}
      warehouses={warehouseOptions}
      currencies={currencyOptions}
      priceGroups={priceGroupOptions}
    />
  );
}

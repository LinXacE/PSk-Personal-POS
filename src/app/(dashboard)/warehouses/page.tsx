import { prisma } from "@/lib/prisma";
import { WarehouseClient } from "./warehouse-client";
import type { WarehouseDTO } from "@/types/settings";

export default async function WarehousesPage() {
  const rows = await prisma.warehouse.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { purchaseOrders: true, movements: true, batches: true } } },
  });

  const warehouses: WarehouseDTO[] = rows.map((w) => ({
    id: w.id,
    name: w.name,
    address: w.address,
    purchaseOrderCount: w._count.purchaseOrders,
    movementCount: w._count.movements,
    batchCount: w._count.batches,
  }));

  return <WarehouseClient warehouses={warehouses} />;
}

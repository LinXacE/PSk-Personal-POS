import { prisma } from "@/lib/prisma";
import { SupplierClient } from "./supplier-client";
import type { SupplierDTO } from "@/types/settings";

export default async function SuppliersPage() {
  const rows = await prisma.supplier.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { purchases: true, defaultForProducts: true } } },
  });

  const suppliers: SupplierDTO[] = rows.map((s) => ({
    id: s.id,
    name: s.name,
    contact: s.contact,
    address: s.address,
    purchaseCount: s._count.purchases,
    productCount: s._count.defaultForProducts,
  }));

  return <SupplierClient suppliers={suppliers} />;
}

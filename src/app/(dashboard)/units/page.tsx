import { prisma } from "@/lib/prisma";
import { UnitClient } from "./unit-client";
import type { UnitDTO } from "@/types/product";

export default async function UnitsPage() {
  const rows = await prisma.unit.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      baseUnit: { select: { name: true } },
      _count: { select: { products: true, derivedUnits: true } },
    },
  });

  const units: UnitDTO[] = rows.map((u) => ({
    id: u.id,
    name: u.name,
    kind: u.kind,
    baseUnitId: u.baseUnitId,
    baseUnitName: u.baseUnit?.name ?? null,
    conversionQty: u.conversionQty,
    productCount: u._count.products,
    derivedUnitCount: u._count.derivedUnits,
  }));

  return <UnitClient units={units} />;
}

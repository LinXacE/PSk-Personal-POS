import { prisma } from "@/lib/prisma";
import { PriceGroupClient } from "./price-group-client";
import type { PriceGroupDTO } from "@/types/settings";

export default async function PriceGroupsPage() {
  const rows = await prisma.priceGroup.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { prices: true } } },
  });

  const priceGroups: PriceGroupDTO[] = rows.map((g) => ({
    id: g.id,
    name: g.name,
    isDefault: g.isDefault,
    productPriceCount: g._count.prices,
  }));

  return <PriceGroupClient priceGroups={priceGroups} />;
}

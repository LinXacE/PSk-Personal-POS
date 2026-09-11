import { prisma } from "@/lib/prisma";
import { BrandClient } from "./brand-client";
import type { BrandDTO } from "@/types/product";

function codeFromName(name: string) {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default async function BrandsPage() {
  const rows = await prisma.brand.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { products: true } } },
  });

  const brands: BrandDTO[] = rows.map((b) => ({
    id: b.id,
    code: codeFromName(b.name),
    name: b.name,
    productCount: b._count.products,
  }));

  return <BrandClient brands={brands} />;
}

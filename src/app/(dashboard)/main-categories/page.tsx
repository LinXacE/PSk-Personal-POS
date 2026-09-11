import { prisma } from "@/lib/prisma";
import { MainCategoryClient } from "./main-category-client";
import type { MainCategoryDTO } from "@/types/product";

function codeFromName(name: string) {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default async function MainCategoriesPage() {
  const rows = await prisma.mainCategory.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { subCategories: true, products: true } } },
  });

  const mainCategories: MainCategoryDTO[] = rows.map((c) => ({
    id: c.id,
    code: codeFromName(c.name),
    name: c.name,
    type: c.type,
    subCategoryCount: c._count.subCategories,
    productCount: c._count.products,
  }));

  return <MainCategoryClient mainCategories={mainCategories} />;
}

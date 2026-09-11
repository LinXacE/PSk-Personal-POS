import { prisma } from "@/lib/prisma";
import { SubCategoryClient } from "./sub-category-client";
import type { MainCategoryDTO, SubCategoryDTO } from "@/types/product";

function codeFromName(name: string) {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default async function SubCategoriesPage() {
  const [subRows, mainRows] = await Promise.all([
    prisma.subCategory.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        mainCategory: { select: { id: true, name: true, type: true } },
        _count: { select: { products: true } },
      },
    }),
    prisma.mainCategory.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { subCategories: true, products: true } } },
    }),
  ]);

  const subCategories: SubCategoryDTO[] = subRows.map((s) => ({
    id: s.id,
    code: codeFromName(s.name),
    name: s.name,
    mainCategoryId: s.mainCategoryId,
    mainCategoryName: s.mainCategory.name,
    mainCategoryType: s.mainCategory.type,
    productCount: s._count.products,
  }));

  const mainCategories: MainCategoryDTO[] = mainRows.map((c) => ({
    id: c.id,
    code: codeFromName(c.name),
    name: c.name,
    type: c.type,
    subCategoryCount: c._count.subCategories,
    productCount: c._count.products,
  }));

  return (
    <SubCategoryClient
      subCategories={subCategories}
      mainCategories={mainCategories}
    />
  );
}
